/**
 * Snapshot: SideMenuComponent i granskningsläge (inloggat arbetsflöde).
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as AuditLogic from '../../../js/audit_logic.js';
import { register_translation_module } from '../../../js/utils/translation_access.js';

const snapshot_spec_dir = path.dirname(fileURLToPath(import.meta.url));
const fixture_rule = JSON.parse(
    fs.readFileSync(path.join(snapshot_spec_dir, '../../fixtures/minimal-rulefile.json'), 'utf8')
);

function build_translation() {
    const map = {
        side_menu_aria_label: 'Sidomeny',
        side_menu_open_button: 'Öppna meny',
        side_menu_close_button: 'Stäng meny',
        left_menu_audit_overview: 'Översikt',
        left_menu_all_requirements_with_count: 'Alla krav ({count})',
        left_menu_sample_list_with_count: 'Stickprov ({count})',
        left_menu_images_with_count: 'Bilder ({count})',
        left_menu_problems_with_count: 'Problem ({count})',
        left_menu_actions: 'Åtgärder',
        audit_back_to_start: 'Tillbaka till start',
        menu_link_logout: 'Logga ut',
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

describe('SideMenuComponent snapshot', () => {
    beforeEach(() => {
        register_translation_module(build_translation());
        window.location.hash = '#audit_overview';
        window.matchMedia = jest.fn().mockImplementation(() => ({
            matches: false,
            media: '(max-width: 768px)',
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            addListener: jest.fn(),
            removeListener: jest.fn(),
            onchange: null,
            dispatchEvent: jest.fn(),
        }));
    });

    afterEach(() => {
        document.body.innerHTML = '';
        window.location.hash = '';
    });

    test('visar granskningsmeny med förväntade länkar', async () => {
        const HelpersNs = await import('../../../js/utils/helpers.js');
        const Helpers = {
            ...HelpersNs,
            load_css: jest.fn().mockResolvedValue(undefined),
        };

        const { SideMenuComponent } = await import('../../../js/components/SideMenuComponent.js');

        const mock_state = {
            auditStatus: 'in_progress',
            ruleFileContent: fixture_rule,
            samples: [{ id: 's1', description: 'A', selectedContentTypes: [], requirementResults: {} }],
        };

        const root = document.createElement('div');
        document.body.appendChild(root);

        const menu = new SideMenuComponent();
        await menu.init({
            root,
            deps: {
                router: jest.fn(),
                getState: () => mock_state,
                subscribe: (fn) => () => {},
                Translation: build_translation(),
                Helpers,
                AuditLogic,
                clear_auth_token: jest.fn(),
            },
        });
        menu.set_current_view('audit_overview', {});
        menu.render();

        const nav = root.querySelector('#side-menu-nav');
        expect(nav).toBeTruthy();
        const texts = [...root.querySelectorAll('a.side-menu__link')].map((a) => a.textContent.trim());
        expect(texts.some((t) => t.includes('Översikt'))).toBe(true);
        expect(texts.some((t) => t.includes('Stickprov'))).toBe(true);
        expect(texts.some((t) => t.includes('Logga ut'))).toBe(true);

        expect(root.innerHTML).toMatchSnapshot();
    });
});
