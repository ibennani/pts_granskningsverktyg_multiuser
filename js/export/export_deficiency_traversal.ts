/**
 * @fileoverview Gemensamma loopar för export: underkända bedömningskriterier med kravdefinition.
 * Använder traverse_audit_data + find_requirement_definition så att trädtraversering inte dupliceras.
 */

import { find_requirement_definition } from '../logic/audit_logic_lookup.js';
import { traverse_all_pass_criteria } from '../utils/traverse_audit_data.js';

/**
 * Varje lagrat underkänt kriterium med brist-id som har motsvarande krav i regelfilen.
 * @param {object} current_audit
 * @param {(ctx: object) => void} callback ctx: sample, req_definition, req_result, check_id, pc_id, pc_obj
 */
export function for_each_failed_export_pass_criterion(
    current_audit: unknown,
    callback: (ctx: {
        sample: unknown;
        req_definition: unknown;
        req_result: unknown;
        check_id: string;
        pc_id: string;
        pc_obj: { deficiencyId?: string; observationDetail?: string; status?: string };
    }) => void
) {
    if (!current_audit) return;
    const requirements = (current_audit as { ruleFileContent?: { requirements?: unknown } }).ruleFileContent
        ?.requirements || {};
    traverse_all_pass_criteria(current_audit as import('../utils/traverse_audit_data.js').AuditStateLike, (ctx) => {
        const pc_obj = ctx.pc_result;
        if (!pc_obj || pc_obj.status !== 'failed' || !pc_obj.deficiencyId) return;
        const req_definition = find_requirement_definition(requirements, ctx.req_key);
        if (!req_definition) return;
        callback({
            sample: ctx.sample,
            req_definition,
            req_result: ctx.req_result,
            check_id: ctx.check_key,
            pc_id: ctx.pc_key,
            pc_obj
        });
    });
}

/**
 * Underkända kriterium med brist-id inom ett redan uppslaget kravresultat.
 * @param {object|undefined} result
 * @param {(ctx: { check_id: string, pc_id: string, pc_obj: object }) => void} callback
 */
export function for_each_failed_in_requirement_result(
    result: unknown,
    callback: (ctx: { check_id: string; pc_id: string; pc_obj: { deficiencyId?: string; observationDetail?: string; status?: string } }) => void
) {
    if (!(result as { checkResults?: Record<string, unknown> })?.checkResults) return;
    const check_results = (result as { checkResults: Record<string, { passCriteria?: Record<string, unknown> }> }).checkResults;
    for (const check_id of Object.keys(check_results)) {
        const check_res = check_results[check_id];
        if (!check_res?.passCriteria) continue;
        for (const pc_id of Object.keys(check_res.passCriteria)) {
            const pc_obj = check_res.passCriteria[pc_id] as {
                deficiencyId?: string;
                observationDetail?: string;
                status?: string;
            };
            if (pc_obj && pc_obj.status === 'failed' && pc_obj.deficiencyId) {
                callback({ check_id, pc_id, pc_obj });
            }
        }
    }
}
