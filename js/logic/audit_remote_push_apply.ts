/**
 * @file Beslut och payload för att applicera fjärr-push av enskilt kravresultat utan full GET.
 */

import {
    has_blocking_non_requirement_sync,
    is_requirement_pending_sync
} from '../sync/audit_sync_planning.js';

export type RemoteRequirementPushDetail = {
    auditId?: string | null;
    changeKind?: string | null;
    version?: number | null;
    sampleId?: string | null;
    requirementId?: string | null;
    result?: Record<string, unknown> | null;
    updatedBy?: string | null;
};

type AuditStateLike = {
    auditId?: string | null;
    version?: number | null;
    samples?: Array<{
        id?: string | number;
        requirementResults?: Record<string, { lastStatusUpdate?: string | null }>;
    }>;
};

function get_local_requirement_result(
    state: AuditStateLike | null | undefined,
    sample_id: string,
    requirement_id: string
): { lastStatusUpdate?: string | null } | null {
    const sample = state?.samples?.find((s) => String(s.id) === String(sample_id));
    const results = sample?.requirementResults;
    if (!results || typeof results !== 'object') return null;
    const local = results[requirement_id];
    return local && typeof local === 'object' ? local : null;
}

function remote_result_is_newer_than_local(
    local_result: { lastStatusUpdate?: string | null } | null,
    remote_result: Record<string, unknown> | null | undefined
): boolean {
    const remote_ts = typeof remote_result?.lastStatusUpdate === 'string' ? remote_result.lastStatusUpdate : null;
    const local_ts = typeof local_result?.lastStatusUpdate === 'string' ? local_result.lastStatusUpdate : null;
    if (remote_ts && local_ts) return remote_ts > local_ts;
    if (remote_ts && !local_ts) return true;
    return !local_ts;
}

/**
 * Om push av enskilt kravresultat ska appliceras lokalt.
 */
export function should_apply_remote_requirement_push(
    local_state: AuditStateLike | null | undefined,
    push: RemoteRequirementPushDetail | null | undefined
): boolean {
    if (!local_state || !push) return false;
    if (push.changeKind !== 'requirement_updated') return false;
    if (!push.auditId || !push.sampleId || !push.requirementId || !push.result) return false;
    if (String(local_state.auditId) !== String(push.auditId)) return false;

    const local_version = local_state.version ?? 0;
    const push_version = push.version ?? 0;
    if (push_version > 0 && push_version <= local_version) {
        return false;
    }

    if (has_blocking_non_requirement_sync()) {
        return false;
    }

    const sample_id = String(push.sampleId);
    const requirement_id = String(push.requirementId);
    const local_result = get_local_requirement_result(local_state, sample_id, requirement_id);

    if (is_requirement_pending_sync(sample_id, requirement_id)) {
        return remote_result_is_newer_than_local(local_result, push.result);
    }

    return true;
}

/**
 * Bygger dispatch-payload för UPDATE_REQUIREMENT_RESULT från push.
 */
export function build_remote_requirement_dispatch_payload(
    push: RemoteRequirementPushDetail
): Record<string, unknown> {
    return {
        sampleId: push.sampleId,
        requirementId: push.requirementId,
        newRequirementResult: push.result,
        skip_server_sync: true,
        from_remote_push: true,
        remote_version: push.version ?? null
    };
}
