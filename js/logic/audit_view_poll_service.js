// js/logic/audit_view_poll_service.js
// Pollar granskningsversion när användaren har en granskning öppen. Uppdaterar state om annan enhet ändrat.
// Lyssnar även på WebSocket (audits:changed med auditId) och BroadcastChannel för snabbare synk mellan flikar.
//
// Vyer som INTE ingår (avsiktligt):
// - start, upload, audit: inte i en granskning
// - (cold start-backup hanteras i session_boot_merge innan audit-vyer)
// - confirm_sample_edit: REPLACE_STATE_FROM_REMOTE skulle förlora pendingSampleChanges
// - rulefile_*: auditStatus === 'rulefile_editing' stoppar polling automatiskt
// - auditStatus === 'not_started': granskningen är inte synkad till servern än → undviker 404

import { reload_open_audit_if_server_ahead } from './audit_remote_reload.js';
import { subscribe_audit_updates } from './list_push_service.js';
import { get_current_view_name } from '../app/browser_globals.js';

const POLL_INTERVAL_MS = 3000;
const AUDIT_VIEWS = new Set([
    'audit_overview',
    'requirement_list',
    'requirement_audit',
    'all_requirements',
    'audit_images',
    'audit_problems',
    'metadata',
    'edit_metadata',
    'audit_settings',
    'sample_management',
    'bulk_sample_import',
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

export function init_audit_view_poll_service({ getState, dispatch, StoreActionTypes }) {
    if (typeof window === 'undefined') return null;

    let poll_timer = null;
    let reload_in_flight = false;

    function stop_polling() {
        if (poll_timer) {
            clearTimeout(poll_timer);
            poll_timer = null;
        }
    }

    async function try_reload_from_server(remote_version_hint) {
        if (reload_in_flight) return;
        const state = getState();
        if (!is_audit_view() || !state?.auditId || state?.auditStatus === 'rulefile_editing') return;
        if (state?.auditStatus === 'not_started') return;

        reload_in_flight = true;
        try {
            await reload_open_audit_if_server_ahead({
                getState,
                dispatch,
                StoreActionTypes,
                remote_version_hint,
                show_collaboration_notice: true
            });
        } finally {
            reload_in_flight = false;
        }
    }

    async function poll_once() {
        await try_reload_from_server(null);
        poll_timer = setTimeout(poll_once, POLL_INTERVAL_MS);
    }

    function start() {
        stop_polling();
        poll_timer = setTimeout(poll_once, POLL_INTERVAL_MS);
    }

    start();

    const unsubscribe_ws = subscribe_audit_updates((payload) => {
        const state = getState();
        if (!payload?.auditId || !state?.auditId) return;
        if (String(state.auditId) !== String(payload.auditId)) return;
        void try_reload_from_server(payload.version ?? null);
    });

    return {
        disconnect() {
            stop_polling();
            if (typeof unsubscribe_ws === 'function') unsubscribe_ws();
        }
    };
}
