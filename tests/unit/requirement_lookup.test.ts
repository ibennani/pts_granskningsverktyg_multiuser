/**
 * @fileoverview Tester för RequirementLookup och normalisering av kravlista.
 */

import { describe, it, expect } from '@jest/globals';
import {
    RequirementLookup,
    normalize_requirements_to_record
} from '../../js/logic/requirement_lookup.js';

describe('normalize_requirements_to_record', () => {
    it('returnerar tomt objekt för ogiltig indata', () => {
        expect(normalize_requirements_to_record(null)).toEqual({});
        expect(normalize_requirements_to_record(undefined)).toEqual({});
        expect(normalize_requirements_to_record('x')).toEqual({});
    });

    it('behåller post-objekt oförändrat', () => {
        const rec = { a: { id: 'a', title: 'A' } };
        expect(normalize_requirements_to_record(rec)).toBe(rec);
    });

    it('bygger record från array', () => {
        const arr = [
            { id: 'r1', title: 'Ett' },
            { key: 'r2', title: 'Två' }
        ];
        expect(normalize_requirements_to_record(arr)).toEqual({
            r1: arr[0],
            r2: arr[1]
        });
    });
});

describe('RequirementLookup', () => {
    it('from returnerar null för primitiver', () => {
        expect(RequirementLookup.from(null)).toBeNull();
        expect(RequirementLookup.from(1)).toBeNull();
    });

    it('findById matchar array på id och key', () => {
        const look = RequirementLookup.from([
            { id: 'x', title: 'T' },
            { key: 'y', title: 'U' }
        ]);
        expect(look?.findById('x')?.title).toBe('T');
        expect(look?.findById('y')?.title).toBe('U');
    });

    it('findById matchar objektnyckel och inbäddad id', () => {
        const look = RequirementLookup.from({
            k1: { id: 'real', title: 'R' }
        });
        expect(look?.findById('k1')?.title).toBe('R');
        expect(look?.findById('real')?.title).toBe('R');
    });

    it('resolveMapKey är null för arrayformat', () => {
        const look = RequirementLookup.from([{ id: 'a', title: 'A' }]);
        expect(look?.resolveMapKey('a')).toBeNull();
    });

    it('entries ger stabil nyckel för array', () => {
        const look = RequirementLookup.from([{ id: 'z', title: 'Z' }]);
        expect(look?.entries()).toEqual([[ 'z', { id: 'z', title: 'Z' } ]]);
    });
});
