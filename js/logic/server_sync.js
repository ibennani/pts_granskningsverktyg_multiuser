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

async function run_sync(state, dispatch_fn) {
    if (!state || !state.ruleFileContent || typeof window === 'undefined') return;
    if (state.auditStatus === 'rulefile_editing') return;

    try {
        if (state.auditId) {
            const full_state = await update_audit(state.auditId, state_to_patch(state));
            if (dispatch_fn && full_state && full_state.version != null) {
                dispatch_fn({
                    type: 'SET_REMOTE_AUDIT_ID',
                    payload: {
                        auditId: state.auditId,
                        ruleSetId: state.ruleSetId ?? full_state.ruleSetId ?? null,
                        version: full_state.version,
                        skip_render: true
                    }
                });
            }
        } else {
            const full_state = await import_audit(state_to_import(state));
            if (dispatch_fn && full_state?.auditId) {
                setTimeout(() => {
                    dispatch_fn({
                        type: 'SET_REMOTE_AUDIT_ID',
                        payload: {
                            auditId: full_state.auditId,
                            ruleSetId: full_state.ruleSetId ?? null,
                            version: full_state.version ?? null,
                            skip_render: true
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
                    version: null,
                    skip_render: true
                }
            });
        } else if (window.NotificationComponent?.show_global_message && window.Translation?.t) {
            window.NotificationComponent.show_global_message(
                window.Translation.t('server_sync_error', { message: err.message }) || `Kunde inte spara till servern: ${err.message}`,
                'error'
            );
        }
    }
}

export function schedule_sync_to_server(state, dispatch_fn) {
    if (!state) return;
    if (!state.ruleFileContent) return;
    if (typeof window === 'undefined') return;
    if (state.auditStatus === 'rulefile_editing') return;

    if (debounce_timer) clearTimeout(debounce_timer);
    debounce_timer = setTimeout(async () => {
        debounce_timer = null;
        await run_sync(state, dispatch_fn);
    }, DEBOUNCE_MS);
}

/**
 * Kör omedelbar sync till server med aktuell state (t.ex. vid "Fortsätt till stickprov").
 * Används när state.js inte triggar sync automatiskt (t.ex. auditStatus not_started).
 */
export async function sync_to_server_now(get_state_fn, dispatch_fn) {
    if (debounce_timer) {
        clearTimeout(debounce_timer);
        debounce_timer = null;
    }
    const state = typeof get_state_fn === 'function' ? get_state_fn() : null;
    if (state) {
        await run_sync(state, dispatch_fn);
    }
}

/**
 * Kör omedelbar sync till server (t.ex. vid navigering bort från granskning).
 * Rensar väntande debounce och sparar direkt.
 */
export async function flush_sync_to_server(get_state_fn, dispatch_fn) {
    if (debounce_timer) {
        clearTimeout(debounce_timer);
        debounce_timer = null;
        const state = typeof get_state_fn === 'function' ? get_state_fn() : null;
        if (state) {
            await run_sync(state, dispatch_fn);
        }
    }
}
