/**
 * Snapshot: AuditOverviewComponent med minimal mockad state.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register_translation_module } from '../../../js/utils/translation_access.js';

const snapshot_spec_dir = path.dirname(fileURLToPath(import.meta.url));
const client_module_abs = path.resolve(snapshot_spec_dir, '../../../js/api/client.js');
const fixture_rule = JSON.parse(
    fs.readFileSync(path.join(snapshot_spec_dir, '../../fixtures/minimal-rulefile.json'), 'utf8')
);

function build_translation() {
    const map = {
        audit_overview_title: 'Granskningsöversikt',
        total_audit_progress_header: 'Klart hittills',
        total_requirements_audited_label: 'Granskade krav',
        audit_overview_progress_core: '{audited} / {total} kontroller ({pct} %)',
        audit_overview_distribution_heading: 'Fördelning av kontroller',
        audit_overview_distribution_passed: 'Ingen anmärkning',
        audit_overview_distribution_partial: 'Delvis granskad',
        audit_overview_distribution_failed: 'Underkänt',
        audit_overview_distribution_remaining: 'Återstår',
        audit_overview_distribution_count_suffix: ' st.',
        audit_status_assessments_total: 'Krav-bedömningar totalt: {total}',
        audit_status_distribution_region_label: 'Kravstatusfördelning',
        audit_status_passed: 'Ingen anmärkning',
        audit_status_partially_audited: 'Delvis granskad',
        audit_status_failed: 'Underkänt',
        audit_status_not_audited: 'Ej granskat',
        result_summary_and_deficiency_analysis: 'Resultat och bristindex',
        audit_info_title: 'Granskningsinformation',
        case_number: 'Mål / ID',
        actor_name: 'Aktör',
        auditor_name: 'Granskare',
        case_handler: 'Handläggare',
        rule_file_title: 'Regelfil',
        version_rulefile: 'Version',
        status: 'Status',
        start_time: 'Start',
        end_time: 'Slut',
        audit_status_locked: 'Låst',
        deficiency_index_title: 'Bristindex',
        lower_is_better: 'Lägre är bättre',
        based_on_samples: 'Baserat på stickprov',
        score_by_principle_deficiency: 'Per princip',
        perceivable: 'Upplevbar',
        operable: 'Hanterbar',
        understandable: 'Begriplig',
        robust: 'Robust',
        uncategorized: 'Övrigt',
        other_requirements: 'Övriga krav',
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

describe('AuditOverviewComponent snapshot', () => {
    beforeEach(() => {
        jest.resetModules();
        register_translation_module(build_translation());
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.Helpers;
        delete window.Translation;
    });

    test('renderar översikt med rubrik, progress och bristindex', async () => {
        jest.unstable_mockModule(client_module_abs, () => ({
            get_rules: jest.fn().mockResolvedValue([]),
        }));

        const Helpers = await import('../../../js/utils/helpers.js');
        const AuditLogic = await import('../../../js/audit_logic.js');
        const { AuditOverviewComponent } = await import('../../../js/components/AuditOverviewComponent.js');

        const mock_state = {
            auditStatus: 'locked',
            auditMetadata: {
                caseNumber: 'SNAP-1',
                actorName: 'Snap Aktör',
                actorLink: '',
                auditorName: 'Snap Granskare',
                caseHandler: '',
                internalComment: '',
            },
            ruleFileContent: fixture_rule,
            samples: [
                {
                    id: 'sample-1',
                    description: 'S1',
                    selectedContentTypes: [],
                    requirementResults: {},
                },
            ],
            startTime: null,
            endTime: null,
        };

        const root = document.createElement('div');
        document.body.appendChild(root);

        const translation = build_translation();
        window.Helpers = Helpers;
        window.Translation = translation;

        const comp = new AuditOverviewComponent();
        await comp.init({
            root,
            deps: {
                router: jest.fn(),
                getState: () => mock_state,
                dispatch: jest.fn(),
                StoreActionTypes: {},
                subscribe: (fn) => () => {},
                Translation: translation,
                Helpers,
                NotificationComponent: {
                    append_global_message_areas_to: (el) => {
                        const z = document.createElement('div');
                        z.className = 'global-msg-mock';
                        el.appendChild(z);
                    },
                },
                ExportLogic: {},
                AuditLogic,
            },
        });
        comp.render();

        const h1 = root.querySelector('h1');
        expect(h1).toBeTruthy();
        expect(h1.textContent).toContain('Granskningsöversikt');
        expect(root.querySelector('.info-item--progress-container')).toBeTruthy();
        expect(root.querySelector('.score-analysis-content')).toBeTruthy();

        expect(root.innerHTML).toMatchSnapshot();
    });
});
