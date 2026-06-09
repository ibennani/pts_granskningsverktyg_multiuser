/**
 * @fileoverview Gemensam state-uppdatering för bulk "ingen anmärkning" på ogranskade och delvis granskade krav.
 */

import type { RequirementDef } from '../logic/audit_logic_types.js';
import * as AuditLogic from '../audit_logic.js';
import { effective_status_is_fully_unreviewed_for_bulk_pass } from '../logic/bulk_pass_unreviewed_policy.js';
import { build_requirement_result_with_assessment_gaps_filled } from '../logic/requirement_assessment_gap_fill.js';
import { remove_stale_requirement_result_aliases } from './auditResultAliases.js';

export type BulkPassFullyUnreviewedScope = {
    /** Om satt: endast detta stickprov; annars alla stickprov */
    target_sample_id: string | null;
    /** Om satt: endast detta krav (key/id); annars alla relevanta krav */
    requirement_id: string | null;
};

function apply_bulk_no_remarks_to_requirement(
    req_def: RequirementDef,
    existing: ReturnType<typeof AuditLogic.get_stored_requirement_result_for_def>,
    status: string,
    timestamp: string,
    user_name: string
) {
    if (status === 'not_audited') {
        return AuditLogic.build_not_applicable_requirement_result(req_def, existing, timestamp, user_name);
    }
    const { changed, result } = build_requirement_result_with_assessment_gaps_filled(
        req_def,
        existing,
        timestamp,
        user_name
    );
    return changed ? result : null;
}

/**
 * Returnerar ny `samples`-array där berörda krav satts till "ingen anmärkning".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- reducer-state har ännu ingen strikt AppState-typ
export function map_samples_bulk_pass_fully_unreviewed_only(
    current_state: any,
    scope: BulkPassFullyUnreviewedScope,
    timestamp: string,
    user_name: string
): any[] {
    return current_state.samples.map((sample: any) => {
        if (scope.target_sample_id && sample.id !== scope.target_sample_id) {
            return sample;
        }
        const relevant_reqs = AuditLogic.get_relevant_requirements_for_sample(current_state.ruleFileContent, sample);
        const reqs_to_process = scope.requirement_id
            ? relevant_reqs.filter((r: RequirementDef) => (r.key || r.id) === scope.requirement_id)
            : relevant_reqs;
        if (scope.requirement_id && reqs_to_process.length === 0) {
            return sample;
        }
        const requirements = current_state.ruleFileContent.requirements;
        const new_results = { ...(sample.requirementResults || {}) };
        let has_changed = false;
        reqs_to_process.forEach((req_def: RequirementDef) => {
            const existing = AuditLogic.get_stored_requirement_result_for_def(new_results, requirements, req_def);
            const status = AuditLogic.get_effective_requirement_audit_status(
                requirements,
                new_results,
                req_def,
                null
            );
            if (!effective_status_is_fully_unreviewed_for_bulk_pass(status)) {
                return;
            }
            const next_result = apply_bulk_no_remarks_to_requirement(
                req_def,
                existing,
                status,
                timestamp,
                user_name
            );
            if (!next_result) {
                return;
            }
            const map_key =
                AuditLogic.resolve_requirement_map_key(requirements, req_def.key || req_def.id) ||
                String(req_def.key || req_def.id);
            new_results[map_key] = next_result;
            remove_stale_requirement_result_aliases(new_results, map_key, req_def);
            has_changed = true;
        });
        return has_changed ? { ...sample, requirementResults: new_results } : sample;
    });
}
