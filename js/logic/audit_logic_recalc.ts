/**
 * @fileoverview Omberäkning av statusar/tider vid laddning och aktivitetstidsstämplar.
 */

import {
    traverse_all_pass_criteria,
    traverse_all_check_results,
    traverse_all_requirement_results
} from '../utils/traverse_audit_data.js';
import type { AuditStateShape, CheckResultStored, RequirementDef, RequirementResultStored } from './audit_logic_types.js';
import { find_requirement_definition, get_stored_requirement_result_for_def } from './audit_logic_lookup.js';
import { calculate_check_status, calculate_requirement_status } from './audit_logic_status.js';
import { assignSortedDeficiencyIdsOnLock } from './audit_logic_deficiency.js';
import { find_check_def_by_storage_id } from './entity_id_match.js';
import {
    AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY,
    get_frozen_last_in_progress_activity_at
} from './audit_list_last_updated.js';

export function recalculateStatusesOnLoad(auditState: AuditStateShape | null | undefined): AuditStateShape | null | undefined {
    if (!auditState || !auditState.ruleFileContent || !auditState.samples) {
        return auditState;
    }

    const newState = JSON.parse(JSON.stringify(auditState)) as AuditStateShape;
    const rule_file = newState.ruleFileContent!;

    traverse_all_check_results(newState, ({ sample, req_key, check_key, check_result }) => {
        const requirements = rule_file.requirements;
        if (!requirements) return;
        const reqDef = find_requirement_definition(requirements, req_key);
        if (!reqDef) return;
        const cr = check_result as CheckResultStored;
        const checkDef = find_check_def_by_storage_id(reqDef.checks ?? [], check_key);
        if (!checkDef || !cr) return;

        const recalculatedStatus = calculate_check_status(checkDef, cr.passCriteria, cr.overallStatus);
        cr.status = recalculatedStatus;
    });

    traverse_all_requirement_results(newState, ({ sample, req_key, req_result }) => {
        const requirements = rule_file.requirements;
        if (!requirements) return;
        const reqDef = find_requirement_definition(requirements, req_key);
        if (!reqDef) return;
        const rr =
            get_stored_requirement_result_for_def(
                sample.requirementResults,
                requirements,
                reqDef,
                req_key
            ) ?? (req_result as RequirementResultStored);
        if (!rr?.checkResults) return;

        const recalculatedReqStatus = calculate_requirement_status(reqDef, rr);
        rr.status = recalculatedReqStatus;
    });

    if (newState.auditStatus === 'locked') {
        return assignSortedDeficiencyIdsOnLock(newState);
    }

    return newState;
}

export function recalculateAuditTimes(auditState: AuditStateShape | null | undefined): AuditStateShape | null | undefined {
    if (!auditState || !auditState.samples) {
        return auditState;
    }

    let minTime: string | null = null;
    let maxTime: string | null = null;

    traverse_all_requirement_results(auditState, ({ req_result }) => {
        if (req_result.lastStatusUpdate) {
            const ts = req_result.lastStatusUpdate;
            if (!minTime || ts < minTime) minTime = ts;
            if (!maxTime || ts > maxTime) maxTime = ts;
        }
    });

    traverse_all_check_results(auditState, ({ check_result }) => {
        if (check_result.timestamp) {
            const ts = check_result.timestamp;
            if (!minTime || ts < minTime) minTime = ts;
            if (!maxTime || ts > maxTime) maxTime = ts;
        }
    });

    traverse_all_pass_criteria(auditState, ({ pc_result }) => {
        if (pc_result.timestamp) {
            const ts = pc_result.timestamp;
            if (!minTime || ts < minTime) minTime = ts;
            if (!maxTime || ts > maxTime) maxTime = ts;
        }
    });

    if (minTime || maxTime) {
        const newState = { ...auditState };
        const meta = auditState.auditMetadata as { startTime?: string | null; endTime?: string | null } | undefined;
        const manual_start =
            typeof meta?.startTime === 'string' && meta.startTime.trim()
                ? meta.startTime.trim()
                : null;
        const manual_end =
            typeof meta?.endTime === 'string' && meta.endTime.trim()
                ? meta.endTime.trim()
                : typeof auditState.endTime === 'string' && auditState.endTime.trim()
                    ? auditState.endTime.trim()
                    : null;
        if (manual_start) {
            newState.startTime = manual_start;
        } else if (minTime) {
            newState.startTime = minTime;
        }
        if (manual_end) {
            newState.endTime = manual_end;
        } else if (maxTime) {
            newState.endTime = maxTime;
        }
        return newState;
    }

    return auditState;
}

export function get_last_activity_timestamp(audit_state: AuditStateShape | null | undefined): string | null {
    if (!audit_state || !audit_state.samples) {
        return null;
    }

    let maxTime: string | null = null;

    traverse_all_requirement_results(audit_state, ({ req_result }) => {
        if (req_result.lastStatusUpdate) {
            const ts = req_result.lastStatusUpdate;
            if (!maxTime || ts > maxTime) maxTime = ts;
        }
    });

    traverse_all_check_results(audit_state, ({ check_result }) => {
        if (check_result.timestamp) {
            const ts = check_result.timestamp;
            if (!maxTime || ts > maxTime) maxTime = ts;
        }
    });

    traverse_all_pass_criteria(audit_state, ({ pc_result }) => {
        if (pc_result.timestamp) {
            const ts = pc_result.timestamp;
            if (!maxTime || ts > maxTime) maxTime = ts;
        }
    });

    return maxTime;
}

function normalize_pass_criterion_for_compare(pc: unknown): Record<string, unknown> | null {
    if (pc === null || pc === undefined) return null;
    const status = (typeof pc === 'string' ? pc : (typeof pc === 'object' && pc !== null && 'status' in pc ? (pc as { status?: string }).status : 'not_audited')) || 'not_audited';
    const obs = typeof pc === 'object' && pc !== null && 'observationDetail' in pc && typeof (pc as { observationDetail?: unknown }).observationDetail === 'string'
        ? (pc as { observationDetail: string }).observationDetail.trim()
        : '';
    const ts = typeof pc === 'object' && pc !== null && 'timestamp' in pc && typeof (pc as { timestamp?: unknown }).timestamp === 'string'
        ? (pc as { timestamp: string }).timestamp
        : null;
    const by = typeof pc === 'object' && pc !== null && 'updatedBy' in pc && typeof (pc as { updatedBy?: unknown }).updatedBy === 'string'
        ? (pc as { updatedBy: string }).updatedBy
        : null;
    const media = typeof pc === 'object' && pc !== null && 'attachedMediaFilenames' in pc && Array.isArray((pc as { attachedMediaFilenames?: unknown[] }).attachedMediaFilenames)
        ? (pc as { attachedMediaFilenames: unknown[] }).attachedMediaFilenames.filter(f => typeof f === 'string' && f.trim()).map(f => (f as string).trim()).sort()
        : [];

    if (status === 'not_audited' && !obs && !ts && !by && media.length === 0) {
        return null;
    }

    const norm: Record<string, unknown> = { status };
    if (obs) norm.observationDetail = obs;
    if (ts) norm.timestamp = ts;
    if (by) norm.updatedBy = by;
    if (media.length > 0) norm.attachedMediaFilenames = media;
    return norm;
}

function normalize_check_result_for_compare(check: unknown): Record<string, unknown> | null {
    if (check === null || check === undefined || typeof check !== 'object') return null;
    const c = check as Record<string, unknown>;
    const overall = (typeof c.overallStatus === 'string' ? c.overallStatus : 'not_audited') || 'not_audited';
    const status = (typeof c.status === 'string' ? c.status : 'not_audited') || 'not_audited';
    const ts = typeof c.timestamp === 'string' ? c.timestamp : null;
    const by = typeof c.updatedBy === 'string' ? c.updatedBy : null;

    const pcs: Record<string, unknown> = {};
    if (c.passCriteria && typeof c.passCriteria === 'object') {
        const sortedKeys = Object.keys(c.passCriteria).sort();
        for (const k of sortedKeys) {
            const pcnorm = normalize_pass_criterion_for_compare((c.passCriteria as Record<string, unknown>)[k]);
            if (pcnorm) {
                pcs[k] = pcnorm;
            }
        }
    }

    if (overall === 'not_audited' && status === 'not_audited' && !ts && !by && Object.keys(pcs).length === 0) {
        return null;
    }

    const norm: Record<string, unknown> = { overallStatus: overall, status };
    if (ts) norm.timestamp = ts;
    if (by) norm.updatedBy = by;
    if (Object.keys(pcs).length > 0) norm.passCriteria = pcs;
    return norm;
}

function normalize_requirement_result_for_compare(req: unknown): Record<string, unknown> {
    if (req === null || req === undefined || typeof req !== 'object') return { status: 'not_audited' };
    const r = req as Record<string, unknown>;
    const status = (typeof r.status === 'string' ? r.status : 'not_audited') || 'not_audited';
    const commentAuditor = typeof r.commentToAuditor === 'string' ? r.commentToAuditor.trim() : '';
    const commentActor = typeof r.commentToActor === 'string' ? r.commentToActor.trim() : '';
    const stuck = typeof r.stuckProblemDescription === 'string' ? r.stuckProblemDescription.trim() : '';

    const checks: Record<string, unknown> = {};
    if (r.checkResults && typeof r.checkResults === 'object') {
        const sortedKeys = Object.keys(r.checkResults).sort();
        for (const k of sortedKeys) {
            const cnorm = normalize_check_result_for_compare((r.checkResults as Record<string, unknown>)[k]);
            if (cnorm) {
                checks[k] = cnorm;
            }
        }
    }

    const norm: Record<string, unknown> = { status };
    if (commentAuditor) norm.commentToAuditor = commentAuditor;
    if (commentActor) norm.commentToActor = commentActor;
    if (stuck) norm.stuckProblemDescription = stuck;
    if (Object.keys(checks).length > 0) norm.checkResults = checks;
    return norm;
}

export function requirement_results_equal_for_last_updated(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (!a && !b) return true;
    const na = normalize_requirement_result_for_compare(a);
    const nb = normalize_requirement_result_for_compare(b);
    return JSON.stringify(na) === JSON.stringify(nb);
}

export function compute_audit_last_updated_live_timestamp(audit_state: AuditStateShape | null | undefined): string | null {
    if (!audit_state) return null;
    const from_samples = get_last_activity_timestamp(audit_state);
    const from_non_obs = audit_state.auditLastNonObservationActivityAt || null;
    if (!from_samples && !from_non_obs) return null;
    if (!from_samples) return from_non_obs;
    if (!from_non_obs) return from_samples;
    return from_samples > from_non_obs ? from_samples : from_non_obs;
}

export function get_audit_last_updated_display_timestamp(audit_state: AuditStateShape | null | undefined): string | null {
    if (!audit_state) return null;
    if (audit_state.auditStatus === 'locked' || audit_state.auditStatus === 'archived') {
        const frozen = get_frozen_last_in_progress_activity_at(audit_state);
        if (frozen) return frozen;
    }
    return compute_audit_last_updated_live_timestamp(audit_state);
}

export { AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY };

export {
    clamp_audit_activity_to_end_date,
    count_timestamps_after_end_date,
    is_timestamp_after_end_date,
    total_clamp_count
} from './audit_clamp_activity_to_end_date.js';
