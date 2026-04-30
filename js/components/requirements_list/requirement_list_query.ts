/**
 * Hjälpfunktioner för kravlistor: poster, referenser, söktext och statusmatchning.
 * @module js/components/requirements_list/requirement_list_query
 */

import { get_stored_requirement_result_for_def, get_effective_requirement_audit_status } from '../../audit_logic.js';
import { RequirementLookup } from '../../logic/requirement_lookup.js';
import { get_searchable_text_for_requirement as get_searchable_text_util } from '../../utils/requirement_search_utils.js';

/**
 * @param {object|null|undefined} rule_file_content
 * @returns {Array<[string, object]>}
 */
export function get_requirements_entries(rule_file_content: unknown): [string, unknown][] {
    const rfc = rule_file_content as Record<string, unknown> | null | undefined;
    const requirements = rfc?.requirements;
    const look = RequirementLookup.from(requirements);
    return look ? look.entries() : [];
}

/**
 * @param {object} req
 * @returns {string}
 */
export function get_searchable_text_for_requirement(req: unknown): string {
    return get_searchable_text_util(req, { includeInfoBlocks: true });
}

/**
 * @param {object} req
 * @returns {string}
 */
export function get_reference_string_for_sort(req: Record<string, unknown>): string {
    const std_ref = req?.standardReference as { text?: string } | undefined;
    if (typeof std_ref?.text === 'string' && std_ref.text.trim() !== '') {
        return std_ref.text.trim();
    }
    if (typeof req?.reference === 'string' && req.reference.trim() !== '') {
        return req.reference.trim();
    }
    return '';
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number}
 */
export function compare_strings_locale(a: unknown, b: unknown): number {
    const a_str = (a || '').toString();
    const b_str = (b || '').toString();
    return a_str.localeCompare(b_str, 'sv', { numeric: true, sensitivity: 'base' });
}

/**
 * @param {string|number} req_id
 * @param {object} req
 * @param {object[]} samples
 * @param {Map<string, Set<string>>} relevant_ids_by_sample
 * @param {object|Array|null|undefined} requirements ruleFileContent.requirements
 * @param {object} AuditLogic
 * @returns {string}
 */
export function get_aggregated_display_status_for_requirement(
    req_id: unknown,
    req: unknown,
    samples: unknown[],
    relevant_ids_by_sample: Map<string, Set<string>>,
    requirements: unknown,
    AuditLogic: Record<string, unknown> | null | undefined
): string {
    const r = req as Record<string, unknown>;
    const candidates = new Set([String(req_id)]);
    if (r?.key) candidates.add(String(r.key));
    if (r?.id) candidates.add(String(r.id));

    const matching_samples = samples.filter((sample: any) => {
        const sample_set = sample?.id ? relevant_ids_by_sample.get(sample.id) : null;
        if (!sample_set) return false;
        return [...candidates].some(id => sample_set.has(id));
    });

    let display_status = 'not_audited';

    const requirement_needs_help_fn = (AuditLogic?.requirement_needs_help as ((r: unknown) => boolean) | undefined) || (() => false);
    for (const sample of matching_samples as any[]) {
        const req_result = get_stored_requirement_result_for_def(
            sample.requirementResults,
            requirements,
            req as any,
            req_id as any
        );
        if (!req_result) continue;
        if (requirement_needs_help_fn(req_result)) return 'needs_help';
        const status = req_result.needsReview
            ? 'updated'
            : get_effective_requirement_audit_status(requirements, sample.requirementResults, req as any, req_id as any);
        if (status === 'failed') return 'failed';
        if (status === 'updated') display_status = 'updated';
        if (status === 'partially_audited' && display_status !== 'updated') display_status = 'partially_audited';
        if (status === 'passed' && display_status === 'not_audited') display_status = 'passed';
    }
    return display_status;
}

/**
 * Kontrollerar om ett stickprov matchar statusfiltret för ett givet krav.
 * Används för att filtrera både krav (minst ett matchande stickprov) och stickprov (endast matchande visas).
 *
 * @param {object} sample
 * @param {string|number} req_id
 * @param {object} req
 * @param {object} status_filters
 * @param {boolean} has_status_filters
 * @param {function} requirement_needs_help_fn
 * @param {object} AuditLogic
 * @param {object|Array|null|undefined} requirements ruleFileContent.requirements
 * @returns {boolean}
 */
export function sample_matches_status_filter(
    sample: any,
    req_id: unknown,
    req: unknown,
    status_filters: Record<string, unknown>,
    has_status_filters: boolean,
    requirement_needs_help_fn: (r: unknown) => boolean,
    AuditLogic: Record<string, unknown>,
    requirements: unknown
): boolean {
    const req_result = get_stored_requirement_result_for_def(
        sample.requirementResults,
        requirements,
        req as any,
        req_id as any
    );
    const display_status = req_result?.needsReview
        ? 'updated'
        : get_effective_requirement_audit_status(requirements, sample.requirementResults, req as any, req_id as any);
    const needs_help = requirement_needs_help_fn(req_result);
    const status_match = !has_status_filters || status_filters[display_status] === true;
    const needs_help_checked = status_filters.needs_help === true;
    const show_by_status = status_match || (needs_help_checked && needs_help);
    const hide_by_needs_help = status_filters.needs_help === false && needs_help;
    return show_by_status && !hide_by_needs_help;
}
