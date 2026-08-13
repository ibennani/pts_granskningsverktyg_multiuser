/**
 * @fileoverview Avgör om ett krav ska ingå i bristindex för en granskningsdel.
 */

import type { RequirementDef, RequirementResultStored } from './audit_logic_types.js';

/**
 * Krav exkluderas när alla kontrollpunkter i regelfilen är markerade «Inte aktuellt»
 * för just den granskningsdelen. Krav utan kontrollpunkter eller delvis bedömda krav räknas med.
 */
export function is_requirement_excluded_from_deficiency_index(
    req_def: RequirementDef | null | undefined,
    req_result: RequirementResultStored | null | undefined
): boolean {
    const checks = req_def?.checks ?? [];
    if (checks.length === 0) return false;
    if (!req_result?.checkResults) return false;

    for (const check_def of checks) {
        const check_id = String(check_def?.id ?? '').trim();
        if (!check_id) return false;

        const check_result = req_result.checkResults[check_id];
        if (!check_result || check_result.overallStatus !== 'not_applicable') {
            return false;
        }
    }

    return true;
}
