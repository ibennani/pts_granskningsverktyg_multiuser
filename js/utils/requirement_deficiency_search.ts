/**
 * @fileoverview Sökning på brist-id i kravlistor (låst/arkiverad granskning).
 */

import { extractDeficiencyNumber } from '../export/export_format_helpers.js';
import { for_each_failed_in_requirement_result } from '../export/export_deficiency_traversal.js';
import { get_stored_requirement_result_for_def } from '../audit_logic.js';
import type { RequirementDef, RequirementResultStored } from '../logic/audit_logic_types.js';

const DEFICIENCY_SEARCH_INPUT_RE = /^B?\d+$/i;

/**
 * Tolkar söksträng som bristnummer (27, 027, B027) eller null om inte giltigt brist-id-format.
 */
export function parse_deficiency_search_number(term: unknown): number | null {
    const trimmed = String(term ?? '').trim();
    if (!trimmed || !DEFICIENCY_SEARCH_INPUT_RE.test(trimmed)) {
        return null;
    }
    const digits = trimmed.replace(/^B/i, '');
    const n = parseInt(digits, 10);
    return Number.isFinite(n) ? n : null;
}

/**
 * Om lagrat deficiencyId matchar sökt bristnummer (heltal).
 */
export function deficiency_id_matches_search(deficiency_id: unknown, search_number: number): boolean {
    const stored = parseInt(extractDeficiencyNumber(deficiency_id), 10);
    return Number.isFinite(stored) && stored === search_number;
}

/**
 * Om kravresultatet har underkänt kriterium med matchande brist-id.
 */
export function requirement_result_has_deficiency_search(result: unknown, search_number: number): boolean {
    let found = false;
    for_each_failed_in_requirement_result(result, ({ pc_obj }) => {
        if (deficiency_id_matches_search(pc_obj.deficiencyId, search_number)) {
            found = true;
        }
    });
    return found;
}

/**
 * Alla-läge: minst ett relevant stickprov har matchande brist-id.
 */
export function requirement_has_deficiency_search_all_mode(
    req_id: unknown,
    req: unknown,
    samples_for_req: unknown[],
    requirements: unknown,
    search_number: number
): boolean {
    return samples_for_req.some((sample: any) => {
        const result = get_stored_requirement_result_for_def(
            sample?.requirementResults,
            requirements,
            req as RequirementDef,
            req_id as string | number | undefined
        );
        return requirement_result_has_deficiency_search(result, search_number);
    });
}

/**
 * Om ett stickprov har det sökta brist-id:t för ett givet krav.
 */
export function sample_has_deficiency_search_for_requirement(
    sample: { requirementResults?: Record<string, RequirementResultStored> | null },
    req_id: unknown,
    req: unknown,
    requirements: unknown,
    search_number: number
): boolean {
    const result = get_stored_requirement_result_for_def(
        sample?.requirementResults ?? undefined,
        requirements,
        req as RequirementDef,
        req_id as string | number | undefined
    );
    return requirement_result_has_deficiency_search(result, search_number);
}

/**
 * Stickprovsläge: aktuellt stickprovs resultat har matchande brist-id.
 */
export function requirement_has_deficiency_search_sample_mode(
    requirement_results: unknown,
    requirements: unknown,
    req: unknown,
    search_number: number
): boolean {
    const result = get_stored_requirement_result_for_def(
        requirement_results as Record<string, RequirementResultStored> | null | undefined,
        requirements,
        req as RequirementDef
    );
    return requirement_result_has_deficiency_search(result, search_number);
}
