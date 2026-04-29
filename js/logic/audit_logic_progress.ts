/**
 * @fileoverview Framstegsräkning och hjälpfunktioner för ofullständiga krav.
 */

import type { AuditStateShape, RequirementDef, RuleFileForAudit, SampleStored } from './audit_logic_types.js';
import { get_relevant_requirements_for_sample, get_ordered_relevant_requirement_keys } from './audit_logic_requirements_lists.js';
import { get_stored_requirement_result_for_def, find_requirement_definition } from './audit_logic_lookup.js';
import { calculate_requirement_status } from './audit_logic_status.js';

export function calculate_overall_audit_progress(current_audit_data: AuditStateShape): { audited: number; total: number } {
    if (!current_audit_data?.samples || !current_audit_data.ruleFileContent?.requirements) {
        return { audited: 0, total: 0 };
    }

    let total_possible_assessments = 0;
    let total_completed_assessments = 0;

    current_audit_data.samples.forEach((sample) => {
        const relevant_reqs = get_relevant_requirements_for_sample(current_audit_data.ruleFileContent, sample);
        total_possible_assessments += relevant_reqs.length;

        relevant_reqs.forEach((req_def) => {
            const stored = get_stored_requirement_result_for_def(
                sample.requirementResults,
                current_audit_data.ruleFileContent?.requirements,
                req_def
            );
            const status = calculate_requirement_status(req_def, stored);
            if (status === 'passed' || status === 'failed') {
                total_completed_assessments += 1;
            }
        });
    });

    return { audited: total_completed_assessments, total: total_possible_assessments };
}

export function calculate_sample_requirement_status_counts(
    rule_file_content: RuleFileForAudit,
    sample_object: SampleStored
): { passed: number; partially_audited: number; failed: number; not_audited: number; total: number } {
    const out = { passed: 0, partially_audited: 0, failed: 0, not_audited: 0, total: 0 };
    if (!rule_file_content?.requirements || !sample_object) {
        return out;
    }
    const relevant_reqs = get_relevant_requirements_for_sample(rule_file_content, sample_object);
    relevant_reqs.forEach((req_def) => {
        const stored = get_stored_requirement_result_for_def(
            sample_object.requirementResults,
            rule_file_content?.requirements,
            req_def
        );
        const status = calculate_requirement_status(req_def, stored);
        if (status === 'passed') out.passed += 1;
        else if (status === 'failed') out.failed += 1;
        else if (status === 'partially_audited') out.partially_audited += 1;
        else out.not_audited += 1;
    });
    out.total = out.passed + out.partially_audited + out.failed + out.not_audited;
    return out;
}

export function calculate_overall_audit_status_counts(current_audit_data: AuditStateShape): {
    passed: number;
    partially_audited: number;
    failed: number;
    not_audited: number;
    total: number;
} {
    const out = { passed: 0, partially_audited: 0, failed: 0, not_audited: 0, total: 0 };
    if (!current_audit_data?.samples || !current_audit_data.ruleFileContent?.requirements) {
        return out;
    }
    const rf = current_audit_data.ruleFileContent!;
    current_audit_data.samples.forEach((sample) => {
        const sample_counts = calculate_sample_requirement_status_counts(rf, sample);
        out.passed += sample_counts.passed;
        out.partially_audited += sample_counts.partially_audited;
        out.failed += sample_counts.failed;
        out.not_audited += sample_counts.not_audited;
    });
    out.total = out.passed + out.partially_audited + out.failed + out.not_audited;
    return out;
}

export function sample_has_any_requirement_needing_review(rule_file_content: RuleFileForAudit, sample: SampleStored): boolean {
    if (!rule_file_content?.requirements || !sample) return false;
    const reqs = rule_file_content.requirements;
    const relevant_reqs = get_relevant_requirements_for_sample(rule_file_content, sample);
    return relevant_reqs.some((req_def) => {
        const stored = get_stored_requirement_result_for_def(sample.requirementResults, reqs, req_def);
        return !!(stored && stored.needsReview === true);
    });
}

export function count_requirements_needing_review_in_audit(current_audit_data: AuditStateShape): number {
    if (!current_audit_data?.samples || !current_audit_data.ruleFileContent?.requirements) {
        return 0;
    }
    const rule = current_audit_data.ruleFileContent;
    let n = 0;
    current_audit_data.samples.forEach((sample) => {
        const relevant_reqs = get_relevant_requirements_for_sample(rule, sample);
        relevant_reqs.forEach((req_def) => {
            const stored = get_stored_requirement_result_for_def(
                sample.requirementResults,
                rule.requirements,
                req_def
            );
            if (stored?.needsReview === true) n += 1;
        });
    });
    return n;
}

export function find_first_incomplete_requirement_key_for_sample(
    rule_file_content: RuleFileForAudit,
    sample_object: SampleStored,
    exclude_key: string | null = null
): string | null {
    if (!sample_object || !rule_file_content?.requirements) return null;
    const ordered_keys = get_ordered_relevant_requirement_keys(rule_file_content, sample_object, 'default');
    for (const req_key of ordered_keys) {
        if (exclude_key && req_key === exclude_key) continue;
        const reqs = rule_file_content.requirements;
        const req_def =
            find_requirement_definition(reqs, req_key) ||
            (!Array.isArray(reqs) ? (reqs as Record<string, RequirementDef>)[String(req_key)] : undefined);
        if (!req_def) continue;
        const stored = get_stored_requirement_result_for_def(
            sample_object.requirementResults,
            rule_file_content.requirements,
            req_def,
            req_key
        );
        const status = calculate_requirement_status(req_def, stored);
        if (status === 'not_audited' || status === 'partially_audited') return String(req_key);
    }
    return null;
}
