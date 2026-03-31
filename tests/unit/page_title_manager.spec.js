import { describe, test, expect, beforeEach } from '@jest/globals';
import { build_page_title, get_page_title_prefix } from '../../js/logic/page_title_manager.js';

function make_t() {
    const map = {
        app_title: 'Leffe',
        app_title_suffix: 'Digital tillsyn',
        menu_link_manage_audits: 'Hantera granskningar',
        audit_title: 'Granskning',
        manage_users_title: 'Användare',
        login_title: 'Logga in',
    };
    return (key) => map[key] ?? key;
}

describe('page_title_manager', () => {
    let getState;

    beforeEach(() => {
        getState = () => ({
            auditStatus: 'not_started',
            auditMetadata: {},
            uiSettings: {},
            samples: [],
            ruleFileContent: null,
        });
    });

    test('build_page_title() returnerar en sträng som innehåller vynamnet', () => {
        const Translation = { t: make_t() };
        const title = build_page_title('start', {}, { getState, Translation });
        expect(typeof title).toBe('string');
        expect(title).toContain('Hantera granskningar');
        expect(title).toContain('Digital tillsyn');
    });

    test('get_page_title_prefix() returnerar korrekt prefix för kända vyer', () => {
        const Translation = { t: make_t() };
        expect(
            get_page_title_prefix('start', {}, { getState, Translation })
        ).toBe('Hantera granskningar');

        expect(
            get_page_title_prefix('audit', {}, { getState, Translation })
        ).toBe('Granskning');

        expect(
            get_page_title_prefix('manage_users', {}, { getState, Translation })
        ).toBe('Användare');

        expect(
            get_page_title_prefix('login', {}, { getState, Translation })
        ).toBe('Logga in');
    });
});
