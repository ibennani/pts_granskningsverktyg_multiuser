/**
 * @fileoverview Tester för synk av sidtypslistor per sampleCategory.
 */

import { describe, it, expect } from '@jest/globals';
import {
    apply_dropdown_lists_to_metadata,
    build_categories_from_lines,
    find_duplicate_line,
    parse_lines_textarea,
    read_page_types_dropdown_state,
} from '../../shared/rulefile/page_types_dropdown_sync.js';

const metadata_with_categories = {
    pageTypes: ['Startsida'],
    samples: {
        sampleCategories: [
            {
                id: 'webbsida',
                text: 'Webbsida',
                hasUrl: true,
                categories: [
                    { id: 'startsida', text: 'Startsida' },
                    { id: 'sokresultat', text: 'Sökresultat' },
                ],
            },
            {
                id: 'aterkommande',
                text: 'Återkommande innehåll',
                categories: [{ id: 'cookiebanner', text: 'Cookiebanner' }],
            },
        ],
    },
};

describe('page_types_dropdown_sync', () => {
    it('parse_lines_textarea trimmar och filtrerar tomma rader', () => {
        expect(parse_lines_textarea(' Startsida \n\nSökresultat\n', { trim: true })).toEqual([
            'Startsida',
            'Sökresultat',
        ]);
    });

    it('read_page_types_dropdown_state läser rätt listor per kategori', () => {
        const state = read_page_types_dropdown_state(metadata_with_categories);
        expect(state.webbsida_lines).toEqual(['Startsida', 'Sökresultat']);
        expect(state.aterkommande_lines).toEqual(['Cookiebanner']);
        expect(state.webbsida_category?.text).toBe('Webbsida');
    });

    it('build_categories_from_lines bevarar id per radindex', () => {
        const built = build_categories_from_lines(
            ['Startsida omdöpt', 'Ny rad'],
            [{ id: 'startsida', text: 'Startsida' }]
        );
        expect(built[0]).toEqual({ id: 'startsida', text: 'Startsida omdöpt' });
        expect(built[1].text).toBe('Ny rad');
        expect(built[1].id).toBeTruthy();
    });

    it('apply_dropdown_lists_to_metadata uppdaterar categories och pageTypes', () => {
        const metadata = JSON.parse(JSON.stringify(metadata_with_categories)) as Record<string, unknown>;
        const result = apply_dropdown_lists_to_metadata(
            metadata,
            {
                webbsida_lines: ['Produktsida', 'Kontakt'],
                aterkommande_lines: ['Sidhuvud', 'Sidfot'],
            },
            { require_webbsida_lines: true }
        );
        expect(result).toEqual({ ok: true });
        const samples = metadata.samples as { sampleCategories: Array<{ categories: Array<{ text: string }> }> };
        expect(samples.sampleCategories[0].categories.map((c) => c.text)).toEqual([
            'Produktsida',
            'Kontakt',
        ]);
        expect(samples.sampleCategories[1].categories.map((c) => c.text)).toEqual(['Sidhuvud', 'Sidfot']);
        expect(metadata.pageTypes).toEqual(['Produktsida', 'Kontakt']);
        expect(samples.sampleCategories[0].text).toBe('Webbsida');
    });

    it('apply_dropdown_lists_to_metadata blockerar dubbletter', () => {
        const metadata = JSON.parse(JSON.stringify(metadata_with_categories)) as Record<string, unknown>;
        const result = apply_dropdown_lists_to_metadata(metadata, {
            webbsida_lines: ['Startsida', 'startsida'],
            aterkommande_lines: null,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error_key).toBe('rulefile_page_types_err_duplicate_line');
        }
    });

    it('find_duplicate_line hittar dubblett oavsett skiftläge', () => {
        expect(find_duplicate_line(['Startsida', 'STARTSIDA'])).toBe('STARTSIDA');
    });
});
