// js/logic/audit_view_poll_service.js
// Pollar granskningsversion när användaren har en granskning öppen. Uppdaterar state om annan enhet ändrat.
// Lyssnar även på WebSocket-driven gv-audits-changed (detail.auditId) för snabbare synk.
//
// Vyer som INTE ingår (avsiktligt):
// - start, upload, audit: inte i en granskning
// - (cold start-backup hanteras i session_boot_merge innan audit-vyer)
// - confirm_sample_edit: REPLACE_STATE_FROM_REMOTE skulle förlora pendingSampleChanges
// - rulefile_*: auditStatus === 'rulefile_editing' stoppar polling automatiskt
// - auditStatus === 'not_started': granskningen är inte synkad till servern än → undviker 404

import { get_audit_version, load_audit_with_rule_file } from '../api/client.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import { get_current_view_name } from '../app/browser_globals.js';
import {
    should_show_audit_collaboration_notice,
    update_baseline_from_server_full_state
} from './audit_collaboration_notice.js';
import { is_audit_push_websocket_open, subscribe_audits } from './list_push_service.js';
import { has_unsynced_local_audit_changes } from './audit_sync_tracking.js';
import { has_pending_audit_sync_plan } from '../sync/audit_sync_planning.js';
import {
    build_remote_requirement_dispatch_payload,
    should_apply_remote_requirement_push
} from './audit_remote_push_apply.js';

const POLL_INTERVAL_MS = 8000;
const POLL_INTERVAL_WS_CONNECTED_MS = 60000;
const POLL_INTERVAL_AFTER_PUSH_MS = 2000;
const AUDIT_PUSH_EVENT = 'gv-audits-changed';

/** @type {number|null} */
let _last_push_pull_at = null;

const AUDIT_VIEWS = new Set([
    'audit_overview',
    'requirement_list',
    'requirement_audit',
    'all_requirements',
    'audit_images',
    'audit_problems',
    'metadata',
    'edit_metadata',
    'sample_management',
    'sample_form',
    'audit_actions',
    'update_rulefile',
    'confirm_updates',
    'final_confirm_updates'
]);

function is_audit_view() {
    const view = typeof window !== 'undefined' && get_current_view_name();
    return view && AUDIT_VIEWS.has(view);
}

function show_collaboration_notice_if_needed(local_state, remote_state) {
    const should_notice = should_show_audit_collaboration_notice({ local_state, remote_state });
    if (should_notice && app_runtime_refs.notification_component?.show_global_message && window.Translation?.t) {
        const msg = window.Translation.t('realtime_sync_updated') || 'Granskningen har uppdaterats av en annan enhet';
        app_runtime_refs.notification_component.show_global_message(msg, 'info');
    }
}

export function init_audit_view_poll_service({ getState, dispatch, StoreActionTypes }) {
    if (typeof window === 'undefined') return null;

    const unsub_audits = subscribe_audits(() => {
        /* Tom callback: håller WebSocket öppen för audits:changed även innan StartView/AuditView prenumererar. */
    });

    let poll_timer = null;

    function stop_polling() {
        if (poll_timer) {
            clearTimeout(poll_timer);
            poll_timer = null;
        }
    }

    function try_apply_remote_requirement_push(push_detail) {
        const state = getState();
        if (!state?.auditId || !is_audit_view()) return false;
        if (state?.auditStatus === 'rulefile_editing' || state?.auditStatus === 'not_started') return false;
        if (!should_apply_remote_requirement_push(state, push_detail)) return false;

        dispatch({
            type: StoreActionTypes.UPDATE_REQUIREMENT_RESULT,
            payload: build_remote_requirement_dispatch_payload(push_detail)
        });
        show_collaboration_notice_if_needed(state, getState());
        return true;
    }

    async function try_pull_newer_audit_state({ triggered_by_audit_id, push_detail } = {}) {
        const state = getState();
        const audit_id = state?.auditId;
        if (!audit_id || !is_audit_view()) return;
        if (state?.auditStatus === 'rulefile_editing' || state?.auditStatus === 'not_started') return;
        if (
            triggered_by_audit_id != null &&
            String(triggered_by_audit_id) !== '' &&
            String(triggered_by_audit_id) !== String(audit_id)
        ) {
            return;
        }

        if (push_detail?.changeKind === 'requirement_updated') {
            try_apply_remote_requirement_push(push_detail);
            return;
        }

        try {
            const push_version = push_detail?.version;
            const state_before_fetch = getState();
            if (!state_before_fetch?.auditId || String(state_before_fetch.auditId) !== String(audit_id)) return;
            if (has_unsynced_local_audit_changes(state_before_fetch)) return;
            if (has_pending_audit_sync_plan()) return;

            let remote_version = push_version;
            if (remote_version === null || remote_version === undefined) {
                const version_response = await get_audit_version(audit_id);
                remote_version = version_response?.version;
            }

            const state_now = getState();
            if (!state_now?.auditId || String(state_now.auditId) !== String(audit_id)) return;
            if (state_now?.auditStatus === 'rulefile_editing' || state_now?.auditStatus === 'not_started') return;
            if (has_unsynced_local_audit_changes(state_now)) return;
            if (has_pending_audit_sync_plan()) return;

            const local_version = state_now?.version ?? 0;
            if (remote_version !== null && remote_version !== undefined && remote_version > local_version) {
                const full_state = await load_audit_with_rule_file(audit_id);
                if (full_state) {
                    dispatch({
                        type: StoreActionTypes.REPLACE_STATE_FROM_REMOTE,
                        payload: {
                            ...full_state,
                            saveFileVersion: full_state.saveFileVersion || '2.1.0'
                        }
                    });
                    update_baseline_from_server_full_state(full_state);
                    show_collaboration_notice_if_needed(state_now, full_state);
                }
            }
        } catch {
            /* tyst vid poll-fel */
        }
    }

    function next_poll_delay_ms() {
        const base_interval = is_audit_push_websocket_open()
            ? POLL_INTERVAL_WS_CONNECTED_MS
            : POLL_INTERVAL_MS;
        if (_last_push_pull_at !== null && Date.now() - _last_push_pull_at < base_interval) {
            return POLL_INTERVAL_AFTER_PUSH_MS;
        }
        return base_interval;
    }

    async function poll_once() {
        const state = getState();
        const audit_id = state?.auditId;
        const is_rulefile_editing = state?.auditStatus === 'rulefile_editing';
        const is_new_audit_not_synced = state?.auditStatus === 'not_started';

        if (!is_audit_view() || !audit_id || is_rulefile_editing) {
            poll_timer = setTimeout(poll_once, next_poll_delay_ms());
            return;
        }
        if (is_new_audit_not_synced) {
            poll_timer = setTimeout(poll_once, next_poll_delay_ms());
            return;
        }

        await try_pull_newer_audit_state({});
        poll_timer = setTimeout(poll_once, next_poll_delay_ms());
    }

    function on_audits_push(ev) {
        const push_detail = ev?.detail ?? {};
        _last_push_pull_at = Date.now();
        void try_pull_newer_audit_state({
            triggered_by_audit_id: push_detail.auditId ?? null,
            push_detail
        });
    }

    window.addEventListener(AUDIT_PUSH_EVENT, on_audits_push);

    function start() {
        stop_polling();
        poll_timer = setTimeout(poll_once, next_poll_delay_ms());
    }

    start();

    return {
        disconnect() {
            stop_polling();
            window.removeEventListener(AUDIT_PUSH_EVENT, on_audits_push);
            if (typeof unsub_audits === 'function') unsub_audits();
        }
    };
}
