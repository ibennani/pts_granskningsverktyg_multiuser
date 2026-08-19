/**
 * @fileoverview Enhetstester för Bilaga 1-granskningsdelsplatshållare.
 */
import { describe, expect, test } from '@jest/globals';
import {
    build_appendix1_sample_placeholder_values,
    format_swedish_prose_list,
} from '../../js/logic/appendix1_sample_placeholders.ts';
import {
    apply_appendix1_placeholders,
    build_appendix1_placeholder_context,
} from '../../js/logic/appendix1_sections_export.ts';

describe('appendix1_sample_placeholders', () => {
    test('format_swedish_prose_list formaterar en, två och flera poster', () => {
        expect(format_swedish_prose_list([])).toBe('');
        expect(format_swedish_prose_list(['Startsida'])).toBe('Startsida');
        expect(format_swedish_prose_list(['Startsida', 'Produktsida'])).toBe('Startsida och Produktsida');
        expect(format_swedish_prose_list(['A', 'B', 'C'])).toBe('A, B och C');
    });

    test('build_appendix1_sample_placeholder_values delar URL- och återkommande delar', () => {
        const values = build_appendix1_sample_placeholder_values({
            ruleFileContent: {
                metadata: {
                    samples: {
                        sampleCategories: [
                            {
                                id: 'webbsida',
                                text: 'Webbsida',
                                categories: [{ id: 'startsida', text: 'Startsida' }],
                            },
                            {
                                id: 'aterkommande',
                                text: 'Återkommande innehåll',
                                categories: [{ id: 'cookie', text: 'Cookiebanner' }],
                            },
                        ],
                    },
                },
            },
            samples: [
                { description: 'Startsida', sampleCategory: 'webbsida' },
                { description: 'Produktsida', sampleCategory: 'webbsida' },
                { description: 'Cookiebanner', sampleCategory: 'aterkommande' },
            ],
        });

        expect(values.auditSampleCount).toBe('3');
        expect(values.auditSampleList).toBe('Startsida och Produktsida');
        expect(values.recurringSampleList).toBe('Cookiebanner');
    });

    test('build_appendix1_placeholder_context ersätter granskningsdelsplatshållare vid export', () => {
        const context = build_appendix1_placeholder_context({
            auditMetadata: { actorName: 'Apotea' },
            ruleFileContent: {
                metadata: {
                    samples: {
                        sampleCategories: [
                            { id: 'webbsida', text: 'Webbsida', categories: [] },
                        ],
                    },
                },
            },
            samples: [{ description: 'Startsida', sampleCategory: 'webbsida' }],
        });

        const text = apply_appendix1_placeholders(
            'Totalt {{auditSampleCount}} delar: {{auditSampleList}}. Återkommande: {{recurringSampleList}}.',
            context
        );

        expect(text).toBe('Totalt 1 delar: Startsida. Återkommande: inga.');
    });
});
