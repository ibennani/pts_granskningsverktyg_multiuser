/**
 * @fileoverview Säkerställer att granskningen har server-id före API-anrop som kräver auditId.
 */
import { get_auth_token } from '../api/client.js';
import { sync_to_server_now } from './server_sync.js';

const AUDIT_ID_POLL_MS = 50;
const AUDIT_ID_POLL_ATTEMPTS = 40;

type AuditIdState = { auditId?: string | null; ruleFileContent?: unknown } | null;

function read_audit_id(state: AuditIdState): string | null {
    const id = state?.auditId;
    return id ? String(id) : null;
}

async function wait_for_audit_id_in_state(
    get_state_fn: () => AuditIdState
): Promise<string | null> {
    for (let attempt = 0; attempt < AUDIT_ID_POLL_ATTEMPTS; attempt += 1) {
        const audit_id = read_audit_id(get_state_fn());
        if (audit_id) return audit_id;
        await new Promise((resolve) => {
            setTimeout(resolve, AUDIT_ID_POLL_MS);
        });
    }
    return read_audit_id(get_state_fn());
}

type EnsureAuditIdDeps = {
    sync_to_server_now?: (
        get_state_fn: () => AuditIdState,
        dispatch_fn: (action: { type: string; payload?: unknown }) => void
    ) => Promise<void>;
    has_auth_token?: () => boolean;
};

export async function ensure_audit_id_for_server_sync(
    get_state_fn: () => AuditIdState,
    dispatch_fn: (action: { type: string; payload?: unknown }) => void,
    deps: EnsureAuditIdDeps = {}
): Promise<string | null> {
    const existing = read_audit_id(get_state_fn());
    if (existing) return existing;

    const has_auth = deps.has_auth_token ?? (() => Boolean(get_auth_token()));
    if (!has_auth()) return null;
    if (!get_state_fn()?.ruleFileContent) return null;

    const sync_now = deps.sync_to_server_now ?? sync_to_server_now;
    try {
        await sync_now(get_state_fn, dispatch_fn);
    } catch {
        return null;
    }

    return wait_for_audit_id_in_state(get_state_fn);
}
