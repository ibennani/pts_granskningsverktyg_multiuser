/**
 * @fileoverview Debouncad serversynk för granskningar (PATCH / import).
 */

import { execute_audit_server_sync } from './audit_sync_execute.js';
import {
    log_krav_vy_sync_skipped,
    peek_krav_vy_sync_flow
} from '../components/requirement_audit/krav_vy_knapp_debug_log.js';

type DispatchFn = (action: { type: string; payload?: Record<string, unknown> }) => void;

type SyncPayloadState = {
    auditId?: string;
    auditStatus?: string;
    ruleFileContent?: unknown;
};

let debounce_timer: ReturnType<typeof setTimeout> | null = null;
let audit_sync_tail: Promise<unknown> = Promise.resolve();
const DEBOUNCE_MS = 500;

function enqueue_audit_sync(fn: () => Promise<void>): Promise<void> {
    const next = audit_sync_tail.then(() => fn());
    audit_sync_tail = next.catch(() => {});
    return next;
}

/**
 * @param get_state_fn Returnerar aktuellt state (t.ex. getState).
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
            return s ? execute_audit_server_sync(s, dispatch_fn) : Promise.resolve();
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
        return st ? execute_audit_server_sync(st, dispatch_fn) : Promise.resolve();
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
        if (st.auditStatus === 'not_started' && !st.auditId) {
            const flow_id = peek_krav_vy_sync_flow();
            if (flow_id) {
                log_krav_vy_sync_skipped(flow_id, 'Granskningen har inte startats på servern — synkas inte', {
                    auditStatus: st.auditStatus
                });
            }
            return Promise.resolve();
        }
        return execute_audit_server_sync(st, dispatch_fn);
    });
}
