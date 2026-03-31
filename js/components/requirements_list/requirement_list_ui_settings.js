/**
 * Normalisering av filter-/toolbar-inställningar för kravlistor.
 * @module js/components/requirements_list/requirement_list_ui_settings
 */

import { get_reference_string_for_sort } from './requirement_list_query.js';

/** Samma default som högerspalten */
export const DEFAULT_REQUIREMENT_LIST_STATUS = {
    needs_help: true,
    passed: true,
    failed: true,
    partially_audited: true,
    not_audited: true,
    updated: true
};

const STATUS_KEYS_FOR_TOOLBAR = ['needs_help', 'passed', 'failed', 'partially_audited', 'not_audited', 'updated'];

/**
 * @param {object} current_ui_settings
 * @returns {object}
 */
export function ensure_default_status_filter(current_ui_settings) {
    if (!current_ui_settings.status || Object.keys(current_ui_settings.status).length === 0) {
        return { ...current_ui_settings, status: { ...DEFAULT_REQUIREMENT_LIST_STATUS } };
    }
    return current_ui_settings;
}

/**
 * @param {string} mode
 * @param {Array} entries
 * @param {object[]} all_relevant_requirements
 * @param {object} current_ui_settings
 * @returns {string|null} ref_asc, title_asc eller null om ingen ändring
 */
export function compute_auto_sort_by_override(mode, entries, all_relevant_requirements, current_ui_settings) {
    if (current_ui_settings.sortBy && current_ui_settings.sortBy !== 'default') {
        return null;
    }
    const requirements_to_check = mode === 'all' ? entries : all_relevant_requirements;
    const has_any_reference = requirements_to_check.some((item) => {
        if (mode === 'all') {
            const [, req] = item;
            const ref = get_reference_string_for_sort(req);
            return ref && ref.trim() !== '';
        }
        const ref = item.standardReference?.text;
        return ref && typeof ref === 'string' && ref.trim() !== '';
    });
    return has_any_reference ? 'ref_asc' : 'title_asc';
}

/**
 * @param {object} current_ui_settings
 * @returns {{ searchText: string, sortBy: string, status: object }}
 */
export function build_toolbar_initial_filter_state(current_ui_settings) {
    return {
        searchText: current_ui_settings.searchText || '',
        sortBy: current_ui_settings.sortBy || 'ref_asc',
        status: { ...DEFAULT_REQUIREMENT_LIST_STATUS, ...(current_ui_settings.status || {}) }
    };
}

/**
 * @param {object} current_ui_settings
 * @returns {object}
 */
export function normalize_status_for_toolbar(current_ui_settings) {
    const status_from_store = current_ui_settings.status || {};
    const normalized_status = { ...DEFAULT_REQUIREMENT_LIST_STATUS };
    STATUS_KEYS_FOR_TOOLBAR.forEach(key => {
        if (status_from_store[key] !== undefined) {
            normalized_status[key] = status_from_store[key] === true;
        }
    });
    return normalized_status;
}
