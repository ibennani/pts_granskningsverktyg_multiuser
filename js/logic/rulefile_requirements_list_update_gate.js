/**
 * @fileoverview Avgör om regelfilens kravlista behöver uppdateras vid state-ändringar.
 */

/** Actions som påverkar listans innehåll, filter eller sortering. */
const REPOPULATE_ACTIONS = new Set([
    'SET_UI_FILTER_SETTINGS',
    'SET_RULE_FILE_CONTENT',
    'UPDATE_RULEFILE_CONTENT',
    'REPLACE_RULEFILE_AND_RECONCILE',
    'REPLACE_RULEFILE_FROM_REMOTE',
    'UPDATE_REQUIREMENT_DEFINITION',
    'ADD_REQUIREMENT_DEFINITION',
    'DELETE_REQUIREMENT_DEFINITION',
    'DELETE_CHECK_FROM_REQUIREMENT',
    'DELETE_CRITERION_FROM_CHECK',
    'SET_RULEFILE_EDIT_BASELINE',
    'INITIALIZE_RULEFILE_EDITING'
]);

/**
 * @param {string|undefined|null} action_type
 * @returns {boolean}
 */
export function should_repopulate_rulefile_requirements_list(action_type) {
    if (!action_type) return true;
    return REPOPULATE_ACTIONS.has(action_type);
}

/**
 * Fingeravtryck för filtrerad/sorterad kravlista — undviker onödig DOM-ombyggnad.
 * @param {object|null|undefined} filter_settings
 * @param {Array<{ key?: string, title?: string, standardReference?: { text?: string } }>} sorted_requirements
 * @returns {string}
 */
export function fingerprint_rulefile_requirements_list_view(filter_settings, sorted_requirements) {
    const items = (sorted_requirements || []).map((req) => [
        req?.key || '',
        req?.title || '',
        req?.standardReference?.text || ''
    ].join('\u0001'));
    return JSON.stringify({
        searchText: filter_settings?.searchText || '',
        sortBy: filter_settings?.sortBy || 'ref_asc',
        items
    });
}
