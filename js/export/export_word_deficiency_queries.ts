/**
 * @fileoverview Word-export: uppslag av krav/stickprov och brister för sortering och listor.
 */
import { get_export_requirement_result } from './export_bootstrap.js';
import {
    for_each_failed_export_pass_criterion,
    for_each_failed_in_requirement_result
} from './export_deficiency_traversal.js';
import { traverse_all_pass_criteria } from '../utils/traverse_audit_data.js';

// Hjälpfunktioner
export function get_requirements_with_deficiencies(current_audit: any): any[] {
    const requirements_obj = current_audit.ruleFileContent?.requirements || {};
    const defs_hit = new Set();
    for_each_failed_export_pass_criterion(current_audit, ({ req_definition }) => {
        defs_hit.add(req_definition);
    });
    return Object.values(requirements_obj).filter((req) => defs_hit.has(req));
}

export function get_total_requirements_count(current_audit: any): number {
    return Object.keys(current_audit.ruleFileContent?.requirements || {}).length;
}

export function get_requirements_percentage(current_audit: any): number {
    const total = get_total_requirements_count(current_audit);
    const reviewed = (current_audit.samples || []).reduce((count: number, sample: any) => {
        return count + Object.keys(sample.requirementResults || {}).length;
    }, 0);
    return total > 0 ? Math.round((reviewed / total) * 100) : 0;
}

export function get_samples_for_requirement(requirement: any, current_audit: any): any[] {
    const requirements_obj = current_audit.ruleFileContent?.requirements || {};
    return (current_audit.samples || []).filter((sample: any) => {
        const result = get_export_requirement_result(requirements_obj, sample, requirement);
        let found = false;
        for_each_failed_in_requirement_result(result, () => {
            found = true;
        });
        return found;
    });
}

export function get_expected_observation(_requirement: any, _sample: any): null {
    return null;
}

export function get_actor_comment(_requirement: any, _sample: any): null {
    return null;
}

// Naturlig sortering för att hantera nummer korrekt (9.9 → 9.10 → 9.11)
export function natural_sort(a: any, b: any): number {
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;

    const parts_a = a.toString().split(/(\d+)/);
    const parts_b = b.toString().split(/(\d+)/);

    const max_length = Math.max(parts_a.length, parts_b.length);

    for (let i = 0; i < max_length; i++) {
        const part_a = parts_a[i] || '';
        const part_b = parts_b[i] || '';

        if (/^\d+$/.test(part_a) && /^\d+$/.test(part_b)) {
            const num_a = parseInt(part_a, 10);
            const num_b = parseInt(part_b, 10);
            if (num_a !== num_b) {
                return num_a - num_b;
            }
        } else {
            const comparison = part_a.localeCompare(part_b);
            if (comparison !== 0) {
                return comparison;
            }
        }
    }

    return 0;
}

export function get_samples_with_deficiencies_for_requirement(requirement: any, current_audit: any): any[] {
    const requirements_obj = current_audit.ruleFileContent?.requirements || {};
    const samples_with_deficiencies: any[] = [];

    (current_audit.samples || []).forEach((sample: any) => {
        const result = get_export_requirement_result(requirements_obj, sample, requirement);
        let has_deficiencies = false;
        for_each_failed_in_requirement_result(result, () => {
            has_deficiencies = true;
        });
        if (has_deficiencies) {
            samples_with_deficiencies.push(sample);
        }
    });

    return samples_with_deficiencies;
}

export function get_deficiencies_for_sample(requirement: any, sample: any, current_audit: any, _t: any): any[] {
    const deficiencies: any[] = [];
    const requirements_obj = current_audit?.ruleFileContent?.requirements || {};
    const result = get_export_requirement_result(requirements_obj, sample, requirement);

    if (!result || !result.checkResults) return deficiencies;

    for_each_failed_in_requirement_result(result, ({ check_id, pc_id, pc_obj }) => {
        const pc_def = requirement.checks
            ?.find((c: any) => c.id === check_id)
            ?.passCriteria?.find((p: any) => p.id === pc_id);
        const templateObservation = pc_def?.failureStatementTemplate || '';
        const userObservation = pc_obj.observationDetail || '';
        const passCriterionText = pc_def?.requirement || '';

        let finalObservation = userObservation;
        let isStandardText = false;
        if (!userObservation.trim() || userObservation.trim() === templateObservation.trim()) {
            finalObservation = passCriterionText;
            isStandardText = true;
        }

        deficiencies.push({
            observationDetail: finalObservation,
            deficiencyId: pc_obj.deficiencyId,
            isStandardText: isStandardText
        });
    });

    return deficiencies;
}

export function get_deficiencies_for_sample_any_req(sample: any, current_audit: any, t: any): any[] {
    const all: any[] = [];
    const requirements = current_audit.ruleFileContent?.requirements || {};
    for (const reqId of Object.keys(requirements)) {
        const req = (requirements as Record<string, unknown>)[reqId];
        const defs = get_deficiencies_for_sample(req, sample, current_audit, t);
        for (const d of defs) {
            all.push({ ...d, _requirementId: reqId });
        }
    }
    return all;
}

export function group_deficiencies_by_requirement(deficiencies: any[], current_audit: any): Record<string, any[]> {
    const map: Record<string, any[]> = {};
    const requirements = current_audit.ruleFileContent?.requirements || {};
    for (const d of deficiencies) {
        const reqId = d._requirementId;
        if (!reqId || !(requirements as Record<string, unknown>)[reqId]) continue;
        const { _requirementId, ...rest } = d;
        if (!map[reqId]) map[reqId] = [];
        map[reqId].push(rest);
    }
    return map;
}

export function get_failing_requirement_ids_for_sample(sample: any): string[] {
    const failing_set = new Set<string>();
    traverse_all_pass_criteria({ samples: sample ? [sample] : [] }, (ctx) => {
        const pc = ctx.pc_result;
        if (pc && pc.status === 'failed') {
            failing_set.add(ctx.req_key);
        }
    });
    return [...failing_set];
}

export function get_all_deficiencies_for_sample_generic(sample: any, current_audit: any): any[] {
    const deficiencies: any[] = [];
    const all_reqs = current_audit.ruleFileContent?.requirements || {};
    Object.values(all_reqs).forEach((req: any) => {
        const defs = get_deficiencies_for_sample(req, sample, current_audit, () => undefined);
        deficiencies.push(...defs);
    });
    return deficiencies;
}
