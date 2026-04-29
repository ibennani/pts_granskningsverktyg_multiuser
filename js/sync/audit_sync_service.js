import { update_audit, import_audit, load_audit_with_rule_file, get_auth_token } from '../api/client.js';
import {
    clear_audit_sync_pending,
    is_fetch_network_error,
    mark_audit_sync_pending,
    notify_network_unreachable_for_sync
} from '../logic/connectivity_service.js';
import { consoleManager } from '../utils/console_manager.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import { show_audit_deleted_modal_and_navigate } from '../logic/audit_deleted_modal_flow.js';
import { get_current_user_name } from '../utils/helpers.js';
import { resolve_version_conflict_notice } from '../logic/version_conflict_notice.js';
import { should_show_audit_collaboration_notice, update_baseline_from_server_full_state } from '../logic/audit_collaboration_notice.js';
import { count_stuck_in_samples } from '../../shared/audit/audit_metrics.js';
import { state_to_import, state_to_patch } from './sync_payload_mapper.js';
import { broadcast_audit_updated } from './sync_broadcast.js';
import { is_debug_stuck_sync } from '../app/runtime_flags.js';

let debounce_timer = null;
let audit_sync_tail = Promise.resolve();
const DEBOUNCE_MS = 500;

/** Ser till att audit-PATCH inte körs parallellt med samma förväntade version. */
function enqueue_audit_sync(fn) {
    const next = audit_sync_tail.then(() => fn());
    audit_sync_tail = next.catch(() => {});
    return next;
}

async function run_sync(state, dispatch_fn) {
    if (!state || !state.ruleFileContent || typeof window === 'undefined') return;
    if (state.auditStatus === 'rulefile_editing') return;
    let token_present = false;
    let token_read_error = null;
    try {
        token_present = typeof get_auth_token === 'function' && !!get_auth_token();
    } catch (token_err) {
        token_read_error = String(token_err?.message || token_err);
    }
    if (token_read_error || !token_present) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        mark_audit_sync_pending();
        notify_network_unreachable_for_sync();
        return;
    }

    try {
        if (state.auditId) {
            const patch = state_to_patch(state);
            const prev_log = Array.isArray(state.auditMetadata?.audit_edit_log) ? state.auditMetadata.audit_edit_log : [];
            const entry = { at: new Date().toISOString(), auditStatus: state.auditStatus };
            patch.metadata = {
                ...(patch.metadata || {}),
                audit_edit_log: [...prev_log, entry].slice(-400)
            };
            const stuck_count = count_stuck_in_samples(patch.samples);
            if (is_debug_stuck_sync()) {
                consoleManager.log('[GV-Debug] run_sync: skickar PATCH till servern,', stuck_count, 'kört-fast i payload, auditId:', state.auditId);
            }
            const full_state = await update_audit(state.auditId, patch);
            if (is_debug_stuck_sync()) {
                consoleManager.log('[GV-Debug] run_sync: PATCH lyckades, version:', full_state?.version);
            }
            update_baseline_from_server_full_state(full_state);
            broadcast_audit_updated(state.auditId);
            if (dispatch_fn && full_state && full_state.version !== null && full_state.version !== undefined) {
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
            clear_audit_sync_pending();
        } else {
            const import_payload = state_to_import(state);
            const prev_log_i = Array.isArray(state.auditMetadata?.audit_edit_log) ? state.auditMetadata.audit_edit_log : [];
            const entry_i = { at: new Date().toISOString(), auditStatus: state.auditStatus };
            import_payload.auditMetadata = {
                ...(import_payload.auditMetadata || {}),
                audit_edit_log: [...prev_log_i, entry_i].slice(-400)
            };
            const full_state = await import_audit(import_payload);
            broadcast_audit_updated(full_state?.auditId);
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
                    dispatch_fn({
                        type: 'UPDATE_METADATA',
                        payload: {
                            audit_edit_log: import_payload.auditMetadata.audit_edit_log,
                            skip_server_sync: true
                        }
                    });
                }, 0);
            }
            clear_audit_sync_pending();
        }
    } catch (err) {
        if (is_debug_stuck_sync()) {
            console.warn('[GV-Debug] run_sync: PATCH misslyckades', err?.message || err, err);
        }
        if (is_fetch_network_error(err)) {
            mark_audit_sync_pending();
            notify_network_unreachable_for_sync();
            return;
        }
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
            clear_audit_sync_pending();
        } else if (err.status === 409 && state.auditId && dispatch_fn && !err.existingAuditId) {
            try {
                const full_state = await load_audit_with_rule_file(state.auditId);
                if (full_state) {
                    // Konflikt: servern har nyare version än vår expectedVersion.
                    // Vi försöker en gång till med serverns version som expectedVersion så att lokala ändringar
                    // (t.ex. redigerade stickprov) inte tyst försvinner.
                    try {
                        const retry_patch = state_to_patch(state);
                        retry_patch.expectedVersion = Number(full_state.version ?? 0);
                        const prev_log_retry = Array.isArray(state.auditMetadata?.audit_edit_log) ? state.auditMetadata.audit_edit_log : [];
                        const entry_retry = { at: new Date().toISOString(), auditStatus: state.auditStatus };
                        retry_patch.metadata = {
                            ...(retry_patch.metadata || {}),
                            audit_edit_log: [...prev_log_retry, entry_retry].slice(-400)
                        };
                        const updated_state = await update_audit(state.auditId, retry_patch);
                        update_baseline_from_server_full_state(updated_state);
                        dispatch_fn({
                            type: 'SET_REMOTE_AUDIT_ID',
                            payload: {
                                auditId: state.auditId,
                                ruleSetId: state.ruleSetId ?? updated_state.ruleSetId ?? null,
                                version: updated_state.version ?? null,
                                skip_render: true
                            }
                        });
                        dispatch_fn({
                            type: 'UPDATE_METADATA',
                            payload: {
                                audit_edit_log: retry_patch.metadata.audit_edit_log,
                                skip_server_sync: true
                            }
                        });
                        clear_audit_sync_pending();
                        return;
                    } catch (retry_err) {
                        // Retry misslyckades – fall tillbaka till att ladda serverns state och visa konflikt-notis.
                        consoleManager.warn('[ServerSync] Versionkonflikt kvarstår efter retry:', retry_err?.message || retry_err);
                    }

                    dispatch_fn({
                        type: 'REPLACE_STATE_FROM_REMOTE',
                        payload: {
                            ...full_state,
                            saveFileVersion: full_state.saveFileVersion || '2.1.0'
                        }
                    });
                    clear_audit_sync_pending();
                    const notice = resolve_version_conflict_notice(err, get_current_user_name());
                    const should_notice = notice && should_show_audit_collaboration_notice({ local_state: state, remote_state: full_state });
                    if (should_notice && app_runtime_refs.notification_component?.show_global_message && window.Translation?.t) {
                        const t = window.Translation.t;
                        const msg = notice.params ? t(notice.key, notice.params) : t(notice.key);
                        app_runtime_refs.notification_component.show_global_message(msg, 'info');
                    }
                    update_baseline_from_server_full_state(full_state);
                } else if (app_runtime_refs.notification_component?.show_global_message && window.Translation?.t) {
                    mark_audit_sync_pending();
                    app_runtime_refs.notification_component.show_global_message(
                        window.Translation.t('server_sync_error', { message: err.message }) || err.message,
                        'warning'
                    );
                }
            } catch (load_err) {
                if (is_fetch_network_error(load_err)) {
                    mark_audit_sync_pending();
                    notify_network_unreachable_for_sync();
                } else if (app_runtime_refs.notification_component?.show_global_message && window.Translation?.t) {
                    mark_audit_sync_pending();
                    app_runtime_refs.notification_component.show_global_message(
                        window.Translation.t('server_sync_error', { message: err.message }) || err.message,
                        'warning'
                    );
                }
            }
        } else if (err.status === 404 && err.message && err.message.toLowerCase().includes('granskning hittades inte')) {
            show_audit_deleted_modal_and_navigate();
        } else if (err.status === 401) {
            /* Ingen kö – användaren måste logga in på nytt */
        } else {
            mark_audit_sync_pending();
            if (app_runtime_refs.notification_component?.show_global_message && window.Translation?.t) {
                app_runtime_refs.notification_component.show_global_message(
                    window.Translation.t('server_sync_error', { message: err.message }) || `Kunde inte spara till servern: ${err.message}`,
                    'error'
                );
            }
        }
    }
}

export function schedule_sync_to_server(state, dispatch_fn) {
    if (!state) return;
    if (!state.ruleFileContent) return;
    if (typeof window === 'undefined') return;
    if (state.auditStatus === 'rulefile_editing') return;

    if (debounce_timer) clearTimeout(debounce_timer);
    debounce_timer = setTimeout(() => {
        debounce_timer = null;
        void enqueue_audit_sync(() => run_sync(state, dispatch_fn));
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
        await enqueue_audit_sync(() => run_sync(state, dispatch_fn));
    }
}

/**
 * Kör omedelbar sync till server (t.ex. vid navigering bort från granskning eller efter sparning av kört fast-text).
 * Rensar väntande debounce och sparar aktuell state direkt.
 */
export async function flush_sync_to_server(get_state_fn, dispatch_fn) {
    if (debounce_timer) {
        clearTimeout(debounce_timer);
        debounce_timer = null;
    }
    const state = typeof get_state_fn === 'function' ? get_state_fn() : null;
    if (!state) return;
    // För helt nya granskningar (status not_started utan remote auditId) ska server-sync
    // endast ske via explicita anrop (t.ex. från metadata-flödet), inte vid generell navigering.
    if (state.auditStatus === 'not_started' && !state.auditId) return;
    await enqueue_audit_sync(() => run_sync(state, dispatch_fn));
}

