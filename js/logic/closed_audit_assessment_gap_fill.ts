/**
 * @fileoverview Fyller luckor i bedömningar för låsta/arkiverade granskningar:
 * ogranskade kontrollpunkter → inte aktuellt; ogjorda kriterier under Stämmer → ingen anmärkning.
 */

import type { AuditStateShape, RequirementDef, RequirementResultStored, SampleStored } from './audit_logic_types.js';
import { get_relevant_requirements_for_sample } from './audit_logic_requirements_lists.js';
import {
    get_stored_requirement_result_for_def,
    resolve_requirement_map_key
} from './audit_logic_lookup.js';
import { calculate_overall_audit_status_counts } from './audit_logic_progress.js';
import { calculate_requirement_status } from './audit_logic_status.js';
import { recalculateStatusesOnLoad } from './audit_logic_recalc.js';
import {
    fill_gaps_in_requirement_result,
    type RequirementAssessmentGapFillStats
} from './requirement_assessment_gap_fill.js';

export type ClosedAuditGapFillStats = RequirementAssessmentGapFillStats;

export type ClosedAuditGapFillResult = {
    state: AuditStateShape;
    changed: boolean;
    stats: ClosedAuditGapFillStats;
};

const CLOSED_STATUSES = new Set(['locked', 'archived']);

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
