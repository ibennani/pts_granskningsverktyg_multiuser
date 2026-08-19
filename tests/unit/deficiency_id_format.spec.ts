/**
 * @fileoverview Enhetstester för brist-id-formatering och normalisering.
 */

import { describe, expect, test } from '@jest/globals';
import {
    build_deficiency_id,
    extract_deficiency_number,
    normalize_deficiency_id
} from '../../js/logic/deficiency_id_format.ts';

describe('deficiency_id_format', () => {
    test('build_deficiency_id använder B-prefix och padding', () => {
        expect(build_deficiency_id(7, 62)).toBe('B07');
        expect(build_deficiency_id(7, 9)).toBe('B7');
        expect(build_deficiency_id(7, 10)).toBe('B07');
    });

    test('normalize_deficiency_id rättar legacy **deficiency_prefix**', () => {
        expect(normalize_deficiency_id('**deficiency_prefix**07')).toBe('B07');
        expect(normalize_deficiency_id('B07')).toBe('B07');
    });

    test('extract_deficiency_number hanterar korrupt och korrekt id', () => {
        expect(extract_deficiency_number('**deficiency_prefix**07')).toBe('07');
        expect(extract_deficiency_number('B07')).toBe('07');
        expect(extract_deficiency_number('B7')).toBe('7');
    });
});
