/**
 * @fileoverview Enhetstester för bulk_url_import_category.
 */
import { describe, test, expect } from '@jest/globals';
import { resolve_default_url_sample_category_id } from '../../js/logic/bulk_url_import_category.ts';

describe('bulk_url_import_category', () => {
    test('väljer första kategori med hasUrl', () => {
        const id = resolve_default_url_sample_category_id({
            samples: {
                sampleCategories: [
                    { id: 'document', hasUrl: false },
                    { id: 'webpage', hasUrl: true, text: 'Webbsida' },
                    { id: 'other-web', hasUrl: true },
                ],
            },
        });
        expect(id).toBe('webpage');
    });

    test('returnerar null utan URL-kategori', () => {
        expect(resolve_default_url_sample_category_id({ samples: { sampleCategories: [] } })).toBeNull();
    });
});
