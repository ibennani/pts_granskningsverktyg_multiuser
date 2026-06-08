/**
 * @fileoverview Fyller luckor i bedömningar för låsta/arkiverade granskningar:
 * ogranskade kontrollpunkter → inte aktuellt; ogjorda kriterier under Stämmer → ingen anmärkning.
 */

import type {
    AuditStateShape,
    CheckDef,
    CheckResultStored,
    PassCriterionStored,
    RequirementDef,
    RequirementResultStored,
    SampleStored
} from './audit_logic_types.js';
import { get_relevant_requirements_for_sample } from './audit_logic_requirements_lists.js';
import {
    get_stored_requirement_result_for_def,
    resolve_requirement_map_key
} from './audit_logic_lookup.js';
import { calculate_overall_audit_status_counts } from './audit_logic_progress.js';
import { calculate_requirement_status } from './audit_logic_status.js';
import { recalculateStatusesOnLoad } from './audit_logic_recalc.js';
import { definition_primary_id, resolve_map_entry } from './entity_id_match.js';

export type ClosedAuditGapFillStats = {
    checks_set_not_applicable: number;
    pass_criteria_set_passed: number;
    requirements_without_checks_set_passed: number;
};

export type ClosedAuditGapFillResult = {
    state: AuditStateShape;
    changed: boolean;
    stats: ClosedAuditGapFillStats;
};

const CLOSED_STATUSES = new Set(['locked', 'archived']);

function is_unset_audit_status(status: unknown): boolean {
    return status === undefined || status === null || status === '' || status === 'not_audited';
}

function ensure_requirement_result(
    sample: SampleStored,
    requirements: AuditStateShape['ruleFileContent'],
    req_def: RequirementDef
): RequirementResultStored {
    const map_key =
        resolve_requirement_map_key(requirements?.requirements, req_def.key || req_def.id) ||
        String(req_def.key || req_def.id);
    if (!sample.requirementResults) {
        sample.requirementResults = {};
    }
    let stored = get_stored_requirement_result_for_def(
        sample.requirementResults,
        requirements?.requirements,
        req_def
    );
    if (!stored) {
        stored = { checkResults: {} };
        sample.requirementResults[map_key] = stored;
    }
    if (!stored.checkResults) {
        stored.checkResults = {};
    }
    return stored;
}

function ensure_check_result(
    check_results: Record<string, CheckResultStored>,
    check_def: CheckDef
): { storage_key: string; check_result: CheckResultStored } {
    const primary = definition_primary_id(check_def);
    const resolved = resolve_map_entry(check_results, primary);
    if (resolved) {
        if (!resolved.value.passCriteria) {
            resolved.value.passCriteria = {};
        }
        return { storage_key: resolved.storageKey, check_result: resolved.value };
    }
    const check_result: CheckResultStored = { passCriteria: {} };
    check_results[primary] = check_result;
    return { storage_key: primary, check_result };
}

function touch_check_not_applicable(
    check_result: CheckResultStored,
    timestamp: string,
    updated_by: string | undefined
): boolean {
    if (!is_unset_audit_status(check_result.overallStatus)) {
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
    if (!is_unset_audit_status(raw_status)) {
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

function fill_gaps_in_requirement_result(
    req_def: RequirementDef,
    req_result: RequirementResultStored,
    timestamp: string,
    updated_by: string | undefined,
    stats: ClosedAuditGapFillStats
): boolean {
    const checks = req_def.checks ?? [];
    if (checks.length === 0) {
        const stored_status = req_result.status;
        if (!is_unset_audit_status(stored_status) && stored_status !== 'partially_audited') {
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
    let changed = false;
    for (const check_def of checks) {
        const { check_result } = ensure_check_result(req_result.checkResults!, check_def);
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
 * Fyller bedömningsluckor i en kopia av granskningstillstånd och omberäknar status.
 */
export function apply_closed_audit_assessment_gap_fill(
    audit_state: AuditStateShape,
    options: { timestamp?: string; updated_by?: string } = {}
): ClosedAuditGapFillResult {
    if (!CLOSED_STATUSES.has(String(audit_state.auditStatus ?? ''))) {
        return {
            state: audit_state,
            changed: false,
            stats: { checks_set_not_applicable: 0, pass_criteria_set_passed: 0, requirements_without_checks_set_passed: 0 }
        };
    }
    if (!audit_state.ruleFileContent?.requirements || !audit_state.samples?.length) {
        return {
            state: audit_state,
            changed: false,
            stats: { checks_set_not_applicable: 0, pass_criteria_set_passed: 0, requirements_without_checks_set_passed: 0 }
        };
    }

    const timestamp = options.timestamp ?? new Date().toISOString();
    const updated_by = options.updated_by ?? 'migration:closed_audit_gap_fill';
    const next_state = JSON.parse(JSON.stringify(audit_state)) as AuditStateShape;
    const stats: ClosedAuditGapFillStats = {
        checks_set_not_applicable: 0,
        pass_criteria_set_passed: 0,
        requirements_without_checks_set_passed: 0
    };
    let changed = false;

    for (const sample of next_state.samples ?? []) {
        const relevant = get_relevant_requirements_for_sample(next_state.ruleFileContent, sample);
        for (const req_def of relevant) {
            const req_result = ensure_requirement_result(sample, next_state.ruleFileContent, req_def);
            if (fill_gaps_in_requirement_result(req_def, req_result, timestamp, updated_by, stats)) {
                changed = true;
            }
        }
    }

    if (!changed) {
        return { state: audit_state, changed: false, stats };
    }

    const recalculated = recalculateStatusesOnLoad(next_state) ?? next_state;
    return { state: recalculated, changed: true, stats };
}

/** Räknar kvarvarande delvis granskade och ogranskade kravbedömningar (relevanta krav per stickprov). */
export function count_incomplete_assessments_in_audit(audit_state: AuditStateShape): {
    partially_audited: number;
    not_audited: number;
} {
    let partially_audited = 0;
    let not_audited = 0;
    if (!audit_state.ruleFileContent?.requirements || !audit_state.samples?.length) {
        return { partially_audited, not_audited };
    }
    const requirements = audit_state.ruleFileContent.requirements;
    for (const sample of audit_state.samples) {
        for (const req_def of get_relevant_requirements_for_sample(audit_state.ruleFileContent, sample)) {
            const stored = get_stored_requirement_result_for_def(
                sample.requirementResults,
                requirements,
                req_def
            );
            const status = calculate_requirement_status(req_def, stored);
            if (status === 'partially_audited') {
                partially_audited += 1;
            } else if (status === 'not_audited') {
                not_audited += 1;
            }
        }
    }
    return { partially_audited, not_audited };
}

/** True om inga relevanta krav är delvis granskade eller ogranskade och progress är 100 %. */
export function audit_has_fully_assessed_relevant_requirements(audit_state: AuditStateShape): boolean {
    const incomplete = count_incomplete_assessments_in_audit(audit_state);
    if (incomplete.partially_audited > 0 || incomplete.not_audited > 0) {
        return false;
    }
    const counts = calculate_overall_audit_status_counts(audit_state);
    const progress_total = counts.passed + counts.failed;
    return progress_total === counts.total && counts.total > 0;
}
