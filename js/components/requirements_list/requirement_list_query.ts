// @ts-nocheck
/**
 * Hjälpfunktioner för kravlistor: poster, referenser, söktext och statusmatchning.
 * @module js/components/requirements_list/requirement_list_query
 */

import { get_stored_requirement_result_for_def, get_effective_requirement_audit_status } from '../../audit_logic.js';
import { get_searchable_text_for_requirement as get_searchable_text_util } from '../../utils/requirement_search_utils.js';

/**
 * @param {object|null|undefined} rule_file_content
 * @returns {Array<[string, object]>}
 */
export function get_requirements_entries(rule_file_content) {
    const requirements = rule_file_content?.requirements;
    if (!requirements) return [];

    if (Array.isArray(requirements)) {
        return requirements.map((req, idx) => [req?.id || String(idx), req]);
    }

    if (typeof requirements === 'object') {
        return Object.entries(requirements);
    }

    return [];
}

/**
 * @param {object} req
 * @returns {string}
 */
export function get_searchable_text_for_requirement(req) {
    return get_searchable_text_util(req, { includeInfoBlocks: true });
}

/**
 * @param {object} req
 * @returns {string}
 */
export function get_reference_string_for_sort(req) {
    if (typeof req?.standardReference?.text === 'string' && req.standardReference.text.trim() !== '') {
        return req.standardReference.text.trim();
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
export function compare_strings_locale(a, b) {
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
    req_id,
    req,
    samples,
    relevant_ids_by_sample,
    requirements,
    AuditLogic
) {
    const candidates = new Set([String(req_id)]);
    if (req?.key) candidates.add(String(req.key));
    if (req?.id) candidates.add(String(req.id));

    const matching_samples = samples.filter(sample => {
        const sample_set = sample?.id ? relevant_ids_by_sample.get(sample.id) : null;
        if (!sample_set) return false;
        return [...candidates].some(id => sample_set.has(id));
    });

    let display_status = 'not_audited';

    const requirement_needs_help_fn = AuditLogic?.requirement_needs_help || (() => false);
    for (const sample of matching_samples) {
        const req_result = get_stored_requirement_result_for_def(
            sample.requirementResults,
            requirements,
            req,
            req_id
        );
        if (!req_result) continue;
        if (requirement_needs_help_fn(req_result)) return 'needs_help';
        const status = req_result.needsReview
            ? 'updated'
            : get_effective_requirement_audit_status(requirements, sample.requirementResults, req, req_id);
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
    sample,
    req_id,
    req,
    status_filters,
    has_status_filters,
    requirement_needs_help_fn,
    AuditLogic,
    requirements
) {
    const req_result = get_stored_requirement_result_for_def(
        sample.requirementResults,
        requirements,
        req,
        req_id
    );
    const display_status = req_result?.needsReview
        ? 'updated'
        : get_effective_requirement_audit_status(requirements, sample.requirementResults, req, req_id);
    const needs_help = requirement_needs_help_fn(req_result);
    const status_match = !has_status_filters || status_filters[display_status] === true;
    const needs_help_checked = status_filters.needs_help === true;
    const show_by_status = status_match || (needs_help_checked && needs_help);
    const hide_by_needs_help = status_filters.needs_help === false && needs_help;
    return show_by_status && !hide_by_needs_help;
}
