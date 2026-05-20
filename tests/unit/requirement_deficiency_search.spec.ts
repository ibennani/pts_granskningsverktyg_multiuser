import { describe, test, expect } from '@jest/globals';
import {
    parse_deficiency_search_number,
    deficiency_id_matches_search,
    requirement_result_has_deficiency_search
} from '../../js/utils/requirement_deficiency_search.js';

describe('requirement_deficiency_search', () => {
    describe('parse_deficiency_search_number', () => {
        test('tolkar 27, 027, 0027 och B027 som samma nummer', () => {
            expect(parse_deficiency_search_number('27')).toBe(27);
            expect(parse_deficiency_search_number('027')).toBe(27);
            expect(parse_deficiency_search_number('0027')).toBe(27);
            expect(parse_deficiency_search_number('B027')).toBe(27);
            expect(parse_deficiency_search_number('b027')).toBe(27);
        });

        test('tolkar 7, 07, 007 och B007 som samma nummer', () => {
            expect(parse_deficiency_search_number('7')).toBe(7);
            expect(parse_deficiency_search_number('07')).toBe(7);
            expect(parse_deficiency_search_number('007')).toBe(7);
            expect(parse_deficiency_search_number('B007')).toBe(7);
        });

        test('returnerar null för tom eller icke-numerisk sträng', () => {
            expect(parse_deficiency_search_number('')).toBeNull();
            expect(parse_deficiency_search_number('   ')).toBeNull();
            expect(parse_deficiency_search_number('abc')).toBeNull();
            expect(parse_deficiency_search_number('B27x')).toBeNull();
            expect(parse_deficiency_search_number('WCAG 2.2')).toBeNull();
        });
    });

    describe('deficiency_id_matches_search', () => {
        test('matchar lagrat B27 mot sökning 27', () => {
            expect(deficiency_id_matches_search('B27', 27)).toBe(true);
        });

        test('matchar lagrat B7 mot sökning 7', () => {
            expect(deficiency_id_matches_search('B7', 7)).toBe(true);
            expect(deficiency_id_matches_search('B07', 7)).toBe(true);
        });

        test('2 matchar inte B27', () => {
            expect(deficiency_id_matches_search('B27', 2)).toBe(false);
        });
    });

    describe('requirement_result_has_deficiency_search', () => {
        const result_with_b27 = {
            checkResults: {
                c1: {
                    passCriteria: {
                        p1: { status: 'failed', deficiencyId: 'B27' },
                        p2: { status: 'passed' }
                    }
                }
            }
        };

        test('hittar brist 27 i resultat', () => {
            expect(requirement_result_has_deficiency_search(result_with_b27, 27)).toBe(true);
        });

        test('hittar inte brist 2', () => {
            expect(requirement_result_has_deficiency_search(result_with_b27, 2)).toBe(false);
        });

        test('returnerar false utan underkänt kriterium med id', () => {
            expect(requirement_result_has_deficiency_search({ checkResults: {} }, 27)).toBe(false);
            expect(
                requirement_result_has_deficiency_search(
                    {
                        checkResults: {
                            c1: { passCriteria: { p1: { status: 'passed', deficiencyId: 'B27' } } }
                        }
                    },
                    27
                )
            ).toBe(false);
        });
    });
});
