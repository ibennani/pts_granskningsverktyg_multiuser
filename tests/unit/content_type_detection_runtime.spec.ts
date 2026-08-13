/**
 * @fileoverview Enhetstester för content_type_detection_runtime och pattern-prioritet.
 */
import { describe, test, expect } from '@jest/globals';
import { JSDOM } from 'jsdom';
import {
    detect_content_type_ids_runtime,
    detect_content_types_runtime,
} from '../../shared/rulefile/content_type_detection_runtime.ts';
import { apply_detection_patterns_to_content_types } from '../../shared/rulefile/content_type_detection_pattern_rulefile_apply.ts';
import { WEB_TEXT_CONTENT_ALWAYS_TRUE_PATTERN } from '../../shared/rulefile/content_type_detection_pattern_web_catalog.ts';

describe('content_type_detection_runtime', () => {
    test('OR-logik: regex eller selector räcker', () => {
        const dom = new JSDOM('<html><body><h1>Titel</h1></body></html>');
        const results = detect_content_types_runtime({
            html: '<p>Ingen rubrik i html</p>',
            document_ref: dom.window.document,
            rules: [
                { id: 'rubriker', pattern: '<h1>', selector: 'h1' },
            ],
        });
        expect(results[0]?.detected).toBe(true);
        expect(results[0]?.selectorMatched).toBe(true);
    });

    test('ogiltig regexp ger ingen träff men kraschar inte', () => {
        const ids = detect_content_type_ids_runtime({
            html: '<p>x</p>',
            pattern_rules: [{ id: 'bad', pattern: '(' }],
            selector_rules: [],
        });
        expect(ids).toEqual([]);
    });

    test('ogiltig selector ger ingen träff men kraschar inte', () => {
        const dom = new JSDOM('<html><body></body></html>');
        const results = detect_content_types_runtime({
            html: '',
            document_ref: dom.window.document,
            rules: [{ id: 'bad', selector: '>>>invalid<<<' }],
        });
        expect(results[0]?.detected).toBe(false);
    });
});

describe('content_type_detection_pattern_rulefile_apply explicit priority', () => {
    test('explicit användarredigerat pattern vinner över katalogdefault', () => {
        const applied = apply_detection_patterns_to_content_types(
            [
                {
                    id: 'text',
                    text: 'Text',
                    types: [{ id: 'rubriker', text: 'Rubriker', detectionPattern: '<custom>' }],
                },
            ],
            'web'
        );
        expect(applied[0]?.types?.[0]?.detectionPattern).toBe('<custom>');
    });

    test('explicit selector vinner över katalogdefault', () => {
        const applied = apply_detection_patterns_to_content_types(
            [
                {
                    id: 'text',
                    text: 'Text',
                    types: [{ id: 'rubriker', text: 'Rubriker', detectionSelector: '.my-headings' }],
                },
            ],
            'web'
        );
        expect(applied[0]?.types?.[0]?.detectionSelector).toBe('.my-headings');
    });

    test('saknat pattern får katalogdefault', () => {
        const applied = apply_detection_patterns_to_content_types(
            [
                {
                    id: 'text',
                    text: 'Text',
                    types: [{ id: 'text', text: 'Text' }],
                },
            ],
            'web'
        );
        expect(applied[0]?.types?.[0]?.detectionPattern).toBe(WEB_TEXT_CONTENT_ALWAYS_TRUE_PATTERN);
    });

    test('saknad selector får katalogdefault för rubriker', () => {
        const applied = apply_detection_patterns_to_content_types(
            [
                {
                    id: 'text',
                    text: 'Text',
                    types: [{ id: 'rubriker', text: 'Rubriker' }],
                },
            ],
            'web'
        );
        expect(applied[0]?.types?.[0]?.detectionSelector).toContain('h1');
    });
});
