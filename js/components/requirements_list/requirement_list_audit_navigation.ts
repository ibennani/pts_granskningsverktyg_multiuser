/**
 * @fileoverview Navigering från kravlistan till kravgranskning, inkl. fokus på bristbeskrivning vid brist-id-sökning.
 */

import { set_pending_checklist_focus_target } from '../../app/browser_globals.js';
import { find_requirement_definition, get_stored_requirement_result_for_def } from '../../logic/audit_logic_lookup.js';
import type { RequirementResultStored } from '../../logic/audit_logic_types.js';
import {
    find_pass_criterion_by_deficiency_search,
    parse_deficiency_search_number
} from '../../utils/requirement_deficiency_search.js';

function is_audit_frozen(state: { auditStatus?: string } | null | undefined): boolean {
    return state?.auditStatus === 'locked' || state?.auditStatus === 'archived';
}

/**
 * Sätter väntande fokus på bristbeskrivning om användaren sökte på brist-id och navigerar till träffande krav/stickprov.
 */
export function prepare_deficiency_observation_focus_before_audit_navigation(options: {
    getState: () => { auditStatus?: string; samples?: unknown[]; ruleFileContent?: { requirements?: unknown }; uiSettings?: Record<string, { searchText?: string } | undefined> } | null | undefined;
    state_filter_key: string;
    sample_id: string;
    requirement_id: string;
}): void {
    const state = options.getState();
    if (!state || !is_audit_frozen(state)) return;

    const search_number = parse_deficiency_search_number(state.uiSettings?.[options.state_filter_key]?.searchText);
    if (search_number === null) return;

    const sample = (state.samples || []).find(
        (entry) => String((entry as { id?: string }).id) === String(options.sample_id)
    ) as { requirementResults?: unknown } | undefined;
    if (!sample) return;

    const requirements = state.ruleFileContent?.requirements;
    const req_def = find_requirement_definition(requirements, options.requirement_id);
    if (!req_def) return;

    const result = get_stored_requirement_result_for_def(
        sample.requirementResults as Record<string, RequirementResultStored> | null | undefined,
        requirements,
        req_def,
        options.requirement_id
    );
    const match = find_pass_criterion_by_deficiency_search(result, search_number);
    if (!match) return;

    set_pending_checklist_focus_target({
        action: 'focus_observation',
        check_id: match.check_id,
        pc_id: match.pc_id,
        set_at: Date.now()
    });
}
