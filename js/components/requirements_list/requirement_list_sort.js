/**
 * Sortering och sorteringsalternativ för kravlistor.
 * @module js/components/requirements_list/requirement_list_sort
 */

import {
    compare_strings_locale,
    get_aggregated_display_status_for_requirement,
    get_reference_string_for_sort
} from './requirement_list_query.js';

/**
 * @param {string} mode
 * @returns {Array<{ value: string, textKey: string, defaultValue?: string }>}
 */
export function get_sort_options(mode) {
    if (mode === 'all') {
        return [
            { value: 'ref_asc', textKey: 'sort_option_ref_asc_natural' },
            { value: 'ref_desc', textKey: 'sort_option_ref_desc_natural' },
            { value: 'title_asc', textKey: 'sort_option_title_asc' },
            { value: 'title_desc', textKey: 'sort_option_title_desc' },
            { value: 'updated_first', textKey: 'sort_option_updated_first' }
        ];
    }
    return [
        { value: 'ref_asc', textKey: 'sort_option_ref_asc_natural', defaultValue: 'Reference (Ascending)' },
        { value: 'ref_desc', textKey: 'sort_option_ref_desc_natural', defaultValue: 'Reference (Descending)' },
        { value: 'title_asc', textKey: 'sort_option_title_asc', defaultValue: 'Title (A-Z)' },
        { value: 'title_desc', textKey: 'sort_option_title_desc', defaultValue: 'Title (Z-A)' },
        { value: 'updated_first', textKey: 'sort_option_updated_first', defaultValue: 'Updated First' }
    ];
}

/**
 * @param {string} mode
 * @param {Array} items
 * @param {string} sort_by
 * @param {object|null|undefined} current_sample_object
 * @param {object[]} samples
 * @param {Map<string, Set<string>>|null|undefined} relevant_ids_by_sample
 * @param {object} AuditLogic
 * @param {object} Helpers
 * @returns {Array}
 */
export function sort_items(mode, items, sort_by, current_sample_object, samples, relevant_ids_by_sample, AuditLogic, Helpers) {
    const sorted = [...items];

    if (mode === 'all') {
        if (sort_by === 'title_asc') {
            sorted.sort((a, b) => compare_strings_locale(a?.[1]?.title, b?.[1]?.title));
        } else if (sort_by === 'title_desc') {
            sorted.sort((a, b) => compare_strings_locale(b?.[1]?.title, a?.[1]?.title));
        } else if (sort_by === 'ref_asc') {
            sorted.sort((a, b) => {
                const ref_a = get_reference_string_for_sort(a?.[1]);
                const ref_b = get_reference_string_for_sort(b?.[1]);
                if (Helpers?.natural_sort) {
                    return Helpers.natural_sort(ref_a || 'Z', ref_b || 'Z');
                }
                return compare_strings_locale(ref_a, ref_b);
            });
        } else if (sort_by === 'ref_desc') {
            sorted.sort((a, b) => {
                const ref_a = get_reference_string_for_sort(a?.[1]);
                const ref_b = get_reference_string_for_sort(b?.[1]);
                if (Helpers?.natural_sort) {
                    return Helpers.natural_sort(ref_b || 'Z', ref_a || 'Z');
                }
                return compare_strings_locale(ref_b, ref_a);
            });
        } else if (sort_by === 'updated_first') {
            sorted.sort((a, b) => {
                const status_a = get_aggregated_display_status_for_requirement(a?.[0], a?.[1], samples, relevant_ids_by_sample, AuditLogic);
                const status_b = get_aggregated_display_status_for_requirement(b?.[0], b?.[1], samples, relevant_ids_by_sample, AuditLogic);
                const a_updated = status_a === 'updated' ? 0 : 1;
                const b_updated = status_b === 'updated' ? 0 : 1;
                if (a_updated !== b_updated) return a_updated - b_updated;
                const ref_a = get_reference_string_for_sort(a?.[1]);
                const ref_b = get_reference_string_for_sort(b?.[1]);
                return Helpers?.natural_sort(ref_a || 'Z', ref_b || 'Z') || 0;
            });
        }
    } else {
        const sort_function = {
            'ref_asc': (a, b) => Helpers.natural_sort(a.standardReference?.text || 'Z', b.standardReference?.text || 'Z'),
            'ref_desc': (a, b) => Helpers.natural_sort(b.standardReference?.text || 'Z', a.standardReference?.text || 'Z'),
            'title_asc': (a, b) => (a.title || '').localeCompare(b.title || ''),
            'title_desc': (a, b) => (b.title || '').localeCompare(a.title || ''),
            'updated_first': (a, b) => {
                const resA = (current_sample_object.requirementResults || {})[a.key];
                const resB = (current_sample_object.requirementResults || {})[b.key];
                const isAUpdated = resA?.needsReview === true ? 0 : 1;
                const isBUpdated = resB?.needsReview === true ? 0 : 1;
                if (isAUpdated !== isBUpdated) {
                    return isAUpdated - isBUpdated;
                }
                return Helpers.natural_sort(a.standardReference?.text || 'Z', b.standardReference?.text || 'Z');
            }
        };
        const effectiveSortKey = sort_function.hasOwnProperty(sort_by) ? sort_by : 'ref_asc';
        sorted.sort(sort_function[effectiveSortKey]);
    }

    return sorted;
}
