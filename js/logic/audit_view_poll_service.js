// js/logic/audit_view_poll_service.js
// Pollar granskningsversion när användaren har en granskning öppen. Uppdaterar state om annan enhet ändrat.
//
// Vyer som INTE ingår (avsiktligt):
// - start, upload, audit: inte i en granskning
// - (cold start-backup hanteras i session_boot_merge innan audit-vyer)
// - confirm_sample_edit: REPLACE_STATE_FROM_REMOTE skulle förlora pendingSampleChanges
// - rulefile_*: auditStatus === 'rulefile_editing' stoppar polling automatiskt
// - auditStatus === 'not_started': granskningen är inte synkad till servern än → undviker 404

import { get_audit_version, load_audit_with_rule_file } from '../api/client.js';

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
    'sample_management',
    'sample_form',
    'audit_actions',
    'update_rulefile',
    'confirm_updates',
    'final_confirm_updates'
]);

function is_audit_view() {
    const view = typeof window !== 'undefined' && window.__gv_current_view_name;
    return view && AUDIT_VIEWS.has(view);
}

export function init_audit_view_poll_service({ getState, dispatch, StoreActionTypes }) {
    if (typeof window === 'undefined') return null;

    let poll_timer = null;

    function stop_polling() {
        if (poll_timer) {
            clearTimeout(poll_timer);
            poll_timer = null;
        }
    }

    async function poll_once() {
        const state = getState();
        const audit_id = state?.auditId;
        const is_rulefile_editing = state?.auditStatus === 'rulefile_editing';
        const is_new_audit_not_synced = state?.auditStatus === 'not_started';

        if (!is_audit_view() || !audit_id || is_rulefile_editing) {
            poll_timer = setTimeout(poll_once, POLL_INTERVAL_MS);
            return;
        }
        if (is_new_audit_not_synced) {
            poll_timer = setTimeout(poll_once, POLL_INTERVAL_MS);
            return;
        }

        try {
            const { version } = await get_audit_version(audit_id);
            const local_version = state?.version ?? 0;
            if (version != null && version > local_version) {
                const full_state = await load_audit_with_rule_file(audit_id);
                if (full_state) {
                    dispatch({
                        type: StoreActionTypes.REPLACE_STATE_FROM_REMOTE,
                        payload: {
                            ...full_state,
                            saveFileVersion: full_state.saveFileVersion || '2.1.0'
                        }
                    });
                    if (window.NotificationComponent?.show_global_message && window.Translation?.t) {
                        const msg = window.Translation.t('realtime_sync_updated') || 'Granskningen har uppdaterats av en annan enhet';
                        window.NotificationComponent.show_global_message(msg, 'info');
                    }
                }
            }
        } catch {
            /* tyst vid poll-fel */
        }

        poll_timer = setTimeout(poll_once, POLL_INTERVAL_MS);
    }

    function start() {
        stop_polling();
        poll_timer = setTimeout(poll_once, POLL_INTERVAL_MS);
    }

    start();

    return {
        disconnect() {
            stop_polling();
        }
    };
}
