/**
 * @fileoverview Debouncad serversynk för granskningar (PATCH / import).
 */

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
import { state_to_import, state_to_patch, type SyncPayloadState } from './sync_payload_mapper.js';
import { broadcast_audit_updated } from './sync_broadcast.js';
import { is_debug_stuck_sync } from '../app/runtime_flags.js';

type DispatchFn = (action: { type: string; payload?: Record<string, unknown> }) => void;

type ApiError = Error & {
    status?: number;
    existingAuditId?: string;
    message: string;
};

function is_api_error(e: unknown): e is ApiError {
    return e instanceof Error;
}

type NotificationLike = { show_global_message?: (msg: string, level: string) => void };

function get_notification_component(): NotificationLike | undefined {
    return app_runtime_refs.notification_component as unknown as NotificationLike | undefined;
}

let debounce_timer: ReturnType<typeof setTimeout> | null = null;
let audit_sync_tail: Promise<unknown> = Promise.resolve();
const DEBOUNCE_MS = 500;

function enqueue_audit_sync(fn: () => Promise<void>): Promise<void> {
    const next = audit_sync_tail.then(() => fn());
    audit_sync_tail = next.catch(() => {});
    return next;
}

async function run_sync(state: SyncPayloadState | null | undefined, dispatch_fn: DispatchFn | undefined) {
    if (!state || !state.ruleFileContent || typeof window === 'undefined') return;
    if (state.auditStatus === 'rulefile_editing') return;
    let token_present = false;
    let token_read_error: string | null = null;
    try {
        token_present = typeof get_auth_token === 'function' && !!get_auth_token();
    } catch (token_err: unknown) {
        token_read_error = String((token_err as Error)?.message || token_err);
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
            const stuck_count = count_stuck_in_samples(patch.samples as unknown[]);
            if (is_debug_stuck_sync()) {
                consoleManager.log(
                    '[GV-Debug] run_sync: skickar PATCH till servern,',
                    stuck_count,
                    'kört-fast i payload, auditId:',
                    state.auditId
                );
            }
            const full_state = (await update_audit(state.auditId, patch)) as Record<string, unknown>;
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
            const full_state = (await import_audit(import_payload)) as Record<string, unknown> & { auditId?: string };
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
    } catch (err: unknown) {
        if (is_debug_stuck_sync()) {
            console.warn('[GV-Debug] run_sync: PATCH misslyckades', is_api_error(err) ? err.message : err, err);
        }
        if (is_fetch_network_error(err)) {
            mark_audit_sync_pending();
            notify_network_unreachable_for_sync();
            return;
        }
        const e = err as ApiError;
        if (e.status === 409 && e.existingAuditId && dispatch_fn) {
            dispatch_fn({
                type: 'SET_REMOTE_AUDIT_ID',
                payload: {
                    auditId: e.existingAuditId,
                    ruleSetId: null,
                    version: null,
                    skip_render: true
                }
            });
            clear_audit_sync_pending();
        } else if (e.status === 409 && state.auditId && dispatch_fn && !e.existingAuditId) {
            try {
                const full_state = (await load_audit_with_rule_file(state.auditId)) as Record<string, unknown> | null;
                if (full_state) {
                    try {
                        const retry_patch = state_to_patch(state);
                        retry_patch.expectedVersion = Number(full_state.version ?? 0);
                        const prev_log_retry = Array.isArray(state.auditMetadata?.audit_edit_log)
                            ? state.auditMetadata.audit_edit_log
                            : [];
                        const entry_retry = { at: new Date().toISOString(), auditStatus: state.auditStatus };
                        retry_patch.metadata = {
                            ...(retry_patch.metadata || {}),
                            audit_edit_log: [...prev_log_retry, entry_retry].slice(-400)
                        };
                        const updated_state = (await update_audit(state.auditId, retry_patch)) as Record<string, unknown>;
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
                    } catch (retry_err: unknown) {
                        consoleManager.warn(
                            '[ServerSync] Versionkonflikt kvarstår efter retry:',
                            is_api_error(retry_err) ? retry_err.message : retry_err
                        );
                    }

                    dispatch_fn({
                        type: 'REPLACE_STATE_FROM_REMOTE',
                        payload: {
                            ...full_state,
                            saveFileVersion: full_state.saveFileVersion || '2.1.0'
                        }
                    });
                    clear_audit_sync_pending();
                    const notice = resolve_version_conflict_notice(
                        e as { lastUpdatedBy?: string | null },
                        get_current_user_name()
                    );
                    const should_notice =
                        notice && should_show_audit_collaboration_notice({ local_state: state, remote_state: full_state });
                    const notif = get_notification_component();
                    if (should_notice && notif?.show_global_message && window.Translation?.t) {
                        const t = window.Translation.t;
                        const msg = notice.params ? t(notice.key, notice.params) : t(notice.key);
                        notif.show_global_message(msg, 'info');
                    }
                    update_baseline_from_server_full_state(full_state);
                } else if (window.Translation?.t) {
                    const nc = get_notification_component();
                    if (nc?.show_global_message) {
                        mark_audit_sync_pending();
                        nc.show_global_message(
                            window.Translation.t('server_sync_error', { message: e.message }) || e.message,
                            'warning'
                        );
                    }
                }
            } catch (load_err: unknown) {
                if (is_fetch_network_error(load_err)) {
                    mark_audit_sync_pending();
                    notify_network_unreachable_for_sync();
                } else if (window.Translation?.t) {
                    const nc2 = get_notification_component();
                    if (nc2?.show_global_message) {
                        mark_audit_sync_pending();
                        const le = load_err as Error;
                        nc2.show_global_message(
                            window.Translation.t('server_sync_error', { message: le.message }) || le.message,
                            'warning'
                        );
                    }
                }
            }
        } else if (
            e.status === 404 &&
            e.message &&
            e.message.toLowerCase().includes('granskning hittades inte')
        ) {
            show_audit_deleted_modal_and_navigate();
        } else if (e.status === 401) {
            /* Ingen kö – användaren måste logga in på nytt */
        } else {
            mark_audit_sync_pending();
            if (window.Translation?.t) {
                const nc3 = get_notification_component();
                if (nc3?.show_global_message) {
                    nc3.show_global_message(
                        window.Translation.t('server_sync_error', { message: e.message }) ||
                            `Kunde inte spara till servern: ${e.message}`,
                        'error'
                    );
                }
            }
        }
    }
}

/**
 * @param get_state_fn Returnerar aktuellt state (t.ex. getState).
 *        Viktigt: vid varje köad körning läses state om så expectedVersion följer lyckade PATCH:ar i samma kö.
 */
export function schedule_sync_to_server(
    get_state_fn: () => SyncPayloadState | null | undefined,
    dispatch_fn: DispatchFn
) {
    const state_now = typeof get_state_fn === 'function' ? get_state_fn() : null;
    if (!state_now || !state_now.ruleFileContent) return;
    if (typeof window === 'undefined') return;
    if (state_now.auditStatus === 'rulefile_editing') return;

    if (debounce_timer) clearTimeout(debounce_timer);
    debounce_timer = setTimeout(() => {
        debounce_timer = null;
        void enqueue_audit_sync(() => {
            const s = typeof get_state_fn === 'function' ? get_state_fn() : null;
            return run_sync(s, dispatch_fn);
        });
    }, DEBOUNCE_MS);
}

export async function sync_to_server_now(
    get_state_fn: () => SyncPayloadState | null | undefined,
    dispatch_fn: DispatchFn
) {
    if (debounce_timer) {
        clearTimeout(debounce_timer);
        debounce_timer = null;
    }
    await enqueue_audit_sync(() => {
        const st = typeof get_state_fn === 'function' ? get_state_fn() : null;
        return st ? run_sync(st, dispatch_fn) : Promise.resolve();
    });
}

export async function flush_sync_to_server(
    get_state_fn: () => SyncPayloadState | null | undefined,
    dispatch_fn: DispatchFn
) {
    if (debounce_timer) {
        clearTimeout(debounce_timer);
        debounce_timer = null;
    }
    await enqueue_audit_sync(() => {
        const st = typeof get_state_fn === 'function' ? get_state_fn() : null;
        if (!st) return Promise.resolve();
        if (st.auditStatus === 'not_started' && !st.auditId) return Promise.resolve();
        return run_sync(st, dispatch_fn);
    });
}
