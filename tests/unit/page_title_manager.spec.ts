/**
 * Tester för page_title_manager.ts
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
    build_page_title,
    get_page_title_prefix,
    updatePageTitle,
    updatePageTitleFromCurrentView,
    type PageTitleAppState,
    type PageTitleContext,
    type PageTitleRouteParams
} from '../../js/logic/page_title_manager.ts';

/** Rik översättningskarta för switch och regelfilsgrenar */
function make_t_simple() {
    const map: Record<string, string> = {
        app_title: 'Leffe',
        app_title_suffix: 'Digital tillsyn',
        menu_link_manage_audits: 'Alla ärenden',
        audit_title: 'Granskning',
        audit_title_audits: 'Mina granskningar',
        audit_title_rules: 'Regler',
        manage_users_title: 'Användare',
        menu_link_my_settings: 'Inställningar',
        menu_link_statistics: 'Statistik',
        login_title: 'Logga in',
        audit_metadata_title: 'Metadata',
        edit_audit_metadata_title: 'Redigera metadata',
        manage_samples_title: 'Granskningsdel',
        edit_sample: 'Redigera granskningsdel',
        add_new_sample: 'Ny granskningsdel',
        sample_edit_confirm_dialog_title: 'Bekräfta',
        audit_overview_title: 'Översikt',
        audit_actions_title: 'Åtgärder',
        audit_actions_manage_title: 'Hantera granskning',
        audit_actions_downloads_title: 'Bilagor och exportfunktioner',
        audit_actions_snapshots_title: 'Snapshots',
        audit_actions_information_title: 'Granskningsinformation',
        audit_actions_appendix_templates_title: 'Bilagornas malltexter',
        audit_appendix_1_view_title: 'Bilaga 1',
        audit_appendix_1_edit_title: 'Redigera Bilaga 1',
        audit_appendix_2_view_title: 'Bilaga 2',
        audit_appendix_2_edit_title: 'Redigera Bilaga 2',
        audit_appendix_3_view_title: 'Bilaga 3',
        audit_appendix_3_edit_title: 'Redigera Bilaga 3',
        left_menu_all_requirements: 'Alla krav',
        audit_problems_title: 'Problem',
        audit_images_title: 'Bilder',
        requirement_list_title_suffix: 'Kravlista',
        update_rulefile_title: 'Uppdatera regelfil',
        handle_updated_assessments_title: 'Uppdateringar ',
        final_confirm_updates_title: 'Slutlig bekräftelse',
        edit_rulefile_title: 'Redigera regelfil',
        rulefile_requirements_menu_title: 'Krav',
        rulefile_view_requirement_title: 'Visa krav',
        rulefile_edit_requirement_title: 'Redigera krav',
        rulefile_add_requirement_title: 'Nytt krav',
        rulefile_metadata_edit_title: 'Metadata regelfil',
        rulefile_sections_edit_general_title: 'Allmänt (sektion)',
        rulefile_sections_edit_page_types_title: 'Sidtyper (sektion)',
        rulefile_sections_title: 'Sektioner',
        menu_link_backups: 'Backuper',
        rulefile_confirm_delete_title: 'Ta bort krav',
        confirm_delete_check_title: 'Ta bort kontroll',
        confirm_delete_criterion_title: 'Ta bort kriterium',
        page_title_requirement: 'Krav:',
        undefined_description: '(saknar beskrivning)',
        rulefile_section_general_title: 'Allmänt',
        rulefile_metadata_section_page_types: 'Sidtyper',
        rulefile_metadata_section_content_types: 'Innehållstyper',
        rulefile_section_sample_types_title: 'Granskningsdelstyper',
        rulefile_section_info_blocks_order_title: 'Informationsblock',
        rulefile_section_classifications_title: 'Klassificeringar',
        rulefile_section_appendix_templates_title: 'Mall'
    };
    return (key: string, vars?: Record<string, unknown>) => {
        if (key === 'handle_updated_assessments_title' && vars?.count === '') return 'Uppdateringar';
        return map[key] ?? key;
    };
}

describe('page_title_manager', () => {
    let getState: () => PageTitleAppState;
    const Translation: PageTitleContext['Translation'] = { t: make_t_simple() };

    beforeEach(() => {
        document.title = '';
        getState = () => ({
            auditStatus: 'not_started',
            auditMetadata: {},
            uiSettings: {},
            samples: [],
            ruleFileContent: null
        });
    });

    afterEach(() => {
        document.title = '';
        window.history.pushState({}, '', '/');
    });

    test('build_page_title returnerar suffix och vytext', () => {
        const title = build_page_title('start', {}, { getState, Translation });
        expect(title).toContain('Alla ärenden');
        expect(title).toContain('Digital tillsyn');
    });

    test('get_page_title_prefix för huvudvyer i switch', () => {
        const cases: [string, PageTitleRouteParams, string][] = [
            ['start', {}, 'Alla ärenden'],
            ['audit', {}, 'Granskning'],
            ['audit_audits', {}, 'Mina granskningar'],
            ['audit_rules', {}, 'Regler'],
            ['manage_users', {}, 'Användare'],
            ['my_settings', {}, 'Inställningar'],
            ['statistics', {}, 'Statistik'],
            ['login', {}, 'Logga in'],
            ['metadata', {}, 'Metadata'],
            ['edit_metadata', {}, 'Redigera metadata'],
            ['sample_management', {}, 'Granskningsdel'],
            ['confirm_sample_edit', {}, 'Bekräfta'],
            ['audit_overview', {}, 'Översikt'],
            ['audit_actions', {}, 'Åtgärder'],
            ['audit_actions', { section: 'manage' }, 'Hantera granskning'],
            ['audit_actions', { section: 'downloads' }, 'Bilagor och exportfunktioner'],
            ['audit_actions', { section: 'snapshots' }, 'Snapshots'],
            ['audit_actions', { section: 'information' }, 'Granskningsinformation'],
            ['audit_actions', { section: 'appendix_templates' }, 'Bilagornas malltexter'],
            ['audit_actions', { section: 'appendix_templates', appendix: '1' }, 'Bilaga 1'],
            ['audit_actions', { section: 'appendix_templates', appendix: '1', edit: 'true' }, 'Redigera Bilaga 1'],
            ['audit_settings', {}, 'Granskningsinformation'],
            ['all_requirements', {}, 'Alla krav'],
            ['audit_problems', {}, 'Problem'],
            ['audit_images', {}, 'Bilder'],
            ['requirement_list', {}, 'Kravlista'],
            ['update_rulefile', {}, 'Uppdatera regelfil'],
            ['confirm_updates', {}, 'Uppdateringar'],
            ['final_confirm_updates', {}, 'Slutlig bekräftelse'],
            ['edit_rulefile_main', {}, 'Redigera regelfil'],
            ['rulefile_requirements', {}, 'Krav'],
            ['rulefile_view_requirement', {}, 'Krav'],
            ['rulefile_edit_requirement', {}, 'Redigera krav'],
            ['rulefile_add_requirement', {}, 'Nytt krav'],
            ['rulefile_metadata_edit', {}, 'Metadata regelfil'],
            ['rulefile_sections_edit_general', {}, 'Allmänt (sektion)'],
            ['rulefile_sections_edit_page_types', {}, 'Sidtyper (sektion)'],
            ['rulefile_sections', {}, 'Sektioner'],
            ['backup', {}, 'Backuper'],
            ['backup_detail', {}, 'Backuper'],
            ['backup_settings', {}, 'Backuper']
        ];
        for (const [view, params, expected] of cases) {
            expect(get_page_title_prefix(view, params, { getState, Translation })).toBe(expected);
        }
    });

    test('sample_form: redigera vs nytt', () => {
        expect(get_page_title_prefix('sample_form', {}, { getState, Translation })).toBe('Ny granskningsdel');
        expect(
            get_page_title_prefix('sample_form', { editSampleId: '1' }, { getState, Translation })
        ).toBe('Redigera granskningsdel');
    });

    test('confirm_delete: requirement, check, criterion', () => {
        expect(
            get_page_title_prefix('confirm_delete', { type: 'requirement' }, { getState, Translation })
        ).toBe('Ta bort krav');
        expect(
            get_page_title_prefix('confirm_delete', { type: 'check' }, { getState, Translation })
        ).toBe('Ta bort kontroll');
        expect(
            get_page_title_prefix('confirm_delete', { type: 'criterion' }, { getState, Translation })
        ).toBe('Ta bort kriterium');
    });

    test('requirement_audit: sidebar läge granskningsdel visar beskrivning', () => {
        getState = () => ({
            auditStatus: 'in_progress',
            auditMetadata: {},
            uiSettings: { requirementAuditSidebar: { selectedMode: 'requirement_samples' } },
            samples: [{ id: 's9', description: 'Stick A' }],
            ruleFileContent: { requirements: {} }
        });
        expect(
            get_page_title_prefix('requirement_audit', { sampleId: 's9' }, { getState, Translation })
        ).toBe('Stick A');
    });

    test('requirement_audit: kravläge med titel från map', () => {
        getState = () => ({
            auditStatus: 'in_progress',
            auditMetadata: {},
            uiSettings: { requirementAuditSidebar: { selectedMode: 'other' } },
            samples: [],
            ruleFileContent: {
                requirements: {
                    k1: { id: 'k1', title: 'Brandskydd' }
                }
            }
        });
        const prefix = get_page_title_prefix(
            'requirement_audit',
            { requirementId: 'k1' },
            { getState, Translation }
        );
        expect(prefix).toContain('Brandskydd');
        expect(prefix).toContain('Krav:');
    });

    test('requirement_audit: matchar krav via key när id är nyckel', () => {
        getState = () => ({
            auditStatus: 'in_progress',
            auditMetadata: {},
            uiSettings: {},
            samples: [],
            ruleFileContent: {
                requirements: {
                    x2: { key: 'x2', title: 'Via key' }
                }
            }
        });
        const prefix = get_page_title_prefix(
            'requirement_audit',
            { requirementId: 'x2' },
            { getState, Translation }
        );
        expect(prefix).toContain('Via key');
    });

    test('prefix vid regelfilsredigering: sektioner och vyer', () => {
        const rf_state: PageTitleAppState = {
            auditStatus: 'rulefile_editing',
            auditMetadata: {},
            uiSettings: {},
            samples: [],
            ruleFileContent: {}
        };
        const gs = () => rf_state;
        expect(
            get_page_title_prefix('rulefile_sections', { section: 'content_types' }, { getState: gs, Translation })
        ).toBe('Innehållstyper');
        expect(
            get_page_title_prefix('rulefile_metadata_edit', { section: 'page_types' }, { getState: gs, Translation })
        ).toBe('Sidtyper');
        expect(
            get_page_title_prefix('confirm_delete', { type: 'requirement' }, { getState: gs, Translation })
        ).toBe('Krav');
        expect(
            get_page_title_prefix('edit_rulefile_main', {}, { getState: gs, Translation })
        ).toBe('Allmänt');
    });

    test('rulefile_edit_requirement: kravets titel i sidtitel-prefix', () => {
        getState = () => ({
            auditStatus: 'not_started',
            auditMetadata: {},
            uiSettings: {},
            samples: [],
            ruleFileContent: {
                requirements: {
                    rk1: { title: 'Brandskyddsnivå' }
                }
            }
        });
        expect(
            get_page_title_prefix(
                'rulefile_edit_requirement',
                { id: 'rk1' },
                { getState, Translation }
            )
        ).toBe('Redigera krav | Brandskyddsnivå');
        expect(
            build_page_title(
                'rulefile_edit_requirement',
                { id: 'rk1' },
                { getState, Translation }
            )
        ).toBe('Redigera krav | Brandskyddsnivå | Digital tillsyn');
    });

    test('rulefile_edit_requirement: i regelfilsredigeringsläge samma format', () => {
        const gs = () => ({
            auditStatus: 'rulefile_editing' as const,
            auditMetadata: {},
            uiSettings: {},
            samples: [],
            ruleFileContent: {
                requirements: {
                    rk1: { title: 'E-tjänst' }
                }
            }
        });
        expect(
            get_page_title_prefix('rulefile_edit_requirement', { id: 'rk1' }, { getState: gs, Translation })
        ).toBe('Redigera krav | E-tjänst');
    });

    test('rulefile_view_requirement: Krav | kravets titel i sidtitel-prefix', () => {
        getState = () => ({
            auditStatus: 'not_started',
            auditMetadata: {},
            uiSettings: {},
            samples: [],
            ruleFileContent: {
                requirements: {
                    rk1: { title: 'Brandskyddsnivå' }
                }
            }
        });
        expect(
            get_page_title_prefix(
                'rulefile_view_requirement',
                { id: 'rk1' },
                { getState, Translation }
            )
        ).toBe('Krav | Brandskyddsnivå');
        expect(
            build_page_title(
                'rulefile_view_requirement',
                { id: 'rk1' },
                { getState, Translation }
            )
        ).toBe('Krav | Brandskyddsnivå | Digital tillsyn');
    });

    test('rulefile_view_requirement: i regelfilsredigeringsläge samma format', () => {
        const gs = () => ({
            auditStatus: 'rulefile_editing' as const,
            auditMetadata: {},
            uiSettings: {},
            samples: [],
            ruleFileContent: {
                requirements: {
                    rk1: { title: 'E-tjänst' }
                }
            }
        });
        expect(
            get_page_title_prefix('rulefile_view_requirement', { id: 'rk1' }, { getState: gs, Translation })
        ).toBe('Krav | E-tjänst');
    });

    test('build_page_title med actorName och metadata-vy', () => {
        getState = () => ({
            auditStatus: 'in_progress',
            auditMetadata: { actorName: 'Bolag XY' },
            uiSettings: {},
            samples: [],
            ruleFileContent: { requirements: {} }
        });
        const title = build_page_title('metadata', {}, { getState, Translation });
        expect(title.startsWith('Bolag XY |')).toBe(true);
        expect(title).toContain('Metadata');
    });

    test('build_page_title utan actor utanför granskning', () => {
        const title = build_page_title('start', {}, { getState, Translation });
        expect(title.startsWith('Bolag')).toBe(false);
        expect(title).toContain('Alla ärenden');
    });

    test('build_page_title är identisk på test-server och v2', () => {
        const title_v2 = (() => {
            window.history.pushState({}, '', '/v2/');
            return build_page_title('start', {}, { getState, Translation });
        })();
        const title_test = (() => {
            window.history.pushState({}, '', '/test-server/');
            return build_page_title('start', {}, { getState, Translation });
        })();
        expect(title_test).toBe(title_v2);
        expect(title_test).toContain('Alla ärenden');
    });

    test('updatePageTitle med testserver-prefix på /test-server/', () => {
        window.history.pushState({}, '', '/test-server/');
        updatePageTitle('start', {}, { getState, Translation });
        expect(document.title.startsWith('Testserver Leffe: ')).toBe(true);
        expect(document.title).toContain('Alla ärenden');
    });

    test('updatePageTitle utan testserver-prefix på /v2/', () => {
        window.history.pushState({}, '', '/v2/');
        updatePageTitle('start', {}, { getState, Translation });
        expect(document.title.startsWith('Testserver Leffe: ')).toBe(false);
        expect(document.title).toContain('Alla ärenden');
    });

    test('updatePageTitle skriver document.title', () => {
        updatePageTitle('start', {}, { getState, Translation });
        expect(document.title).toContain('Alla ärenden');
    });

    test('updatePageTitleFromCurrentView använder aktuell vy', () => {
        updatePageTitleFromCurrentView({
            getState,
            Translation,
            get_current_view_name: () => 'audit',
            get_current_view_params_json: () => '{}'
        });
        expect(document.title).toContain('Granskning');
    });

    test('get_page_title_prefix utan Translation använder fallback-nycklar', () => {
        const prefix = get_page_title_prefix('start', {}, { getState, Translation: null });
        expect(prefix).toContain('menu_link_manage_audits');
    });
});
