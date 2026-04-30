/**
 * @fileoverview Räknar underkända bedömningskriterier under kontroller som är markerade som godkända (bristindex).
 */

import type { PassCriterionStored, RequirementResultStored } from './audit_logic_types.js';
import { traverse_pass_criteria_in_requirement_result } from '../utils/traverse_audit_data.js';

/**
 * Samma semantik som tidigare inre loopar i ScoreCalculator: endast kriterier under `overallStatus === 'passed'`.
 */
export function count_failed_pass_criteria_under_passed_checks (
    req_result: RequirementResultStored | null | undefined
): number {
    if (!req_result?.checkResults) return 0;
    let failure_count = 0;
    traverse_pass_criteria_in_requirement_result(req_result, ({ check_result, pc_result }) => {
        if (check_result.overallStatus === 'passed') {
            const p = pc_result as PassCriterionStored;
            if (p?.status === 'failed') failure_count += 1;
        }
    });
    return failure_count;
}
