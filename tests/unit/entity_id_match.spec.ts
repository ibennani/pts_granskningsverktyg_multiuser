/**
 * @fileoverview Tester för tolerant id-matchning (DOM vs JSON).
 */
/** @jest-environment node */

import { describe, test, expect } from '@jest/globals';
import {
    definition_primary_id,
    find_check_def_by_storage_id,
    find_pass_criterion_def_by_storage_id,
    resolve_map_entry,
    same_storage_id
} from '../../js/logic/entity_id_match.js';

describe('entity_id_match', () => {
    test('same_storage_id jämför sträng och tal', () => {
        expect(same_storage_id(5, '5')).toBe(true);
        expect(same_storage_id('a', 'b')).toBe(false);
        expect(same_storage_id(undefined, '1')).toBe(false);
    });

    test('definition_primary_id prioriterar id före key', () => {
        expect(definition_primary_id({ id: 2, key: 'k' })).toBe('2');
        expect(definition_primary_id({ key: 'only' })).toBe('only');
        expect(definition_primary_id({})).toBe('');
    });

    test('find_check_def_by_storage_id matchar dataset-sträng mot numeriskt id', () => {
        const checks = [{ id: 10, condition: 'x' }];
        expect(find_check_def_by_storage_id(checks, '10')).toEqual(checks[0]);
        expect(find_check_def_by_storage_id(checks, 10)).toEqual(checks[0]);
    });

    test('find_pass_criterion_def_by_storage_id matchar key', () => {
        const pcs = [{ key: 'pc-a', requirement: 'r' }];
        expect(find_pass_criterion_def_by_storage_id(pcs, 'pc-a')).toEqual(pcs[0]);
    });

    test('resolve_map_entry hittar nyckel med annan typ', () => {
        const map: Record<string, { v: number }> = { '7': { v: 1 } };
        expect(resolve_map_entry(map, 7)?.value).toEqual({ v: 1 });
        expect(resolve_map_entry(map, '7')?.storageKey).toBe('7');
    });
});
