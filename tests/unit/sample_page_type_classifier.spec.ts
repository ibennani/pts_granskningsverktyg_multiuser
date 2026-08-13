/**
 * @fileoverview Enhetstester för sample_page_type_classifier.
 */
import { describe, test, expect } from '@jest/globals';
import { classify_sample_page_type } from '../../shared/logic/sample_page_type_classifier.ts';

const RULE_FILE = {
    metadata: {
        samples: {
            sampleCategories: [
                {
                    id: 'url-pages',
                    text: 'Webbplatssid',
                    hasUrl: true,
                    categories: [
                        { id: 'startsida', text: 'Startsida' },
                        { id: 'produkt', text: 'Produktinformation' },
                        { id: 'sok', text: 'Sökresultat' },
                        { id: 'tillganglighet', text: 'Tillgänglighetsinformation' },
                    ],
                },
            ],
        },
    },
};

describe('sample_page_type_classifier', () => {
    test('root-URL klassificeras som startsida', () => {
        const result = classify_sample_page_type({
            final_url: 'https://example.com/',
            rule_file_content: RULE_FILE,
        });
        expect(result.suggestedTypeId).toBe('startsida');
        expect(result.confidence).toBeGreaterThan(0.45);
    });

    test('JSON-LD Product ger stark produktträff', () => {
        const result = classify_sample_page_type({
            final_url: 'https://example.com/p/1',
            html: '<script type="application/ld+json">{"@type":"Product"}</script>',
            rule_file_content: RULE_FILE,
        });
        expect(result.suggestedTypeId).toBe('produkt');
        expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('sök-URL ger sökförslag', () => {
        const result = classify_sample_page_type({
            final_url: 'https://example.com/sok?q=test',
            rule_file_content: RULE_FILE,
        });
        expect(result.suggestedTypeId).toBe('sok');
    });

    test('låg confidence ger inget automatiskt sidtypsval', () => {
        const result = classify_sample_page_type({
            final_url: 'https://example.com/ovantad-sida',
            page_title: 'Ospecificerad sida',
            rule_file_content: RULE_FILE,
        });
        expect(result.suggestedTypeId).toBeNull();
    });

    test('köpvillkor mappas till regelfilens sidtyp', () => {
        const rule_file = {
            metadata: {
                samples: {
                    sampleCategories: [
                        {
                            id: 'url-pages',
                            text: 'Webbplatssid',
                            categories: [{ id: 'kopvillkor', text: 'Köpvillkor' }],
                        },
                    ],
                },
            },
        };
        const result = classify_sample_page_type({
            final_url: 'https://example.com/kopvillkor',
            page_title: 'Köpvillkor',
            rule_file_content: rule_file,
        });
        expect(result.suggestedTypeId).toBe('kopvillkor');
    });
});
