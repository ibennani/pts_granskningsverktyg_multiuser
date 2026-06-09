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
        if (minTime) newState.startTime = minTime;
        if (maxTime) newState.endTime = maxTime;
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

export function requirement_results_equal_for_last_updated(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    let ca: Record<string, unknown>;
    let cb: Record<string, unknown>;
    try {
        ca = JSON.parse(JSON.stringify(a)) as Record<string, unknown>;
        cb = JSON.parse(JSON.stringify(b)) as Record<string, unknown>;
    } catch {
        return false;
    }
    delete ca.lastStatusUpdate;
    delete ca.lastStatusUpdateBy;
    delete cb.lastStatusUpdate;
    delete cb.lastStatusUpdateBy;
    return JSON.stringify(ca) === JSON.stringify(cb);
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
