// @ts-nocheck
/**
 * @fileoverview Word-export: uppslag av krav/stickprov och brister för sortering och listor.
 */
import { get_export_requirement_result } from './export_bootstrap.js';

// Hjälpfunktioner
export function get_requirements_with_deficiencies(current_audit) {
    const requirements_obj = current_audit.ruleFileContent?.requirements || {};
    const requirements = Object.values(requirements_obj);
    return requirements.filter(req => {
        return (current_audit.samples || []).some(sample => {
            const result = get_export_requirement_result(requirements_obj, sample, req);
            if (!result || !result.checkResults) return false;

            return Object.values(result.checkResults).some(check_res => {
                if (!check_res || !check_res.passCriteria) return false;
                return Object.values(check_res.passCriteria).some(pc_obj =>
                    pc_obj && pc_obj.status === 'failed' && pc_obj.deficiencyId
                );
            });
        });
    });
}

export function get_total_requirements_count(current_audit) {
    return Object.keys(current_audit.ruleFileContent.requirements || {}).length;
}

export function get_requirements_percentage(current_audit) {
    const total = get_total_requirements_count(current_audit);
    const reviewed = (current_audit.samples || []).reduce((count, sample) => {
        return count + Object.keys(sample.requirementResults || {}).length;
    }, 0);
    return total > 0 ? Math.round((reviewed / total) * 100) : 0;
}

export function get_samples_for_requirement(requirement, current_audit) {
    const requirements_obj = current_audit.ruleFileContent?.requirements || {};
    return (current_audit.samples || []).filter(sample => {
        const result = get_export_requirement_result(requirements_obj, sample, requirement);
        if (!result || !result.checkResults) return false;

        return Object.values(result.checkResults).some(check_res => {
            if (!check_res || !check_res.passCriteria) return false;
            return Object.values(check_res.passCriteria).some(pc_obj =>
                pc_obj && pc_obj.status === 'failed' && pc_obj.deficiencyId
            );
        });
    });
}

export function get_expected_observation(_requirement, _sample) {
    // Denna funktion skulle behöva implementeras baserat på regelfilens struktur
    return null;
}

export function get_actor_comment(_requirement, _sample) {
    // Denna funktion skulle behöva implementeras baserat på regelfilens struktur
    return null;
}

// Naturlig sortering för att hantera nummer korrekt (9.9 → 9.10 → 9.11)
export function natural_sort(a, b) {
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;

    // Dela upp strängarna i delar (nummer och text)
    const parts_a = a.toString().split(/(\d+)/);
    const parts_b = b.toString().split(/(\d+)/);

    const max_length = Math.max(parts_a.length, parts_b.length);

    for (let i = 0; i < max_length; i++) {
        const part_a = parts_a[i] || '';
        const part_b = parts_b[i] || '';

        // Om båda delarna är nummer, jämför numeriskt
        if (/^\d+$/.test(part_a) && /^\d+$/.test(part_b)) {
            const num_a = parseInt(part_a, 10);
            const num_b = parseInt(part_b, 10);
            if (num_a !== num_b) {
                return num_a - num_b;
            }
        }
        // Annars jämför alfabetiskt
        else {
            const comparison = part_a.localeCompare(part_b);
            if (comparison !== 0) {
                return comparison;
            }
        }
    }

    return 0;
}

// Hämtar stickprov som har underkännanden för ett specifikt krav
export function get_samples_with_deficiencies_for_requirement(requirement, current_audit) {
    const requirements_obj = current_audit.ruleFileContent?.requirements || {};
    const samples_with_deficiencies = [];

    (current_audit.samples || []).forEach(sample => {
        const result = get_export_requirement_result(requirements_obj, sample, requirement);
        if (!result || !result.checkResults) return;

        // Kontrollera om det finns underkännanden
        const has_deficiencies = Object.values(result.checkResults).some(check_res => {
            if (!check_res || !check_res.passCriteria) return false;
            return Object.values(check_res.passCriteria).some(pc_obj =>
                pc_obj && pc_obj.status === 'failed' && pc_obj.deficiencyId
            );
        });

        if (has_deficiencies) {
            samples_with_deficiencies.push(sample);
        }
    });

    return samples_with_deficiencies;
}

export function get_deficiencies_for_sample(requirement, sample, current_audit, _t) {
    const deficiencies = [];
    const requirements_obj = current_audit?.ruleFileContent?.requirements || {};
    const result = get_export_requirement_result(requirements_obj, sample, requirement);

    if (!result || !result.checkResults) return deficiencies;

    Object.keys(result.checkResults).forEach(check_id => {
        const check_res = result.checkResults[check_id];
        if (!check_res || !check_res.passCriteria) return;

        Object.keys(check_res.passCriteria).forEach(pc_id => {
            const pc_obj = check_res.passCriteria[pc_id];
            if (pc_obj && pc_obj.status === 'failed' && pc_obj.deficiencyId) {
                const pc_def = requirement.checks?.find(c => c.id === check_id)?.passCriteria?.find(p => p.id === pc_id);
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
            }
        });
    });

    return deficiencies;
}

/**
 * Samlar alla brister för ett stickprov över alla krav (används av textexport per stickprov).
 * Varje post får `_requirementId` för gruppring.
 */
export function get_deficiencies_for_sample_any_req(sample, current_audit, t) {
    const all = [];
    const requirements = current_audit.ruleFileContent?.requirements || {};
    for (const reqId of Object.keys(requirements)) {
        const req = requirements[reqId];
        const defs = get_deficiencies_for_sample(req, sample, current_audit, t);
        for (const d of defs) {
            all.push({ ...d, _requirementId: reqId });
        }
    }
    return all;
}

/**
 * Grupperar brister per krav-id (nyckel i ruleFileContent.requirements).
 */
export function group_deficiencies_by_requirement(deficiencies, current_audit) {
    const map = {};
    const requirements = current_audit.ruleFileContent?.requirements || {};
    for (const d of deficiencies) {
        const reqId = d._requirementId;
        if (!reqId || !requirements[reqId]) continue;
        const { _requirementId, ...rest } = d;
        if (!map[reqId]) map[reqId] = [];
        map[reqId].push(rest);
    }
    return map;
}

// Helper to get failing requirement IDs for a specific sample
export function get_failing_requirement_ids_for_sample(sample) {
    const failing_ids = [];
    const results = sample.requirementResults || {};
    Object.keys(results).forEach(req_key => {
        const result = results[req_key];
        if (result.checkResults) {
            let hasFailure = false;
            Object.values(result.checkResults).forEach(check => {
                if (check.passCriteria) {
                    Object.values(check.passCriteria).forEach(pc => {
                        if (pc.status === 'failed') hasFailure = true;
                    });
                }
            });
            if (hasFailure) failing_ids.push(req_key);
        }
    });
    return failing_ids;
}

// Helper to get deficiencies for a specific sample and requirement
// (Refactored/Reused existing logic but ensure it's scoped correctly)
// The existing get_deficiencies_for_sample takes (req, sample, current_audit, t)
// We can just use that.

// helper function to get all deficiencies for a sample to check if it has any
export function get_all_deficiencies_for_sample_generic(sample, current_audit) {
    const deficiencies = [];
    const all_reqs = current_audit.ruleFileContent.requirements || {};
    Object.values(all_reqs).forEach(req => {
        const defs = get_deficiencies_for_sample(req, sample, current_audit, () => { });
        deficiencies.push(...defs);
    });
    return deficiencies;
}