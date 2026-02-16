// js/logic/server_sync.js
// Debounced sync av state till server. Om auditId saknas importeras granskningen först.

import { update_audit, import_audit } from '../api/client.js';

let debounce_timer = null;
const DEBOUNCE_MS = 500;

const SERVER_STATUS_VALUES = ['not_started', 'in_progress', 'locked', 'archived'];

function normalize_status_for_server(status) {
    if (SERVER_STATUS_VALUES.includes(status)) return status;
    return 'not_started';
}

function state_to_patch(state) {
    return {
        metadata: state.auditMetadata || {},
        status: normalize_status_for_server(state.auditStatus || 'not_started'),
        samples: state.samples || []
    };
}

function state_to_import(state) {
    return {
        ruleFileContent: state.ruleFileContent,
        auditMetadata: state.auditMetadata || {},
        auditStatus: normalize_status_for_server(state.auditStatus || 'not_started'),
        samples: state.samples || []
    };
}

export function schedule_sync_to_server(state, dispatch_fn) {
    if (!state) return;
    if (!state.ruleFileContent) return;
    if (typeof window === 'undefined') return;
    if (state.auditStatus === 'rulefile_editing') return;

    if (debounce_timer) clearTimeout(debounce_timer);
    debounce_timer = setTimeout(async () => {
        debounce_timer = null;
        try {
            if (state.auditId) {
                await update_audit(state.auditId, state_to_patch(state));
            } else {
                const full_state = await import_audit(state_to_import(state));
                if (dispatch_fn && full_state?.auditId) {
                    setTimeout(() => {
                        dispatch_fn({
                            type: 'SET_REMOTE_AUDIT_ID',
                            payload: {
                                auditId: full_state.auditId,
                                ruleSetId: full_state.ruleSetId ?? null,
                                version: full_state.version ?? null
                            }
                        });
                    }, 0);
                }
            }
        } catch (err) {
            if (err.status === 409 && err.existingAuditId && dispatch_fn) {
                dispatch_fn({
                    type: 'SET_REMOTE_AUDIT_ID',
                    payload: {
                        auditId: err.existingAuditId,
                        ruleSetId: null,
                        version: null
                    }
                });
            } else if (window.NotificationComponent?.show_global_message && window.Translation?.t) {
                window.NotificationComponent.show_global_message(
                    window.Translation.t('server_sync_error', { message: err.message }) || `Kunde inte spara till servern: ${err.message}`,
                    'error'
                );
            }
        }
    }, DEBOUNCE_MS);
}
