/**
 * Tester för migration av gamla query-baserade view-länkar.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals';
import { migrate_legacy_view_query_to_hash } from '../../js/logic/migrate_legacy_query_to_hash.js';

describe('migrate_legacy_view_query_to_hash', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('byter till hash-route och tar bort view ur query', () => {
        const replace = jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        const win = {
            location: {
                pathname: '/v2/',
                search: '?view=metadata&caseNumber=9',
                hash: ''
            },
            history: window.history
        };
        const ok = migrate_legacy_view_query_to_hash(win);
        expect(ok).toBe(true);
        expect(replace).toHaveBeenCalled();
        const url = replace.mock.calls[0][2];
        expect(String(url)).toMatch(/#md\?|#metadata\?/);
        expect(String(url)).toContain('caseNumber=9');
        expect(String(url)).not.toContain('view=');
    });

    test('behåller debug=nav i search', () => {
        const replace = jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        const win = {
            location: {
                pathname: '/',
                search: '?view=audit_overview&auditId=1&debug=nav',
                hash: ''
            },
            history: window.history
        };
        migrate_legacy_view_query_to_hash(win);
        const url = replace.mock.calls[0][2];
        expect(String(url)).toContain('?debug=nav#');
        expect(String(url)).toMatch(/#ov\?|#audit_overview\?/);
    });

    test('returnerar false när view saknas', () => {
        const replace = jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        const win = {
            location: { pathname: '/', search: '?x=1', hash: '' },
            history: window.history
        };
        const ok = migrate_legacy_view_query_to_hash(win);
        expect(ok).toBe(false);
        expect(replace).not.toHaveBeenCalled();
    });
});
