import { describe, expect, test } from '@jest/globals';
import { filter_text_matches, prepareString } from '../../js/utils/string_filter_normalize.ts';

describe('string_filter_normalize', () => {
    test('prepareString gör accent-match tolerant för latin (Résumé / resume)', () => {
        const hay = prepareString('Ett Résumé och café');
        expect(hay.includes(prepareString('resume'))).toBe(true);
        expect(hay.includes(prepareString('café'))).toBe(true);
        expect(hay.includes(prepareString('cafe'))).toBe(true);
    });

    test('prepareString täcker ñ (jalapeño)', () => {
        expect(prepareString('jalapeño').includes(prepareString('jalapeno'))).toBe(true);
    });

    test('å, ä, ö förblir distinkta från a och o', () => {
        expect(prepareString('möt').includes(prepareString('mot'))).toBe(false);
        expect(prepareString('öl').includes(prepareString('ol'))).toBe(false);
        expect(prepareString('svenskämne').includes(prepareString('svenskamne'))).toBe(false);
        expect(prepareString('östra').includes(prepareString('östra'))).toBe(true);
    });

    test('gemener och versaler ignoreras', () => {
        expect(prepareString('CAFÉ')).toBe(prepareString('café'));
    });

    test('filter_text_matches tom eller whitespace-only needle matchar allt', () => {
        expect(filter_text_matches('något innehåll', '')).toBe(true);
        expect(filter_text_matches('abc', '   ')).toBe(true);
    });

    test('filter_text_matches delsträng med diakriter', () => {
        expect(filter_text_matches('Motivation för café', 'cafe')).toBe(true);
    });
});
