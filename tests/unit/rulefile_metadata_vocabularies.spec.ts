/**
 * @fileoverview Tester för vocabulary-accessors och persist-normalisering av regelfilsmetadata.
 */

import { describe, it, expect } from '@jest/globals';
import {
    resolve_content_types,
    resolve_page_types,
    resolve_sample_vocab,
    resolve_taxonomies,
    normalize_rulefile_metadata_vocabularies,
    normalize_rulefile_content_vocabularies_for_persist
} from '../../shared/rulefile/rulefile_metadata_vocabularies.js';

const legacy_flat_only = {
    pageTypes: ['Startsida'],
    contentTypes: [{ id: 'text', text: 'Text', types: [{ id: 'plain', text: 'Plain' }] }],
    samples: { sampleTypes: ['Webbsida'] }
};

const duplicate_identical = {
    pageTypes: ['Startsida'],
    contentTypes: [{ id: 'text', text: 'Text', types: [] }],
    vocabularies: {
        pageTypes: ['Startsida'],
        contentTypes: [{ id: 'text', text: 'Text', types: [] }]
    }
};

const vocabularies_only = {
    vocabularies: {
        pageTypes: ['Om oss'],
        contentTypes: [{ id: 'media', text: 'Media', types: [] }],
        taxonomies: [{ id: 'wcag', text: 'WCAG' }],
        sampleTypes: { sampleCategories: [], sampleTypes: ['App'] }
    }
};

const divergent = {
    contentTypes: [{ id: 'flat', text: 'Flat', types: [] }],
    vocabularies: {
        contentTypes: [{ id: 'vocab', text: 'Vocab', types: [] }]
    }
};

describe('rulefile_metadata_vocabularies', () => {
    describe('resolve_*', () => {
        it('läser platta fält i legacy-format', () => {
            expect(resolve_page_types(legacy_flat_only)).toEqual(['Startsida']);
            expect(resolve_content_types(legacy_flat_only)).toHaveLength(1);
            expect(resolve_sample_vocab(legacy_flat_only).sampleTypes).toEqual(['Webbsida']);
        });

        it('läser identiska dubbletter', () => {
            expect(resolve_page_types(duplicate_identical)).toEqual(['Startsida']);
            expect(resolve_content_types(duplicate_identical)[0]).toMatchObject({ id: 'text' });
        });

        it('läser bara vocabularies när platta fält saknas', () => {
            expect(resolve_page_types(vocabularies_only)).toEqual(['Om oss']);
            expect(resolve_content_types(vocabularies_only)[0]).toMatchObject({ id: 'media' });
            expect(resolve_taxonomies(vocabularies_only)[0]).toMatchObject({ id: 'wcag' });
            expect(resolve_sample_vocab(vocabularies_only).sampleTypes).toEqual(['App']);
        });

        it('platta fält vinner vid konflikt', () => {
            expect(resolve_content_types(divergent)[0]).toMatchObject({ id: 'flat' });
        });
    });

    describe('normalize_rulefile_metadata_vocabularies', () => {
        it('tar bort vocabularies vid persist och behåller platta fält', () => {
            const out = normalize_rulefile_metadata_vocabularies(duplicate_identical, { mode: 'persist' });
            expect(out.vocabularies).toBeUndefined();
            expect(out.pageTypes).toEqual(['Startsida']);
            expect(out.contentTypes).toHaveLength(1);
        });

        it('migrerar vocabularies-only till platta fält', () => {
            const out = normalize_rulefile_metadata_vocabularies(vocabularies_only, { mode: 'persist' });
            expect(out.vocabularies).toBeUndefined();
            expect(out.pageTypes).toEqual(['Om oss']);
            expect(out.samples).toMatchObject({ sampleTypes: ['App'], sampleCategories: [] });
        });
    });

    describe('normalize_rulefile_content_vocabularies_for_persist', () => {
        it('normaliserar metadata i regelfilsinnehåll', () => {
            const out = normalize_rulefile_content_vocabularies_for_persist({
                metadata: duplicate_identical,
                requirements: {}
            });
            const meta = out?.metadata as Record<string, unknown>;
            expect(meta?.vocabularies).toBeUndefined();
            expect(meta?.contentTypes).toHaveLength(1);
        });
    });
});
