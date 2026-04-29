/**
 * @jest-environment jsdom
 */
import { describe, test, expect } from '@jest/globals';
import { remove_stale_requirement_result_aliases } from '../../js/state/auditResultAliases.js';

describe('remove_stale_requirement_result_aliases', () => {
    test('tar bort publik nyckel när canonical skiljer sig', () => {
        const req_def = { key: 'K1', id: 'id-1' };
        const new_results = { K1: { ok: true }, 'id-1': { stale: true } };
        remove_stale_requirement_result_aliases(new_results, 'K1', req_def);
        expect(Object.prototype.hasOwnProperty.call(new_results, 'id-1')).toBe(false);
        expect(new_results.K1).toEqual({ ok: true });
    });

    test('gör inget om map_key saknas', () => {
        const new_results = { a: 1 };
        remove_stale_requirement_result_aliases(new_results, null, { key: 'a', id: 'b' });
        expect(new_results).toEqual({ a: 1 });
    });
});
