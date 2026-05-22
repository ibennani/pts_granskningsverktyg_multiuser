/**
 * @fileoverview Kör audit-serversynk (hel PATCH eller ett kravresultat).
 */

import {
    update_audit,
    import_audit,
    load_audit_with_rule_file,
    get_auth_token,
    get_audit_version,
    patch_requirement_result
} from '../api/client.js';
import {
    clear_audit_sync_pending,
    is_fetch_network_error,
    mark_audit_sync_pending,
    notify_network_unreachable_for_sync,
    refresh_connectivity_banner
} from '../logic/connectivity_service.js';
import {
    build_last_server_sync_metadata_patch,
    should_push_local_audit_to_server,
    type AuditStateLike
} from '../logic/audit_sync_tracking.js';
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
import {
    log_krav_vy_sync_fel,
    log_krav_vy_sync_skipped,
    log_krav_vy_sync_slut,
    log_krav_vy_sync_start,
    peek_krav_vy_sync_flow
} from '../components/requirement_audit/krav_vy_knapp_debug_log.js';
import {
    mark_rule_file_synced_from_state,
    note_audit_full_sync_required,
    resolve_audit_sync_strategy,
    should_include_rule_file_in_patch,
    type AuditSyncStrategy
} from './audit_sync_planning.js';

type DispatchFn = (action: { type: string; payload?: Record<string, unknown> }) => void;

type KravVySyncTracker = {
    flow_id: string | null;
    settled: boolean;
};

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

function create_krav_vy_sync_tracker(): KravVySyncTracker {
    return { flow_id: peek_krav_vy_sync_flow(), settled: false };
}

function krav_vy_sync_start(tracker: KravVySyncTracker, extra: Record<string, unknown> = {}): void {
    if (!tracker.flow_id || tracker.settled) return;
    log_krav_vy_sync_start(tracker.flow_id, extra);
}

function krav_vy_sync_slut(tracker: KravVySyncTracker, extra: Record<string, unknown> = {}): void {
    if (!tracker.flow_id || tracker.settled) return;
    log_krav_vy_sync_slut(tracker.flow_id, extra);
    tracker.settled = true;
}

function krav_vy_sync_fel(tracker: KravVySyncTracker, extra: Record<string, unknown> = {}): void {
    if (!tracker.flow_id || tracker.settled) return;
    log_krav_vy_sync_fel(tracker.flow_id, extra);
    tracker.settled = true;
}

function krav_vy_sync_skipped(tracker: KravVySyncTracker, reason: string, extra: Record<string, unknown> = {}): void {
    if (!tracker.flow_id || tracker.settled) return;
    log_krav_vy_sync_skipped(tracker.flow_id, reason, extra);
    tracker.settled = true;
}

function dispatch_replace_state_from_remote(dispatch_fn: DispatchFn | undefined, full_state: Record<string, unknown>) {
    if (!dispatch_fn) return;
    dispatch_fn({
        type: 'REPLACE_STATE_FROM_REMOTE',
        payload: {
            ...full_state,
            saveFileVersion: full_state.saveFileVersion || '2.1.0'
        }
    });
}

function notify_audit_reloaded_from_server(message_key = 'version_conflict_external_update') {
    const notif = get_notification_component();
    if (notif?.show_global_message && window.Translation?.t) {
        const t = window.Translation.t;
        notif.show_global_message(t(message_key) || message_key, 'info');
    }
}

async function reload_local_from_remote_if_server_ahead(
    state: SyncPayloadState,
    dispatch_fn: DispatchFn | undefined
): Promise<boolean> {
    if (!state.auditId) return false;
    try {
        const { version: remote_version } = (await get_audit_version(state.auditId)) as {
            version?: number | null;
        };
        const local_version = Number(state.version ?? 0);
        if (
            remote_version === null ||
            remote_version === undefined ||
            !Number.isFinite(Number(remote_version)) ||
            Number(remote_version) <= local_version
        ) {
            return false;
        }
        const full_state = (await load_audit_with_rule_file(state.auditId)) as Record<string, unknown> | null;
        if (!full_state) return false;
        dispatch_replace_state_from_remote(dispatch_fn, full_state);
        update_baseline_from_server_full_state(full_state);
        mark_rule_file_synced_from_state(full_state.ruleFileContent);
        clear_audit_sync_pending();
        notify_audit_reloaded_from_server();
        return true;
    } catch {
        return false;
    }
}

function record_successful_audit_server_sync(dispatch_fn: DispatchFn | undefined) {
    if (!dispatch_fn) return;
    dispatch_fn({
        type: 'UPDATE_METADATA',
        payload: {
            ...build_last_server_sync_metadata_patch(new Date().toISOString()),
            skip_server_sync: true,
            skip_render: true
        }
    });
    refresh_connectivity_banner();
}

function apply_successful_sync_response(
    state: SyncPayloadState,
    full_state: Record<string, unknown>,
    dispatch_fn: DispatchFn | undefined
) {
    update_baseline_from_server_full_state(full_state);
    mark_rule_file_synced_from_state(full_state.ruleFileContent ?? state.ruleFileContent);
    if (state.auditId) {
        broadcast_audit_updated(state.auditId);
    }
    if (dispatch_fn && full_state.version !== null && full_state.version !== undefined) {
        dispatch_fn({
            type: 'SET_REMOTE_AUDIT_ID',
            payload: {
                auditId: state.auditId ?? full_state.auditId,
                ruleSetId: state.ruleSetId ?? full_state.ruleSetId ?? null,
                version: full_state.version,
                skip_render: true
            }
        });
    }
    record_successful_audit_server_sync(dispatch_fn);
    clear_audit_sync_pending();
}

function append_audit_edit_log_to_patch_metadata(
    patch_metadata: Record<string, unknown>,
    state: SyncPayloadState
): Record<string, unknown> {
    const prev_log = Array.isArray(state.auditMetadata?.audit_edit_log) ? state.auditMetadata.audit_edit_log : [];
    const entry = { at: new Date().toISOString(), auditStatus: state.auditStatus };
    return {
        ...patch_metadata,
        audit_edit_log: [...prev_log, entry].slice(-400)
    };
}

function find_requirement_result_in_state(
    state: SyncPayloadState,
    sample_id: string,
    requirement_id: string
): Record<string, unknown> | null {
    const sample = (state.samples || []).find((s) => String((s as { id?: string }).id) === String(sample_id));
    if (!sample || typeof sample !== 'object') return null;
    const results = (sample as { requirementResults?: Record<string, unknown> }).requirementResults;
    if (!results || typeof results !== 'object') return null;
    const result = results[requirement_id];
    if (!result || typeof result !== 'object') return null;
    return result as Record<string, unknown>;
}

async function sync_single_requirement_result(
    state: SyncPayloadState,
    strategy: Extract<AuditSyncStrategy, { mode: 'single_requirement' }>,
    dispatch_fn: DispatchFn | undefined,
    krav_vy_sync: KravVySyncTracker
): Promise<boolean> {
    const result = find_requirement_result_in_state(state, strategy.sample_id, strategy.requirement_id);
    if (!result || !state.auditId) {
        note_audit_full_sync_required();
        return false;
    }
    const version = Number(state.version ?? 0);
    try {
        const full_state = (await patch_requirement_result(
            state.auditId,
            strategy.sample_id,
            strategy.requirement_id,
            version,
            result
        )) as Record<string, unknown>;
        apply_successful_sync_response(state, full_state, dispatch_fn);
        krav_vy_sync_slut(krav_vy_sync, {
            auditId: state.auditId,
            version: full_state?.version ?? null,
            single_requirement: true
        });
        return true;
    } catch (err: unknown) {
        if (is_debug_stuck_sync()) {
            consoleManager.warn('[ServerSync] Enstaka krav-PATCH misslyckades, fallback till hel PATCH:', err);
        }
        note_audit_full_sync_required();
        return false;
    }
}

async function sync_full_audit_patch(
    state: SyncPayloadState,
    dispatch_fn: DispatchFn | undefined,
    krav_vy_sync: KravVySyncTracker
): Promise<void> {
    if (!state.auditId) return;
    const include_rule = should_include_rule_file_in_patch(state.ruleFileContent);
    const patch = state_to_patch(state, { include_rule_file_content: include_rule });
    patch.metadata = append_audit_edit_log_to_patch_metadata(
        (patch.metadata || {}) as Record<string, unknown>,
        state
    );
    const stuck_count = count_stuck_in_samples(patch.samples as unknown[]);
    if (is_debug_stuck_sync()) {
        consoleManager.log(
            '[GV-Debug] run_sync: skickar PATCH till servern,',
            stuck_count,
            'kört-fast i payload, regelfil med:',
            include_rule,
            'auditId:',
            state.auditId
        );
    }
    const full_state = (await update_audit(state.auditId, patch)) as Record<string, unknown>;
    if (is_debug_stuck_sync()) {
        consoleManager.log('[GV-Debug] run_sync: PATCH lyckades, version:', full_state?.version);
    }
    apply_successful_sync_response(state, full_state, dispatch_fn);
    krav_vy_sync_slut(krav_vy_sync, {
        auditId: state.auditId,
        version: full_state?.version ?? null
    });
}

async function handle_sync_error(
    err: unknown,
    state: SyncPayloadState,
    dispatch_fn: DispatchFn | undefined,
    krav_vy_sync: KravVySyncTracker
): Promise<void> {
    if (is_debug_stuck_sync()) {
        console.warn('[GV-Debug] run_sync: PATCH misslyckades', is_api_error(err) ? err.message : err, err);
    }
    if (is_fetch_network_error(err)) {
        mark_audit_sync_pending();
        notify_network_unreachable_for_sync();
        krav_vy_sync_fel(krav_vy_sync, {
            http_status: null,
            meddelande: is_api_error(err) ? err.message : String(err),
            anledning: 'Nätverksfel'
        });
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
        krav_vy_sync_slut(krav_vy_sync, { auditId: e.existingAuditId, conflict_merge: true });
        return;
    }
    if (e.status === 409 && state.auditId && dispatch_fn && !e.existingAuditId) {
        await handle_version_conflict_409(state, dispatch_fn, e, krav_vy_sync);
        return;
    }
    if (e.status === 404 && e.message?.toLowerCase().includes('granskning hittades inte')) {
        show_audit_deleted_modal_and_navigate();
        krav_vy_sync_fel(krav_vy_sync, {
            http_status: 404,
            meddelande: e.message,
            anledning: 'Granskningen finns inte på servern'
        });
        return;
    }
    if (e.status === 401) {
        krav_vy_sync_skipped(krav_vy_sync, 'Sessionen utgick (401) — synkas inte till servern', { http_status: 401 });
        return;
    }
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
    krav_vy_sync_fel(krav_vy_sync, {
        http_status: e.status ?? null,
        meddelande: e.message,
        anledning: 'API-fel vid serversynk — ändringen kanske inte sparades på servern'
    });
    if (!krav_vy_sync.settled && krav_vy_sync.flow_id) {
        krav_vy_sync_fel(krav_vy_sync, {
            http_status: e.status ?? null,
            meddelande: e.message,
            anledning: 'Ohanterat synkfel — kontrollera om ändringen sparades på servern'
        });
    }
}

async function handle_version_conflict_409(
    state: SyncPayloadState,
    dispatch_fn: DispatchFn,
    e: ApiError,
    krav_vy_sync: KravVySyncTracker
): Promise<void> {
    if (!state.auditId) return;
    try {
        const full_state = (await load_audit_with_rule_file(state.auditId)) as Record<string, unknown> | null;
        if (!full_state) {
            krav_vy_sync_fel(krav_vy_sync, {
                http_status: 409,
                meddelande: e.message,
                anledning: 'Versionskonflikt — kunde inte ladda granskning från servern'
            });
            return;
        }
        if (!should_push_local_audit_to_server(state as AuditStateLike, full_state as AuditStateLike)) {
            dispatch_replace_state_from_remote(dispatch_fn, full_state);
            mark_rule_file_synced_from_state(full_state.ruleFileContent);
            clear_audit_sync_pending();
            notify_audit_reloaded_from_server('version_conflict_external_update');
            update_baseline_from_server_full_state(full_state);
            krav_vy_sync_fel(krav_vy_sync, {
                http_status: 409,
                meddelande: e.message,
                anledning: 'Versionskonflikt — lokal state skrevs om från servern'
            });
            return;
        }
        let retry_error_message: string | null = null;
        try {
            note_audit_full_sync_required();
            const retry_patch = state_to_patch(state, {
                include_rule_file_content: should_include_rule_file_in_patch(state.ruleFileContent)
            });
            retry_patch.expectedVersion = Number(full_state.version ?? 0);
            retry_patch.metadata = append_audit_edit_log_to_patch_metadata(
                (retry_patch.metadata || {}) as Record<string, unknown>,
                state
            );
            const updated_state = (await update_audit(state.auditId, retry_patch)) as Record<string, unknown>;
            apply_successful_sync_response(state, updated_state, dispatch_fn);
            dispatch_fn({
                type: 'UPDATE_METADATA',
                payload: {
                    audit_edit_log: retry_patch.metadata.audit_edit_log,
                    skip_server_sync: true,
                    skip_render: true
                }
            });
            krav_vy_sync_slut(krav_vy_sync, {
                auditId: state.auditId,
                version: updated_state?.version ?? null,
                retry_efter_konflikt: true
            });
            return;
        } catch (retry_err: unknown) {
            consoleManager.warn(
                '[ServerSync] Versionkonflikt kvarstår efter retry:',
                is_api_error(retry_err) ? retry_err.message : retry_err
            );
            retry_error_message = is_api_error(retry_err) ? retry_err.message : String(retry_err);
        }

        dispatch_replace_state_from_remote(dispatch_fn, full_state);
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
        mark_rule_file_synced_from_state(full_state.ruleFileContent);
        krav_vy_sync_fel(krav_vy_sync, {
            http_status: 409,
            meddelande: e.message,
            anledning: 'Versionskonflikt kvar efter retry — lokal state skrevs om från servern',
            retry_err: retry_error_message
        });
    } catch (load_err: unknown) {
        if (is_fetch_network_error(load_err)) {
            mark_audit_sync_pending();
            notify_network_unreachable_for_sync();
            krav_vy_sync_fel(krav_vy_sync, {
                meddelande: is_api_error(load_err) ? load_err.message : String(load_err),
                anledning: 'Nätverksfel vid laddning efter versionskonflikt'
            });
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
            krav_vy_sync_fel(krav_vy_sync, {
                meddelande: is_api_error(load_err) ? load_err.message : String(load_err),
                anledning: 'Kunde inte ladda granskning efter versionskonflikt'
            });
        }
    }
}

/**
 * Synkar aktuellt audit-state till servern.
 */
export async function execute_audit_server_sync(
    state: SyncPayloadState | null | undefined,
    dispatch_fn: DispatchFn | undefined
): Promise<void> {
    const krav_vy_sync = create_krav_vy_sync_tracker();
    if (!state || !state.ruleFileContent || typeof window === 'undefined') return;
    if (state.auditStatus === 'rulefile_editing') {
        krav_vy_sync_skipped(krav_vy_sync, 'Regelfil redigeras — synkas inte till servern');
        return;
    }
    let token_present = false;
    let token_read_error: string | null = null;
    try {
        token_present = typeof get_auth_token === 'function' && !!get_auth_token();
    } catch (token_err: unknown) {
        token_read_error = String((token_err as Error)?.message || token_err);
    }
    if (token_read_error || !token_present) {
        krav_vy_sync_skipped(krav_vy_sync, 'Ingen inloggning — synkas inte till servern', { token_read_error });
        return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        mark_audit_sync_pending();
        notify_network_unreachable_for_sync();
        krav_vy_sync_skipped(krav_vy_sync, 'Offline — synkas inte till servern');
        return;
    }

    krav_vy_sync_start(krav_vy_sync, { auditId: state.auditId ?? null });

    try {
        if (state.auditId) {
            if (await reload_local_from_remote_if_server_ahead(state, dispatch_fn)) {
                krav_vy_sync_skipped(krav_vy_sync, 'Servern hade nyare version — lokal state laddades om');
                return;
            }
            const strategy = resolve_audit_sync_strategy();
            if (strategy.mode === 'single_requirement') {
                const ok = await sync_single_requirement_result(state, strategy, dispatch_fn, krav_vy_sync);
                if (ok) return;
            }
            await sync_full_audit_patch(state, dispatch_fn, krav_vy_sync);
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
                            skip_server_sync: true,
                            skip_render: true
                        }
                    });
                    mark_rule_file_synced_from_state(full_state.ruleFileContent ?? state.ruleFileContent);
                    record_successful_audit_server_sync(dispatch_fn);
                }, 0);
            }
            clear_audit_sync_pending();
            krav_vy_sync_slut(krav_vy_sync, { auditId: full_state?.auditId ?? null, import: true });
        }
    } catch (err: unknown) {
        await handle_sync_error(err, state, dispatch_fn, krav_vy_sync);
    }
}
