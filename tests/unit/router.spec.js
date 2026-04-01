/**
 * Tester för router.js
 */
import { jest, describe, test, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client_path = path.join(__dirname, '../../js/api/client.js');

const is_current_user_admin = jest.fn(() => true);
const get_auth_token = jest.fn(() => null);
const get_current_user_preferences = jest.fn(async () => ({}));
const set_current_user_admin = jest.fn();

jest.unstable_mockModule(client_path, () => ({
    is_current_user_admin,
    get_auth_token,
    get_current_user_preferences,
    set_current_user_admin
}));

let parse_view_and_params_from_hash;
let get_route_key_from_hash;
let get_scope_key_from_hash;
let get_scope_key_from_view_and_params;
let navigate_and_set_hash;

beforeAll(async () => {
    const mod = await import('../../js/logic/router.js');
    parse_view_and_params_from_hash = mod.parse_view_and_params_from_hash;
    get_route_key_from_hash = mod.get_route_key_from_hash;
    get_scope_key_from_hash = mod.get_scope_key_from_hash;
    get_scope_key_from_view_and_params = mod.get_scope_key_from_view_and_params;
    navigate_and_set_hash = mod.navigate_and_set_hash;
});

describe('router', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        is_current_user_admin.mockReturnValue(true);
        window.location.hash = '';
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
});
