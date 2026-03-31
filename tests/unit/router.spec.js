import { describe, test, expect, afterEach } from '@jest/globals';
import { get_route_key_from_hash, get_scope_key_from_view_and_params } from '../../js/logic/router.js';

describe('router', () => {
    afterEach(() => {
        window.location.hash = '';
    });

    test('get_route_key_from_hash() returnerar korrekt vynamn från hash', () => {
        window.location.hash = '#metadata?case=x';
        expect(get_route_key_from_hash()).toBe('metadata');

        window.location.hash = '#audit';
        expect(get_route_key_from_hash()).toBe('audit');

        window.location.hash = '';
        expect(get_route_key_from_hash()).toBe('start');
    });

    test('get_scope_key_from_view_and_params() returnerar korrekt nyckel', () => {
        expect(get_scope_key_from_view_and_params('metadata', { caseNumber: '123' })).toBe(
            'metadata:{"caseNumber":"123"}'
        );
        expect(get_scope_key_from_view_and_params('start', null)).toBe('start:{}');
        expect(get_scope_key_from_view_and_params(undefined, {})).toBe('start:{}');
    });
});
