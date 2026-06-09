/**
 * @fileoverview Förbereder audit-serversynk: hoppar över onödig synk och justerar versionsnummer mot servern.
 */

import { get_audit_version, load_audit_with_rule_file } from '../api/client.js';
import { clear_audit_sync_pending } from '../logic/connectivity_service.js';
import {
    has_unsynced_local_audit_changes,
    should_push_local_audit_to_server,
    type AuditStateLike
} from '../logic/audit_sync_tracking.js';
import { update_baseline_from_server_full_state } from '../logic/audit_collaboration_notice.js';
import {
    has_pending_audit_sync_plan,
    is_force_full_sync_pending,
    mark_rule_file_synced_from_state
} from './audit_sync_planning.js';
import type { SyncPayloadState } from './sync_payload_mapper.js';

type DispatchFn = (action: { type: string; payload?: Record<string, unknown> }) => void;

export type AuditSyncPrepareResult =
    | { action: 'skip'; reason: string }
    | { action: 'reload' }
    | { action: 'proceed'; state: SyncPayloadState };

function dispatch_replace_state_from_remote(
    dispatch_fn: DispatchFn | undefined,
    full_state: Record<string, unknown>
): void {
    if (!dispatch_fn) return;
    dispatch_fn({
        type: 'REPLACE_STATE_FROM_REMOTE',
        payload: {
            ...full_state,
            saveFileVersion: full_state.saveFileVersion || '2.1.0'
        }
    });
}

async function apply_remote_state_when_server_ahead(
    state: SyncPayloadState,
    dispatch_fn: DispatchFn | undefined,
    audit_state: AuditStateLike,
    remote_version: number,
    unsynced: boolean,
    prefer_local_full_push: boolean
): Promise<'reload' | 'proceed' | null> {
    const full_state = (await load_audit_with_rule_file(state.auditId!)) as Record<string, unknown> | null;
    if (!full_state) return null;

    const should_push = should_push_local_audit_to_server(audit_state, full_state as AuditStateLike);

    // Lokalt innehåll är nyare eller hel-PATCH väntar — skriv aldrig över med serverkopia.
    if (prefer_local_full_push || should_push) {
        if (dispatch_fn) {
            dispatch_fn({
                type: 'SET_REMOTE_AUDIT_ID',
                payload: {
                    auditId: state.auditId,
                    ruleSetId: state.ruleSetId ?? null,
                    version: remote_version,
                    skip_render: true
                }
            });
        }
        return 'proceed';
    }

    dispatch_replace_state_from_remote(dispatch_fn, full_state);
    update_baseline_from_server_full_state(full_state);
    mark_rule_file_synced_from_state(full_state.ruleFileContent);
    clear_audit_sync_pending();
    return 'reload';
}

/** Justerar versionsnummer eller laddar om när inget ska synkas men servern ligger före. */
async function align_stale_version_without_sync(
    state: SyncPayloadState,
    dispatch_fn: DispatchFn | undefined,
    audit_state: AuditStateLike
): Promise<'reload' | 'aligned' | 'unchanged'> {
    if (!state.auditId) return 'unchanged';
    try {
        const { version: remote_version_raw } = (await get_audit_version(state.auditId)) as {
            version?: number | null;
        };
        const local_version = Number(state.version ?? 0);
        const remote_version = Number(remote_version_raw ?? Number.NaN);
        if (!Number.isFinite(remote_version) || remote_version <= local_version) {
            return 'unchanged';
        }
        const outcome = await apply_remote_state_when_server_ahead(
            state,
            dispatch_fn,
            audit_state,
            remote_version,
            false,
            false
        );
        if (outcome === 'reload') return 'reload';
        return 'aligned';
    } catch {
        return 'unchanged';
    }
}

/**
 * Avgör om synk behövs och synkar lokalt versionsnummer innan PATCH skickas.
 */
export async function prepare_audit_sync_state(
    state: SyncPayloadState,
    dispatch_fn: DispatchFn | undefined
): Promise<AuditSyncPrepareResult> {
    if (!state.auditId) {
        return { action: 'proceed', state };
    }

    const audit_state = state as AuditStateLike;
    const pending_plan = has_pending_audit_sync_plan();
    const unsynced = has_unsynced_local_audit_changes(audit_state);

    if (!unsynced && !pending_plan) {
        const aligned = await align_stale_version_without_sync(state, dispatch_fn, audit_state);
        if (aligned === 'reload') {
            return { action: 'reload' };
        }
        return { action: 'skip', reason: 'Inget att synka till servern' };
    }

    try {
        const { version: remote_version_raw } = (await get_audit_version(state.auditId)) as {
            version?: number | null;
        };
        const local_version = Number(state.version ?? 0);
        const remote_version = Number(remote_version_raw ?? Number.NaN);

        if (!Number.isFinite(remote_version) || remote_version <= local_version) {
            return { action: 'proceed', state };
        }

        const prefer_local_full_push = is_force_full_sync_pending();
        const outcome = await apply_remote_state_when_server_ahead(
            state,
            dispatch_fn,
            audit_state,
            remote_version,
            unsynced,
            prefer_local_full_push
        );
        if (outcome === 'reload') {
            return { action: 'reload' };
        }
        if (outcome === 'proceed') {
            return {
                action: 'proceed',
                state: { ...state, version: remote_version }
            };
        }
        return { action: 'proceed', state };
    } catch {
        return { action: 'proceed', state };
    }
}
