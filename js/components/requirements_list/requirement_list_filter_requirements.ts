/**
 * Filtrerar kravlistor utifrån söktext och status (samma logik som högerspalten).
 * @module js/components/requirements_list/requirement_list_filter_requirements
 */

import { get_stored_requirement_result_for_def, get_effective_requirement_audit_status } from '../../audit_logic.js';
import { prepareString } from '../../utils/string_filter_normalize.js';
import {
    parse_deficiency_search_number,
    requirement_has_deficiency_search_all_mode,
    requirement_has_deficiency_search_sample_mode
} from '../../utils/requirement_deficiency_search.js';
import { get_searchable_text_for_requirement, sample_matches_status_filter } from './requirement_list_query.js';

function requirement_matches_search_term(
    req: unknown,
    search_term: string,
    raw_search_text: unknown,
    audit_frozen: boolean,
    deficiency_match_fn: ((search_number: number) => boolean) | null
): boolean {
    const search_number =
        audit_frozen && deficiency_match_fn ? parse_deficiency_search_number(raw_search_text) : null;

    // Låst/arkiverad + brist-id-format: endast krav med det brist-id:t (inte textsök i hjälptexter).
    if (search_number !== null && deficiency_match_fn) {
        return deficiency_match_fn(search_number);
    }

    return get_searchable_text_for_requirement(req).includes(search_term);
}

/**
 * @param {Array} items entries [req_id, req][] i alla-läge, annars kravobjekt[]
 * @param {object} filter_settings UI-filter (searchText, status m.m.)
 * @param {object} state mode, samples, relevant_ids_by_sample, current_sample_object, AuditLogic, audit_frozen
 * @returns {{ filtered_items: Array, total_count: number }}
 */
export function filter_requirements(items: any, filter_settings: any, state: any) {
    const {
        mode,
        samples,
        relevant_ids_by_sample,
        current_sample_object,
        AuditLogic,
        requirements,
        audit_frozen = false
    } = state;
    const status_filters = filter_settings.status || {};
    const has_status_filters = Object.keys(status_filters).length > 0;
    const requirement_needs_help_fn = AuditLogic?.requirement_needs_help || (() => false);
    const raw_search_text = filter_settings.searchText || '';

    if (mode === 'all') {
        const total_count = items.length;
        const search_term = prepareString(raw_search_text.trim());

        const filtered_items = items.filter(([req_id, req]: [any, any]) => {
            const candidates = new Set([String(req_id)]);
            if (req?.key) candidates.add(String(req.key));
            if (req?.id) candidates.add(String(req.id));

            const samples_for_req = samples.filter((sample: any) => {
                const sample_set = sample?.id ? relevant_ids_by_sample.get(sample.id) : null;
                if (!sample_set) return false;
                return [...candidates].some(id => sample_set.has(id));
            });

            const at_least_one_sample_matches = samples_for_req.some((sample: any) =>
                sample_matches_status_filter(
                    sample,
                    req_id,
                    req,
                    status_filters,
                    has_status_filters,
                    requirement_needs_help_fn,
                    AuditLogic,
                    requirements
                )
            );
            if (!at_least_one_sample_matches) return false;

            if (search_term) {
                return requirement_matches_search_term(
                    req,
                    search_term,
                    raw_search_text,
                    audit_frozen,
                    (search_number) =>
                        requirement_has_deficiency_search_all_mode(
                            req_id,
                            req,
                            samples_for_req,
                            requirements,
                            search_number
                        )
                );
            }
            return true;
        });

        return { filtered_items, total_count };
    }

    const total_count = items.length;
    const search_term = prepareString(raw_search_text.trim());

    const filtered_items = items.filter((req: any) => {
        const result = get_stored_requirement_result_for_def(
            current_sample_object.requirementResults,
            requirements,
            req
        );
        const display_status = result?.needsReview
            ? 'updated'
            : get_effective_requirement_audit_status(
                requirements,
                current_sample_object.requirementResults,
                req,
                null
            );
        const needs_help = requirement_needs_help_fn(result);
        const status_match = !has_status_filters || status_filters[display_status] === true;
        const needs_help_checked = status_filters.needs_help === true;
        const show_by_status = status_match || (needs_help_checked && needs_help);
        const hide_by_needs_help = status_filters.needs_help === false && needs_help;
        if (!show_by_status || hide_by_needs_help) return false;

        if (search_term) {
            return requirement_matches_search_term(
                req,
                search_term,
                raw_search_text,
                audit_frozen,
                (search_number) =>
                    requirement_has_deficiency_search_sample_mode(
                        current_sample_object.requirementResults,
                        requirements,
                        req,
                        search_number
                    )
            );
        }
        return true;
    });

    return { filtered_items, total_count };
}
