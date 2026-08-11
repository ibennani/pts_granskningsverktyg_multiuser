/**
 * Enhetstester för förvalda innehållstyper i regelfilen.
 */
import { describe, test, expect } from '@jest/globals';
import {
    get_default_content_type_ids,
    resolve_initial_content_type_ids,
} from '../../shared/rulefile/content_type_defaults.ts';

const metadata_with_defaults = {
    contentTypes: [
        {
            id: 'innehall',
            text: 'Innehåll',
            types: [
                { id: 'headings', text: 'Rubriker', defaultSelected: true },
                { id: 'links', text: 'Länkar', defaultSelected: true },
                { id: 'images', text: 'Bilder' },
            ],
        },
    ],
};

describe('content_type_defaults', () => {
    test('get_default_content_type_ids returnerar markerade undertyper', () => {
        expect(get_default_content_type_ids(metadata_with_defaults)).toEqual(['headings', 'links']);
    });

    test('get_default_content_type_ids returnerar tom lista utan metadata', () => {
        expect(get_default_content_type_ids(null)).toEqual([]);
    });

    test('resolve_initial_content_type_ids använder förvalda för ny granskningsdel utan data', () => {
        expect(resolve_initial_content_type_ids(null, metadata_with_defaults, true)).toEqual([
            'headings',
            'links',
        ]);
    });

    test('resolve_initial_content_type_ids respekterar draft med tom lista', () => {
        expect(
            resolve_initial_content_type_ids({ selectedContentTypes: [] }, metadata_with_defaults, true)
        ).toEqual([]);
    });

    test('resolve_initial_content_type_ids respekterar draft med val', () => {
        expect(
            resolve_initial_content_type_ids({ selectedContentTypes: ['images'] }, metadata_with_defaults, true)
        ).toEqual(['images']);
    });

    test('resolve_initial_content_type_ids injicerar inte förvalda vid redigering', () => {
        expect(resolve_initial_content_type_ids({ selectedContentTypes: [] }, metadata_with_defaults, false))
            .toEqual([]);
        expect(resolve_initial_content_type_ids(null, metadata_with_defaults, false)).toEqual([]);
    });
});
