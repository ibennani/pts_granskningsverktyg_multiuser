/**
 * @fileoverview Relevanta krav per stickprov och sorterade kravnycklar.
 */

import * as Helpers from '../utils/helpers.js';
import type { RequirementDef, RuleFileForAudit, SampleStored } from './audit_logic_types.js';
import { get_audit_translation_t } from './audit_logic_i18n.js';

export function get_relevant_requirements_for_sample(
    rule_file_content: RuleFileForAudit | null | undefined,
    sample: SampleStored | null | undefined
): RequirementDef[] {
    if (!rule_file_content || typeof rule_file_content !== 'object') {
        if (window.ConsoleManager?.warn) {
            window.ConsoleManager.warn('[AuditLogic] get_relevant_requirements_for_sample: Invalid rule_file_content');
        }
        return [];
    }

    if (!rule_file_content.requirements || typeof rule_file_content.requirements !== 'object') {
        if (window.ConsoleManager?.warn) {
            window.ConsoleManager.warn('[AuditLogic] get_relevant_requirements_for_sample: Invalid or missing requirements object');
        }
        return [];
    }

    if (!sample || typeof sample !== 'object') {
        if (window.ConsoleManager?.warn) {
            window.ConsoleManager.warn('[AuditLogic] get_relevant_requirements_for_sample: Invalid sample object');
        }
        return [];
    }

    try {
        const all_reqs = Object.values(rule_file_content.requirements).filter((req): req is RequirementDef => {
            return !!(req && typeof req === 'object' && ((req as RequirementDef).key || (req as RequirementDef).id));
        });

        if (!sample.selectedContentTypes || !Array.isArray(sample.selectedContentTypes) || sample.selectedContentTypes.length === 0) {
            return all_reqs;
        }

        return all_reqs.filter((req: RequirementDef) => {
            if (!req.contentType || !Array.isArray(req.contentType) || req.contentType.length === 0) {
                return true;
            }
            const types = sample.selectedContentTypes ?? [];
            return req.contentType.some((ct: string) => types.includes(ct));
        });
    } catch (error) {
        if (window.ConsoleManager?.warn) {
            window.ConsoleManager.warn('[AuditLogic] get_relevant_requirements_for_sample: Error processing requirements:', error);
        }
        return [];
    }
}

export function get_ordered_relevant_requirement_keys(
    rule_file_content: RuleFileForAudit,
    sample_object: SampleStored,
    sort_option = 'default'
): Array<string | number | undefined> {
    const t = get_audit_translation_t();
    const relevant_reqs = get_relevant_requirements_for_sample(rule_file_content, sample_object);

    if (sort_option === 'default') {
        relevant_reqs.sort((a: RequirementDef, b: RequirementDef) => {
            const ref_a = a.standardReference?.text || null;
            const ref_b = b.standardReference?.text || null;
            if (ref_a && ref_b) return Helpers.natural_sort(ref_a, ref_b);
            if (ref_a && !ref_b) return -1;
            if (!ref_a && ref_b) return 1;
            return (a.title || '').localeCompare(b.title || '', 'sv');
        });
    } else if (sort_option === 'category') {
        relevant_reqs.sort((a: RequirementDef, b: RequirementDef) => {
            const main_a = a.metadata?.mainCategory?.text || t('uncategorized');
            const main_b = b.metadata?.mainCategory?.text || t('uncategorized');
            if (main_a !== main_b) return String(main_a).localeCompare(String(main_b), 'sv');
            const sub_a = a.metadata?.subCategory?.text || t('other_requirements');
            const sub_b = b.metadata?.subCategory?.text || t('other_requirements');
            if (sub_a !== sub_b) return String(sub_a).localeCompare(String(sub_b), 'sv');
            return (a.title || '').localeCompare(b.title || '', 'sv');
        });
    }

    return relevant_reqs.map((req) => req.key || req.id);
}
