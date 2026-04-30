/**
 * @fileoverview Bristindex (0–100) per WCAG POUR-princip; samma publika API som tidigare ScoreCalculator.js.
 */

import { get_stored_requirement_result_for_def } from '../audit_logic.js';
import { consoleManager } from '../utils/console_manager.js';
import { normalize_requirements_to_record } from './requirement_lookup.js';
import { count_failed_pass_criteria_under_passed_checks } from './score_calculator_passed_check_failures.js';

type RuleFileContentLike = {
    requirements?: unknown;
    metadata?: Record<string, unknown>;
};

type AuditStateLike = {
    samples?: Array<{
        id?: string;
        selectedContentTypes?: string[];
        requirementResults?: Record<string, unknown>;
    }>;
    ruleFileContent?: RuleFileContentLike;
};

type RequirementDefLike = {
    metadata?: { impact?: { isCritical?: boolean; primaryScore?: number; secondaryScore?: number } };
    contentType?: string[];
    classifications?: Array<{ taxonomyId?: string; conceptId?: string }>;
};

function _calculate_requirement_weight (requirement: RequirementDefLike): number {
    const impact = requirement?.metadata?.impact;
    if (!impact) return 0;

    const is_critical_factor = impact.isCritical === true ? 1.0 : 0.9;
    const primary_score = impact.primaryScore || 0;
    const secondary_score = impact.secondaryScore || 0;

    const score_component = Math.sqrt(primary_score + (0.5 * secondary_score));

    return is_critical_factor * score_component;
}

function _get_relevant_requirements_for_sample (
    rule_file_content: RuleFileContentLike,
    sample: NonNullable<AuditStateLike['samples']>[0]
): RequirementDefLike[] {
    if (!rule_file_content?.requirements || !sample) return [];
    const all_reqs = Object.values(normalize_requirements_to_record(rule_file_content.requirements));

    if (!sample.selectedContentTypes?.length) {
        return all_reqs as RequirementDefLike[];
    }

    return (all_reqs as RequirementDefLike[]).filter((req) => {
        if (!req.contentType || req.contentType.length === 0) return true;
        return req.contentType.some((ct) => sample.selectedContentTypes!.includes(ct));
    });
}

/**
 * Beräknar bristindex (0 = bäst, 100 = sämst) enligt samma modell som tidigare.
 */
export function calculateQualityScore (audit_state: AuditStateLike | null | undefined): {
    totalScore: number;
    principles: Record<string, { labelKey?: string; label?: string; score: number }>;
    sampleCount: number;
} {
    const safe_sample_count = Array.isArray(audit_state?.samples) ? audit_state!.samples!.length : 0;

    if (!audit_state) {
        consoleManager.log('[ScoreCalculator] auditState is null or undefined');
        return {
            totalScore: 0,
            principles: {
                perceivable: { labelKey: 'perceivable', score: 0 },
                operable: { labelKey: 'operable', score: 0 },
                understandable: { labelKey: 'understandable', score: 0 },
                robust: { labelKey: 'robust', score: 0 }
            },
            sampleCount: 0
        };
    }

    if (!audit_state.ruleFileContent?.requirements) {
        consoleManager.log('[ScoreCalculator] Missing requirements in ruleFileContent');
        return {
            totalScore: 0,
            principles: {
                perceivable: { labelKey: 'perceivable', score: 0 },
                operable: { labelKey: 'operable', score: 0 },
                understandable: { labelKey: 'understandable', score: 0 },
                robust: { labelKey: 'robust', score: 0 }
            },
            sampleCount: safe_sample_count
        };
    }

    const taxonomies =
        (audit_state.ruleFileContent.metadata?.vocabularies as { taxonomies?: unknown } | undefined)?.taxonomies
        ?? audit_state.ruleFileContent.metadata?.taxonomies
        ?? [];
    const classifications = Array.isArray(taxonomies)
        ? (taxonomies as Array<{ id?: string }>).find((tax) => tax?.id === 'wcag22-pour')
        : null;

    const concepts =
        Array.isArray((classifications as { concepts?: unknown } | null)?.concepts)
        && ((classifications as { concepts: unknown[] }).concepts.length > 0)
            ? (classifications as { concepts: Array<{ id: string; labelKey?: string; label: string }> }).concepts
            : [
                { id: 'perceivable', labelKey: 'perceivable', label: 'Perceivable' },
                { id: 'operable', labelKey: 'operable', label: 'Operable' },
                { id: 'understandable', labelKey: 'understandable', label: 'Understandable' },
                { id: 'robust', labelKey: 'robust', label: 'Robust' }
            ];

    let total_max_weight = 0;
    let total_deductions = 0;

    const principle_scores: Record<string, { maxWeight: number; deductions: number }> = {};
    concepts.forEach((c) => {
        principle_scores[c.id] = { maxWeight: 0, deductions: 0 };
    });

    (audit_state.samples || []).forEach((sample) => {
        const relevant_reqs_for_sample = _get_relevant_requirements_for_sample(audit_state.ruleFileContent!, sample);

        relevant_reqs_for_sample.forEach((req_def) => {
            const req_weight = _calculate_requirement_weight(req_def);

            total_max_weight += req_weight;

            const principle_id = req_def.classifications?.find((c) => c.taxonomyId === 'wcag22-pour')?.conceptId;
            if (principle_id && Object.prototype.hasOwnProperty.call(principle_scores, principle_id)) {
                principle_scores[principle_id].maxWeight += req_weight;
            }

            const requirements_obj = audit_state.ruleFileContent?.requirements;
            const req_result = get_stored_requirement_result_for_def(
                sample.requirementResults as never,
                requirements_obj as never,
                req_def as never
            );
            let deficiency_points_for_req = 0;
            if (req_result?.checkResults) {
                const failure_count_for_req = count_failed_pass_criteria_under_passed_checks(req_result);
                deficiency_points_for_req = failure_count_for_req * req_weight;
            }

            const adjusted_deductions = Math.min(deficiency_points_for_req, req_weight);

            total_deductions += adjusted_deductions;
            if (principle_id && Object.prototype.hasOwnProperty.call(principle_scores, principle_id)) {
                principle_scores[principle_id].deductions += adjusted_deductions;
            }
        });
    });

    const final_principle_report: Record<string, { labelKey?: string; label: string; score: number }> = {};
    concepts.forEach((concept) => {
        const id = concept.id;
        const data = principle_scores[id] || { maxWeight: 0, deductions: 0 };
        const deficiency_index = (data.maxWeight > 0) ? (data.deductions / data.maxWeight) * 100 : 0;
        final_principle_report[id] = {
            ...(concept.labelKey ? { labelKey: concept.labelKey } : {}),
            label: concept.label,
            score: parseFloat(deficiency_index.toFixed(1))
        };
    });

    const final_total_deficiency_index = (total_max_weight > 0) ? (total_deductions / total_max_weight) * 100 : 0;

    return {
        totalScore: parseFloat(final_total_deficiency_index.toFixed(1)),
        principles: final_principle_report,
        sampleCount: safe_sample_count
    };
}

consoleManager.log('[ScoreCalculator] ScoreCalculator loaded.');
