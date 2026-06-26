/**
 * @fileoverview Tester för normalisering av granskningsdelens attachedMediaFilenames.
 */

import { describe, expect, test } from '@jest/globals';
import {
    ensure_sample_attached_media_shape,
    ensure_samples_attached_media_shape,
    normalize_attached_media_filenames_list,
    resolve_effective_sample_attached_filenames,
    resolve_samples_for_server_sync,
    sort_audit_image_card_groups
} from '../../js/logic/sample_attached_media_normalize.ts';

describe('sample_attached_media_normalize', () => {
    test('normalize_attached_media_filenames_list trimmar och filtrerar', () => {
        expect(normalize_attached_media_filenames_list([' a.png ', '', 'b.jpg'])).toEqual(['a.png', 'b.jpg']);
        expect(normalize_attached_media_filenames_list(null)).toEqual([]);
        expect(normalize_attached_media_filenames_list('fel')).toEqual([]);
    });

    test('ensure_sample_attached_media_shape sätter tom lista när fält saknas', () => {
        const out = ensure_sample_attached_media_shape({
            id: 's1',
            description: 'Start'
        }) as { attachedMediaFilenames: string[] };
        expect(out.attachedMediaFilenames).toEqual([]);
    });

    test('ensure_samples_attached_media_shape normaliserar alla granskningsdelar', () => {
        const out = ensure_samples_attached_media_shape([
            { id: 's1' },
            { id: 's2', attachedMediaFilenames: ['x.png'] }
        ]) as Array<{ attachedMediaFilenames: string[] }>;
        expect(out[0].attachedMediaFilenames).toEqual([]);
        expect(out[1].attachedMediaFilenames).toEqual(['x.png']);
    });

    test('resolve_effective_sample_attached_filenames läser utkast och väntande ändringar', () => {
        const sample = { id: 's1', attachedMediaFilenames: ['saved.png'] };
        expect(resolve_effective_sample_attached_filenames(null, sample)).toEqual(['saved.png']);
        expect(
            resolve_effective_sample_attached_filenames(
                {
                    sampleEditDraft: {
                        sampleId: 's1',
                        updatedSampleData: { attachedMediaFilenames: ['draft.png'] }
                    }
                },
                sample
            )
        ).toEqual(['draft.png']);
        expect(
            resolve_effective_sample_attached_filenames(
                {
                    pendingSampleChanges: {
                        sampleId: 's1',
                        updatedSampleData: { attachedMediaFilenames: ['pending.png'] }
                    },
                    sampleEditDraft: {
                        sampleId: 's1',
                        updatedSampleData: { attachedMediaFilenames: ['draft.png'] }
                    }
                },
                sample
            )
        ).toEqual(['pending.png']);
    });

    test('resolve_samples_for_server_sync slår in utkast per granskningsdel', () => {
        const samples = resolve_samples_for_server_sync(
            {
                sampleEditDraft: {
                    sampleId: 's1',
                    updatedSampleData: { attachedMediaFilenames: ['draft.png'] }
                }
            },
            [
                { id: 's1', attachedMediaFilenames: [] },
                { id: 's2', attachedMediaFilenames: ['saved.png'] }
            ]
        ) as Array<{ id?: string; attachedMediaFilenames?: string[] }>;
        expect(samples[0].attachedMediaFilenames).toEqual(['draft.png']);
        expect(samples[1].attachedMediaFilenames).toEqual(['saved.png']);
    });

    test('sort_audit_image_card_groups sorterar granskningsdel före krav', () => {
        const sorted = sort_audit_image_card_groups([
            { is_sample_screenshot: false, reqId: 'req1', sample: { id: 's1' } },
            { is_sample_screenshot: true, reqId: null, sample: { id: 's1', description: 'A' } },
            { is_sample_screenshot: true, reqId: null, sample: { id: 's2', description: 'B' } }
        ]);
        expect(sorted[0].is_sample_screenshot).toBe(true);
        expect(sorted[0].sample?.id).toBe('s1');
        expect(sorted[1].is_sample_screenshot).toBe(true);
        expect(sorted[2].is_sample_screenshot).toBe(false);
    });
});
