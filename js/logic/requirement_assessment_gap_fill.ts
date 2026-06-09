/**
 * @fileoverview Fyller ohanterade kontrollpunkter och kriterier i en kravbedömning:
 * ogranskade kontrollpunkter → inte aktuellt; ogjorda kriterier under Stämmer → ingen anmärkning.
 */

import type {
    CheckDef,
    CheckResultStored,
    PassCriterionStored,
    RequirementDef,
    RequirementResultStored
} from './audit_logic_types.js';
import { calculate_requirement_status } from './audit_logic_status.js';
import { definition_primary_id, resolve_map_entry } from './entity_id_match.js';

export type RequirementAssessmentGapFillStats = {
    checks_set_not_applicable: number;
    pass_criteria_set_passed: number;
    requirements_without_checks_set_passed: number;
};

export function is_unset_requirement_audit_status(status: unknown): boolean {
    return status === undefined || status === null || status === '' || status === 'not_audited';
}

function ensure_check_result(
    check_results: Record<string, CheckResultStored>,
    check_def: CheckDef
): { check_result: CheckResultStored } {
    const primary = definition_primary_id(check_def);
    const resolved = resolve_map_entry(check_results, primary);
    if (resolved) {
        if (!resolved.value.passCriteria) {
            resolved.value.passCriteria = {};
        }
        return { check_result: resolved.value };
    }
    const check_result: CheckResultStored = { passCriteria: {} };
    check_results[primary] = check_result;
    return { check_result };
}

function touch_check_not_applicable(
    check_result: CheckResultStored,
    timestamp: string,
    updated_by: string | undefined
): boolean {
    if (!is_unset_requirement_audit_status(check_result.overallStatus)) {
        return false;
    }
    check_result.overallStatus = 'not_applicable';
    check_result.timestamp = timestamp;
    if (updated_by) {
        check_result.updatedBy = updated_by;
    }
    return true;
}

function touch_pass_criterion_passed(
    check_result: CheckResultStored,
    pc_def: { id?: unknown; key?: unknown },
    timestamp: string,
    updated_by: string | undefined
): boolean {
    const pc_key = definition_primary_id(pc_def);
    const pass_criteria = check_result.passCriteria ?? {};
    check_result.passCriteria = pass_criteria;
    const resolved = resolve_map_entry(pass_criteria, pc_key);
    const existing = resolved?.value;
    const raw_status =
        typeof existing === 'object' && existing !== null
            ? (existing as PassCriterionStored).status
            : undefined;
    if (!is_unset_requirement_audit_status(raw_status)) {
        return false;
    }
    const storage_key = resolved?.storageKey ?? pc_key;
    const next: PassCriterionStored = {
        ...(typeof existing === 'object' && existing !== null ? existing : {}),
        status: 'passed',
        timestamp,
        observationDetail:
            typeof existing === 'object' && existing !== null && existing.observationDetail != null
                ? String(existing.observationDetail)
                : '',
        attachedMediaFilenames: Array.isArray(existing?.attachedMediaFilenames)
            ? existing.attachedMediaFilenames
            : []
    };
    if (updated_by) {
        next.updatedBy = updated_by;
    }
    pass_criteria[storage_key] = next;
    return true;
}

/**
 * Fyller luckor i en befintlig kravbedömning (muterar kopian `req_result`).
 */
export function fill_gaps_in_requirement_result(
    req_def: RequirementDef,
    req_result: RequirementResultStored,
    timestamp: string,
    updated_by: string | undefined,
    stats: RequirementAssessmentGapFillStats
): boolean {
    const checks = req_def.checks ?? [];
    if (checks.length === 0) {
        const stored_status = req_result.status;
        if (!is_unset_requirement_audit_status(stored_status) && stored_status !== 'partially_audited') {
            return false;
        }
        req_result.status = 'passed';
        req_result.lastStatusUpdate = timestamp;
        if (updated_by) {
            req_result.lastStatusUpdateBy = updated_by;
        }
        if (req_result.needsReview === true) {
            delete req_result.needsReview;
        }
        stats.requirements_without_checks_set_passed += 1;
        return true;
    }
    if (!req_result.checkResults) {
        req_result.checkResults = {};
    }
    let changed = false;
    for (const check_def of checks) {
        const { check_result } = ensure_check_result(req_result.checkResults, check_def);
        if (touch_check_not_applicable(check_result, timestamp, updated_by)) {
            stats.checks_set_not_applicable += 1;
            changed = true;
        }
        if (check_result.overallStatus !== 'passed') {
            continue;
        }
        for (const pc_def of check_def.passCriteria ?? []) {
            if (touch_pass_criterion_passed(check_result, pc_def, timestamp, updated_by)) {
                stats.pass_criteria_set_passed += 1;
                changed = true;
            }
        }
    }
    if (changed && req_result.needsReview === true) {
        delete req_result.needsReview;
    }
    return changed;
}

/**
 * Fyller luckor i en kopia av kravresultat och omberäknar kravstatus.
 */
export function build_requirement_result_with_assessment_gaps_filled(
    req_def: RequirementDef,
    existing_result: RequirementResultStored | null | undefined,
    timestamp: string,
    updated_by?: string
): { changed: boolean; result: RequirementResultStored } {
    const stats: RequirementAssessmentGapFillStats = {
        checks_set_not_applicable: 0,
        pass_criteria_set_passed: 0,
        requirements_without_checks_set_passed: 0
    };
    const result = JSON.parse(
        JSON.stringify(existing_result ?? { checkResults: {} })
    ) as RequirementResultStored;
    if (!result.checkResults) {
        result.checkResults = {};
    }
    const changed = fill_gaps_in_requirement_result(req_def, result, timestamp, updated_by, stats);
    if (!changed) {
        return { changed: false, result: existing_result ?? result };
    }
    result.status = calculate_requirement_status(req_def, result);
    result.lastStatusUpdate = timestamp;
    if (updated_by) {
        result.lastStatusUpdateBy = updated_by;
    }
    result.stuckProblemDescription = '';
    return { changed: true, result };
}
