/**
 * Snapshot: RequirementListComponent (stickprovsläge) med mockade krav.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as AuditLogic from '../../../js/audit_logic.js';
import { register_translation_module } from '../../../js/utils/translation_access.js';
import { ActionTypes as StoreActionTypes } from '../../../js/state/actionTypes.js';

const snapshot_spec_dir = path.dirname(fileURLToPath(import.meta.url));
const fixture_rule = JSON.parse(
    fs.readFileSync(path.join(snapshot_spec_dir, '../../fixtures/minimal-rulefile.json'), 'utf8')
);

/** Två krav för att verifiera radantal */
const rule_two_req = {
    ...fixture_rule,
    requirements: {
        req1: { id: 'req1', key: 'req1', title: 'Krav ett' },
        req2: { id: 'req2', key: 'req2', title: 'Krav två' },
    },
};

function build_translation() {
    const map = {
        requirement_list_title_suffix: 'Krav för stickprov',
        error_no_active_audit: 'Ingen aktiv granskning',
        error_no_sample_selected: 'Inget stickprov',
        error_sample_not_found: 'Stickprov saknas',
        uncategorized: 'Övrigt',
        other_requirements: 'Övriga krav',
        requirement_status_not_audited: 'Ej granskad',
        requirement_status_passed: 'Godkänd',
        requirement_status_failed: 'Underkänd',
        requirement_status_partially_audited: 'Delvis',
        requirement_status_not_applicable: 'Saknar relevans',
        filter_search_placeholder: 'Sök',
        filter_sort_label: 'Sortera',
        filter_status_label: 'Status',
        all_statuses: 'Alla',
        requirement_list_results_summary: 'Visar {filtered} av {total}',
        results_summary_template: '{filteredCount} av {totalCount}',
        requirements_audited_for_sample: 'Granskade krav',
        audit_status_assessments_total: 'Krav-bedömningar totalt: {total}',
        audit_status_distribution_region_label: 'Kravstatusfördelning',
        audit_status_passed: 'Ingen anmärkning',
        audit_status_partially_audited: 'Delvis granskad',
        audit_status_failed: 'Underkänt',
        audit_status_not_audited: 'Ej granskat',
        audit_overview_distribution_heading: 'Fördelning',
        audit_overview_distribution_passed: 'Ingen anmärkning',
        audit_overview_distribution_partial: 'Delvis granskad',
        audit_overview_distribution_failed: 'Underkänt',
        audit_overview_distribution_remaining: 'Återstår',
        audit_overview_distribution_count_suffix: ' st.',
        no_requirements_match_filter: 'Inga krav matchar',
        page_type: 'Sidtyp',
        undefined_description: 'Beskrivning',
    };
    return {
        t: (key, opts = {}) => {
            let s = map[key] ?? key;
            Object.entries(opts).forEach(([k, v]) => {
                s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
            });
            return s;
        },
        get_current_language_code: () => 'sv-SE',
    };
}

describe('RequirementListComponent snapshot', () => {
    beforeEach(() => {
        register_translation_module(build_translation());
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.Helpers;
        delete window.Translation;
    });

    test('renderar lista med två kravrader', async () => {
        const HelpersNs = await import('../../../js/utils/helpers.js');
        const Helpers = {
            ...HelpersNs,
            load_css: jest.fn().mockResolvedValue(undefined),
        };

        const { RequirementListComponent } = await import('../../../js/components/RequirementListComponent.js');

        const mock_state = {
            auditStatus: 'in_progress',
            ruleFileContent: rule_two_req,
            samples: [
                {
                    id: 'sp-1',
                    description: 'Stickprov A',
                    sampleType: 'Webbsida',
                    sampleCategory: 'cat1',
                    selectedContentTypes: [],
                    requirementResults: {},
                },
            ],
            uiSettings: {
                requirementListFilter: {
                    searchText: '',
                    sortBy: 'ref_asc',
                },
            },
        };

        const root = document.createElement('div');
        document.body.appendChild(root);

        const comp = new RequirementListComponent();
        window.Helpers = Helpers;
        window.Translation = build_translation();
        await comp.init({
            root,
            deps: {
                router: jest.fn(),
                getState: () => mock_state,
                dispatch: jest.fn(),
                StoreActionTypes,
                subscribe: (fn) => () => {},
                Translation: build_translation(),
                Helpers,
                AuditLogic,
                NotificationComponent: {
                    append_global_message_areas_to: jest.fn(),
                    show_global_message: jest.fn(),
                    clear_global_message: jest.fn(),
                },
                params: { sampleId: 'sp-1' },
            },
        });
        await comp.render();

        const links = root.querySelectorAll('a.list-title-link[data-requirement-id]');
        expect(links.length).toBe(2);

        expect(root.innerHTML).toMatchSnapshot();
    });
});
