/**
 * @fileoverview Enhetstester för recurring_sample_resolver.
 */
import { describe, test, expect } from '@jest/globals';
import {
    build_recurring_sample_payload,
    recurring_sample_exists,
    resolve_recurring_sample_category_id,
    resolve_recurring_sample_type,
} from '../../js/logic/recurring_sample_resolver.ts';

const metadata = {
    contentTypes: [
        {
            types: [
                { id: 'nav-lankar', text: 'Länkar', defaultSelected: true },
            ],
        },
    ],
    samples: {
        sampleCategories: [
            { id: 'webbsida', text: 'Webbsida', hasUrl: true },
            {
                id: 'aterkommande',
                text: 'Återkommande innehåll',
                hasUrl: false,
                categories: [
                    { id: 'sidhuvud', text: 'Sidhuvud' },
                    { id: 'sidfot', text: 'Sidfot' },
                    { id: 'meny', text: 'Meny' },
                ],
            },
        ],
    },
};

describe('recurring_sample_resolver', () => {
    test('resolve_recurring_sample_category_id hittar återkommande kategori', () => {
        expect(resolve_recurring_sample_category_id(metadata)).toBe('aterkommande');
    });

    test('resolve_recurring_sample_type mappar header till Sidhuvud', () => {
        const resolved = resolve_recurring_sample_type(metadata, 'header', 'Sidhuvud');
        expect(resolved.sample_type_id).toBe('sidhuvud');
        expect(resolved.description).toBe('Sidhuvud');
    });

    test('build_recurring_sample_payload sätter kategori, typ och innehållstyper', () => {
        const payload = build_recurring_sample_payload(
            metadata,
            { candidateType: 'footer', structureFingerprint: 'fp-1' },
            'Sidfot'
        );
        expect(payload?.sampleCategory).toBe('aterkommande');
        expect(payload?.sampleType).toBe('sidfot');
        expect(payload?.selectedContentTypes).toEqual(['nav-lankar']);
    });

    test('recurring_sample_exists hittar befintlig del', () => {
        const exists = recurring_sample_exists(
            [{
                sampleCategory: 'aterkommande',
                recurringComponentType: 'header',
                sampleType: 'sidhuvud',
            }],
            'aterkommande',
            { candidateType: 'header', structureFingerprint: 'fp-2' }
        );
        expect(exists).toBe(true);
    });
});
