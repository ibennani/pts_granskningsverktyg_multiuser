/**
 * @fileoverview Enhetstester för regex-baserad innehållstypdetektering från HTML.
 */
import { describe, test, expect } from '@jest/globals';
import {
    collect_child_detection_patterns,
    detect_content_types_from_html,
    is_paste_html_within_limit,
} from '../../js/components/add_sample_form/content_type_html_detection_logic.ts';
import {
    compile_content_type_detection_pattern,
    detect_content_type_ids_from_html,
    is_valid_content_type_detection_pattern,
} from '../../shared/rulefile/content_type_detection_pattern.ts';
import {
    seed_detection_patterns_in_content_types,
    suggest_detection_pattern_for_content_type,
} from '../../shared/rulefile/content_type_detection_pattern_defaults.ts';

const HEADING_PATTERN = String.raw`<h[1-6][\s/>]|role\s*=\s*["']heading["']`;
const TABLE_PATTERN = String.raw`<table[\s/>]|role\s*=\s*["'](?:table|grid)["']`;

describe('content_type_detection_pattern', () => {
    test('compile och validering accepterar giltigt mönster', () => {
        expect(is_valid_content_type_detection_pattern(HEADING_PATTERN)).toBe(true);
        expect(compile_content_type_detection_pattern(HEADING_PATTERN)?.test('<h3>')).toBe(true);
    });

    test('validering avvisar ogiltigt mönster', () => {
        expect(is_valid_content_type_detection_pattern('(')).toBe(false);
    });

    test('detect_content_type_ids_from_html hittar h3 och role=heading', () => {
        const rules = [{ id: 'rubriker', pattern: HEADING_PATTERN }];
        expect(detect_content_type_ids_from_html('<h3>Titel</h3>', rules)).toEqual(['rubriker']);
        expect(detect_content_type_ids_from_html('<div role="heading">Titel</div>', rules)).toEqual(['rubriker']);
    });

    test('ogiltigt regex i regel hoppas över', () => {
        const rules = [
            { id: 'broken', pattern: '(' },
            { id: 'tables', pattern: TABLE_PATTERN },
        ];
        expect(detect_content_type_ids_from_html('<table><tr><td>x</td></tr></table>', rules)).toEqual(['tables']);
    });
});

describe('content_type_html_detection_logic', () => {
    test('collect_child_detection_patterns läser undertyper från regelfil', () => {
        const patterns = collect_child_detection_patterns({
            metadata: {
                contentTypes: [
                    {
                        id: 'text',
                        text: 'Text',
                        types: [
                            { id: 'rubriker', text: 'Rubriker', detectionPattern: HEADING_PATTERN },
                            { id: 'tom', text: 'Tom' },
                        ],
                    },
                ],
            },
        });
        expect(patterns).toEqual([{ id: 'rubriker', pattern: HEADING_PATTERN }]);
    });

    test('detect_content_types_from_html i footer-fragment', () => {
        const html = '<footer><nav><ul><li><a href="/">Hem</a></li></ul></nav></footer>';
        const rules = [
            {
                id: 'navigation',
                pattern: String.raw`<nav[\s/>]|role\s*=\s*["']navigation["']`,
            },
        ];
        expect(detect_content_types_from_html(html, rules)).toEqual(['navigation']);
    });

    test('is_paste_html_within_limit', () => {
        expect(is_paste_html_within_limit('a')).toBe(true);
        expect(is_paste_html_within_limit('x'.repeat(500_001))).toBe(false);
    });
});

describe('content_type_detection_pattern_defaults', () => {
    test('suggest_detection_pattern_for_content_type föreslår rubrikmönster', () => {
        const pattern = suggest_detection_pattern_for_content_type({
            id: 'headings',
            text: 'Rubriker',
        });
        expect(pattern).toContain('h[1-6]');
        expect(pattern).toContain('heading');
    });

    test('seed_detection_patterns_in_content_types fyller saknade mönster', () => {
        const seeded = seed_detection_patterns_in_content_types([
            {
                id: 'media',
                text: 'Media',
                types: [{ id: 'images', text: 'Bilder' }],
            },
        ]);
        expect(seeded[0]?.types?.[0]?.detectionPattern).toContain('img');
    });
});
