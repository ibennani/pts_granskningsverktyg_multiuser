/**
 * @fileoverview Best-effort serversynk vid stängd flik via fetch keepalive.
 */

import { get_auth_token, api_patch_keepalive } from '../api/client.js';
import {
    peek_audit_sync_strategy,
    should_include_rule_file_in_patch,
    type AuditSyncStrategy
} from './audit_sync_planning.js';
import {
    state_to_metadata_patch,
    state_to_patch,
    type SyncPayloadState
} from './sync_payload_mapper.js';

/** Chrome/Firefox-gräns för keepalive-request body (ca 64 KiB). */
export const KEEPALIVE_BODY_MAX_BYTES = 64000;

function append_audit_edit_log_to_patch_metadata(
    patch_metadata: Record<string, unknown>,
    state: SyncPayloadState
): Record<string, unknown> {
    const prev_log = Array.isArray(state.auditMetadata?.audit_edit_log)
        ? state.auditMetadata.audit_edit_log
        : [];
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
    const sample = (state.samples || []).find(
        (s) => String((s as { id?: string }).id) === String(sample_id)
    );
    if (!sample || typeof sample !== 'object') return null;
    const results = (sample as { requirementResults?: Record<string, unknown> }).requirementResults;
    if (!results || typeof results !== 'object') return null;
    const result = results[requirement_id];
    if (!result || typeof result !== 'object') return null;
    return result as Record<string, unknown>;
}

function send_keepalive_patch(path: string, body: Record<string, unknown>): boolean {
    const body_json = JSON.stringify(body);
    if (body_json.length > KEEPALIVE_BODY_MAX_BYTES) return false;
    return api_patch_keepalive(path, body);
}

function send_single_requirement_keepalive(
    state: SyncPayloadState,
    strategy: Extract<AuditSyncStrategy, { mode: 'single_requirement' }>
): boolean {
    if (!state.auditId) return false;
    const result = find_requirement_result_in_state(
        state,
        strategy.sample_id,
        strategy.requirement_id
    );
    if (!result) return false;
    const version = Number(state.version ?? 0);
    return send_keepalive_patch(
        `/audits/${state.auditId}/results/${strategy.sample_id}/${strategy.requirement_id}`,
        { version, result }
    );
}

function send_metadata_keepalive(state: SyncPayloadState): boolean {
    if (!state.auditId) return false;
    const patch = state_to_metadata_patch(state);
    patch.metadata = append_audit_edit_log_to_patch_metadata(
        (patch.metadata || {}) as Record<string, unknown>,
        state
    );
    return send_keepalive_patch(`/audits/${state.auditId}`, patch as unknown as Record<string, unknown>);
}

function send_full_patch_keepalive(state: SyncPayloadState): boolean {
    if (!state.auditId) return false;
    const include_rule = should_include_rule_file_in_patch(state.ruleFileContent);
    const patch = state_to_patch(state, { include_rule_file_content: include_rule });
    patch.metadata = append_audit_edit_log_to_patch_metadata(
        (patch.metadata || {}) as Record<string, unknown>,
        state
    );
    if (send_keepalive_patch(`/audits/${state.auditId}`, patch as unknown as Record<string, unknown>)) {
        return true;
    }
    if (include_rule) {
        const without_rule = state_to_patch(state, { include_rule_file_content: false });
        without_rule.metadata = patch.metadata;
        return send_keepalive_patch(
            `/audits/${state.auditId}`,
            without_rule as unknown as Record<string, unknown>
        );
    }
    return false;
}

/**
 * Skickar PATCH med keepalive så requesten kan överleva stängd flik.
 * @returns true om en keepalive-begäran skickades
 */
export function send_audit_sync_keepalive(state: SyncPayloadState | null | undefined): boolean {
    if (!state || !state.ruleFileContent || typeof window === 'undefined') return false;
    if (state.auditStatus === 'rulefile_editing') return false;
    if (state.auditStatus === 'not_started' && !state.auditId) return false;
    if (!state.auditId) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    try {
        if (typeof get_auth_token !== 'function' || !get_auth_token()) return false;
    } catch {
        return false;
    }

    const strategy = peek_audit_sync_strategy();
    if (strategy.mode === 'single_requirement') {
        return send_single_requirement_keepalive(state, strategy);
    }
    if (strategy.mode === 'metadata_only') {
        return send_metadata_keepalive(state);
    }
    return send_full_patch_keepalive(state);
}
