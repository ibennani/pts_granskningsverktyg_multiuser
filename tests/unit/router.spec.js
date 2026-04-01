/**
 * Tester för router.js
 */
import { jest, describe, test, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client_path = path.join(__dirname, '../../js/api/client.js');
const validation_path = path.join(__dirname, '../../js/validation_logic.js');

const is_current_user_admin = jest.fn(() => true);
const get_auth_token = jest.fn(() => null);
const get_current_user_preferences = jest.fn(async () => ({}));
const set_current_user_admin = jest.fn();
const load_audit_with_rule_file = jest.fn();

jest.unstable_mockModule(client_path, () => ({
    is_current_user_admin,
    get_auth_token,
    get_current_user_preferences,
    set_current_user_admin,
    load_audit_with_rule_file
}));

const validate_saved_audit_file_mock = jest.fn(() => ({ isValid: true }));

jest.unstable_mockModule(validation_path, () => ({
    validate_saved_audit_file: validate_saved_audit_file_mock,
    validate_rule_file_json: jest.fn()
}));

let parse_view_and_params_from_hash;
let get_route_key_from_hash;
let get_scope_key_from_hash;
let get_scope_key_from_view_and_params;
let navigate_and_set_hash;
let handle_hash_change;

beforeAll(async () => {
    const mod = await import('../../js/logic/router.js');
    parse_view_and_params_from_hash = mod.parse_view_and_params_from_hash;
    get_route_key_from_hash = mod.get_route_key_from_hash;
    get_scope_key_from_hash = mod.get_scope_key_from_hash;
    get_scope_key_from_view_and_params = mod.get_scope_key_from_view_and_params;
    navigate_and_set_hash = mod.navigate_and_set_hash;
    handle_hash_change = mod.handle_hash_change;
});

function make_hash_options(overrides = {}) {
    return {
        nav_debug: jest.fn(),
        dispatch: jest.fn(),
        StoreActionTypes: { LOAD_AUDIT_FROM_FILE: 'LOAD_AUDIT_FROM_FILE' },
        navigate_and_set_hash: jest.fn(),
        updatePageTitle: jest.fn(),
        render_view: jest.fn(),
        load_focus_storage: jest.fn(() => ({})),
        get_scope_key_from_view_and_params: (v, p) =>
            `${v || 'start'}:${JSON.stringify(p && typeof p === 'object' ? p : {})}`,
        ...overrides
    };
}

describe('router', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        is_current_user_admin.mockReturnValue(true);
        get_auth_token.mockReturnValue(null);
        window.location.hash = '';
        delete window.__gv_restore_focus_info;
        validate_saved_audit_file_mock.mockImplementation(() => ({ isValid: true }));
    });

    afterEach(() => {
        window.location.hash = '';
        jest.restoreAllMocks();
    });

    test('parse_view_and_params_from_hash: tom hash → start', () => {
        window.location.hash = '';
        expect(parse_view_and_params_from_hash()).toEqual({ viewName: 'start', params: {} });
    });

    test('parse_view_and_params_from_hash: vy och query', () => {
        window.location.hash = '#metadata?caseNumber=1';
        expect(parse_view_and_params_from_hash()).toEqual({
            viewName: 'metadata',
            params: { caseNumber: '1' }
        });
    });

    test('parse_view_and_params_from_hash: skip-länk → start utan params', () => {
        window.location.hash = '#main-content-heading';
        expect(parse_view_and_params_from_hash()).toEqual({ viewName: 'start', params: {} });
    });

    test('get_route_key_from_hash returnerar vy eller start', () => {
        window.location.hash = '#metadata?case=x';
        expect(get_route_key_from_hash()).toBe('metadata');
        window.location.hash = '#audit';
        expect(get_route_key_from_hash()).toBe('audit');
        window.location.hash = '';
        expect(get_route_key_from_hash()).toBe('start');
    });

    test('get_scope_key_from_view_and_params serialiserar params', () => {
        expect(get_scope_key_from_view_and_params('metadata', { caseNumber: '123' })).toBe(
            'metadata:{"caseNumber":"123"}'
        );
        expect(get_scope_key_from_view_and_params('start', null)).toBe('start:{}');
        expect(get_scope_key_from_view_and_params(undefined, {})).toBe('start:{}');
    });

    test('get_scope_key_from_hash använder renderad JSON när vy matchar route', () => {
        window.location.hash = '#foo?a=1';
        const key = get_scope_key_from_hash({
            current_view_name_rendered: 'foo',
            current_view_params_rendered_json: '{"a":"1"}'
        });
        expect(key).toBe('foo:{"a":"1"}');
    });

    test('navigate_and_set_hash sätter hash och sidtitel', () => {
        const nav_debug = jest.fn();
        const updatePageTitle = jest.fn();
        const get_current_view_name = jest.fn(() => 'start');
        const get_current_view_component = jest.fn(() => null);
        navigate_and_set_hash('metadata', { caseNumber: 'x' }, {
            nav_debug,
            getState: () => ({}),
            get_current_view_name,
            get_current_view_component,
            updatePageTitle
        });
        expect(window.location.hash).toContain('metadata');
        expect(updatePageTitle).toHaveBeenCalledWith('metadata', { caseNumber: 'x' });
    });

    test('navigate_and_set_hash: icke-admin kan inte öppna manage_users', () => {
        is_current_user_admin.mockReturnValue(false);
        const updatePageTitle = jest.fn();
        navigate_and_set_hash('manage_users', {}, {
            nav_debug: jest.fn(),
            getState: () => ({}),
            get_current_view_name: () => 'start',
            get_current_view_component: () => null,
            updatePageTitle
        });
        expect(window.location.hash).toBe('#start');
        expect(updatePageTitle).not.toHaveBeenCalled();
    });

    test('navigate_and_set_hash: oförändrad hash triggar render om komponent finns', () => {
        window.location.hash = '#start';
        const nav_debug = jest.fn();
        const render = jest.fn();
        const updatePageTitle = jest.fn();
        navigate_and_set_hash('start', {}, {
            nav_debug,
            getState: () => ({}),
            get_current_view_name: () => 'start',
            get_current_view_component: () => ({ render }),
            updatePageTitle
        });
        expect(render).toHaveBeenCalled();
        expect(updatePageTitle).toHaveBeenCalledWith('start', {});
    });

    describe('handle_hash_change', () => {
        test('renderar vy och params från hash', async () => {
            window.location.hash = '#metadata?caseNumber=42';
            const opts = make_hash_options();
            await handle_hash_change(opts);
            expect(opts.render_view).toHaveBeenCalledWith('metadata', { caseNumber: '42' });
            expect(opts.updatePageTitle).toHaveBeenCalledWith('metadata', { caseNumber: '42' });
        });

        test('okänd vy-namn skickas vidare till render_view', async () => {
            window.location.hash = '#custom_future_view?x=1';
            const opts = make_hash_options();
            await handle_hash_change(opts);
            expect(opts.render_view).toHaveBeenCalledWith('custom_future_view', { x: '1' });
        });

        test('login-vy renderas med params', async () => {
            window.location.hash = '#login?return=start';
            const opts = make_hash_options();
            await handle_hash_change(opts);
            expect(opts.render_view).toHaveBeenCalledWith('login', { return: 'start' });
        });

        test('manage_users som icke-admin: redirect till start via history.replaceState', async () => {
            window.location.hash = '#manage_users';
            is_current_user_admin.mockReturnValue(false);
            const replace_spy = jest.spyOn(history, 'replaceState').mockImplementation(() => {});
            const opts = make_hash_options();
            await handle_hash_change(opts);
            expect(replace_spy).toHaveBeenCalledWith(null, '', '#start');
            expect(opts.render_view).toHaveBeenCalledWith('start', {});
            replace_spy.mockRestore();
        });

        test('upload med auditId: lyckad laddning navigerar till audit_overview', async () => {
            window.location.hash = '#upload?auditId=a99';
            load_audit_with_rule_file.mockResolvedValue({
                auditStatus: 'in_progress',
                samples: [{ id: 's1' }],
                ruleFileContent: { metadata: { version: '1' }, requirements: {} }
            });
            const nav_hash = jest.fn();
            const opts = make_hash_options({ navigate_and_set_hash: nav_hash });
            await handle_hash_change(opts);
            expect(opts.dispatch).toHaveBeenCalled();
            expect(nav_hash).toHaveBeenCalledWith('audit_overview', {});
            expect(opts.render_view).not.toHaveBeenCalled();
        });

        test('upload utan lyckad laddning: går till start', async () => {
            window.location.hash = '#upload?auditId=bad';
            load_audit_with_rule_file.mockResolvedValue(null);
            const nav_hash = jest.fn();
            const opts = make_hash_options({ navigate_and_set_hash: nav_hash });
            await handle_hash_change(opts);
            expect(nav_hash).toHaveBeenCalledWith('start', {});
            expect(opts.render_view).not.toHaveBeenCalled();
        });

        test('audit_overview med auditId misslyckas: start', async () => {
            window.location.hash = '#audit_overview?auditId=x';
            load_audit_with_rule_file.mockRejectedValue(new Error('nät'));
            const nav_hash = jest.fn();
            const opts = make_hash_options({ navigate_and_set_hash: nav_hash });
            await handle_hash_change(opts);
            expect(nav_hash).toHaveBeenCalledWith('start', {});
        });

        test('synkar användarpreferenser när token finns', async () => {
            get_auth_token.mockReturnValue('tok');
            get_current_user_preferences.mockResolvedValue({ name: 'Ada', is_admin: true });
            window.location.hash = '#start';
            const opts = make_hash_options();
            await handle_hash_change(opts);
            expect(set_current_user_admin).toHaveBeenCalledWith(true);
            expect(opts.dispatch).toHaveBeenCalledWith({ type: 'GV_USER_PREFERENCES_SYNCED' });
        });

        test('skip-länk i hash sätter replaceState och renderar start', async () => {
            window.location.hash = '#main-content-heading';
            const replace_spy = jest.spyOn(history, 'replaceState').mockImplementation(() => {});
            const opts = make_hash_options();
            await handle_hash_change(opts);
            expect(replace_spy).toHaveBeenCalled();
            expect(opts.render_view).toHaveBeenCalledWith('start', {});
            replace_spy.mockRestore();
        });
    });
});
