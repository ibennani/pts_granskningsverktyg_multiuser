/**
 * @fileoverview Snabb kravnavigering: hoppa över onödig synk och synka i bakgrund vid ändringar.
 */

import {
    has_unsynced_local_audit_changes,
    is_requirement_result_synced_with_server,
    type AuditStateLike
} from './audit_sync_tracking.js';
import {
    clear_pending_requirement_sync,
    has_pending_audit_sync_plan
} from '../sync/audit_sync_planning.js';
import type { AuditSyncPrepareOptions } from '../sync/audit_sync_prepare.js';

type DispatchFn = (action: { type: string; payload?: Record<string, unknown> }) => void;

type ConsoleManagerLike = {
    warn: (message: string, ...args: unknown[]) => void;
};

export type FlushSyncToServerFn = (
    get_state_fn: () => AuditStateLike | null | undefined,
    dispatch_fn: DispatchFn,
    options?: AuditSyncPrepareOptions
) => Promise<void>;

/** Synk vid kravnavigering utan versionskontroll mot servern. */
export const REQUIREMENT_NAV_SYNC_OPTIONS: AuditSyncPrepareOptions = {
    skip_version_probe: true
};

/**
 * Tar bort redan synkat krav från väntande synkplan vid navigering bort från kravet.
 */
export function prune_synced_leaving_requirement_from_pending_plan(
    state: AuditStateLike | null | undefined,
    prev_sample_id: string | undefined,
    prev_requirement_id: string | undefined
): void {
    if (!state || !prev_sample_id || !prev_requirement_id) return;
    if (is_requirement_result_synced_with_server(state, prev_sample_id, prev_requirement_id)) {
        clear_pending_requirement_sync(prev_sample_id, prev_requirement_id);
    }
}

/** Om serversynk behövs innan eller under kravnavigering. */
export function requirement_nav_needs_server_sync(state: AuditStateLike | null | undefined): boolean {
    if (!state) return false;
    return has_unsynced_local_audit_changes(state) || has_pending_audit_sync_plan();
}

/**
 * Synkar till server i bakgrund vid kravnavigering (enkelkrav-PATCH när planen tillåter).
 */
export function schedule_background_sync_on_requirement_nav(
    flush_sync_to_server: FlushSyncToServerFn,
    get_state_fn: () => AuditStateLike | null | undefined,
    dispatch_fn: DispatchFn,
    console_manager: ConsoleManagerLike
): void {
    void flush_sync_to_server(get_state_fn, dispatch_fn, REQUIREMENT_NAV_SYNC_OPTIONS).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console_manager.warn('[Main.js] flush_sync_to_server (kravnavigering i bakgrund):', message);
    });
}
