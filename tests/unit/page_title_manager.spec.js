/**
 * Tester för page_title_manager.js
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
    build_page_title,
    get_page_title_prefix,
    updatePageTitle,
    updatePageTitleFromCurrentView
} from '../../js/logic/page_title_manager.js';

function make_t() {
    const map = {
        app_title: 'Leffe',
        app_title_suffix: 'Digital tillsyn',
        menu_link_manage_audits: 'Hantera granskningar',
        audit_title: 'Granskning',
        manage_users_title: 'Användare',
        login_title: 'Logga in',
        audit_metadata_title: 'Metadata',
        rulefile_section_general_title: 'Allmänt',
        rulefile_sections_title: 'Sektioner'
    };
    return (key) => map[key] ?? key;
}

describe('page_title_manager', () => {
    let getState;
    const Translation = { t: make_t() };

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
    });

    test('build_page_title returnerar suffix och vytext', () => {
        const title = build_page_title('start', {}, { getState, Translation });
        expect(title).toContain('Hantera granskningar');
        expect(title).toContain('Digital tillsyn');
    });

    test('get_page_title_prefix för kända vyer', () => {
        expect(get_page_title_prefix('start', {}, { getState, Translation })).toBe('Hantera granskningar');
        expect(get_page_title_prefix('audit', {}, { getState, Translation })).toBe('Granskning');
        expect(get_page_title_prefix('manage_users', {}, { getState, Translation })).toBe('Användare');
        expect(get_page_title_prefix('login', {}, { getState, Translation })).toBe('Logga in');
    });

    test('prefix vid regelfilsredigering och sektion', () => {
        getState = () => ({
            auditStatus: 'rulefile_editing',
            auditMetadata: {},
            uiSettings: {},
            samples: [],
            ruleFileContent: {}
        });
        const prefix = get_page_title_prefix(
            'rulefile_sections',
            { section: 'page_types' },
            { getState, Translation }
        );
        expect(prefix).not.toBe('Leffe');
    });

    test('build_page_title prefixar med aktör inne i granskning', () => {
        getState = () => ({
            auditStatus: 'in_progress',
            auditMetadata: { actorName: '  Test AB  ' },
            uiSettings: {},
            samples: [],
            ruleFileContent: { requirements: {} }
        });
        const title = build_page_title('metadata', {}, { getState, Translation });
        expect(title.startsWith('Test AB |')).toBe(true);
        expect(title).toContain('Metadata');
    });

    test('updatePageTitle skriver document.title', () => {
        updatePageTitle('start', {}, { getState, Translation });
        expect(document.title.length).toBeGreaterThan(0);
        expect(document.title).toContain('Hantera granskningar');
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
