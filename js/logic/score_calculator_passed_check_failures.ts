/**
 * @fileoverview Räknar underkända bedömningskriterier under kontroller som är markerade som godkända (bristindex).
 */

import type { PassCriterionStored, RequirementResultStored } from './audit_logic_types.js';

/**
 * Samma semantik som tidigare inre loopar i ScoreCalculator: endast kriterier under `overallStatus === 'passed'`.
 */
export function count_failed_pass_criteria_under_passed_checks(
    req_result: RequirementResultStored | null | undefined
): number {
    if (!req_result?.checkResults) return 0;
    let failure_count = 0;
    for (const check_result of Object.values(req_result.checkResults)) {
        if (check_result.overallStatus === 'passed' && check_result.passCriteria) {
            for (const pc_result of Object.values(check_result.passCriteria)) {
                const p = pc_result as PassCriterionStored;
                if (p?.status === 'failed') failure_count += 1;
            }
        }
    }
    return failure_count;
}
