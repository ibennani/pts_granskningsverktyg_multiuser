/**
 * @fileoverview Enhetstester för innehållstyper vid bulkimport.
 */
import { describe, test, expect } from '@jest/globals';
import {
    extract_detected_content_type_ids_from_summary,
    merge_bulk_import_content_type_ids,
    build_bulk_import_sidrapport_sample_patch,
} from '../../js/logic/bulk_import_content_types.ts';

describe('bulk_import_content_types', () => {
    test('läser detectedContentTypeIds från analysis-summary envelope', () => {
        const summary = {
            contentTypes: {
                module: 'content-types',
                data: {
                    detectedContentTypeIds: ['text-och-struktur-text', 'navigering-lankar'],
                    results: [
                        { contentTypeId: 'text-och-struktur-text', detected: true },
                        { contentTypeId: 'ljud-och-video-video-eller-filmklipp', detected: false },
                    ],
                },
            },
        };

        expect(extract_detected_content_type_ids_from_summary(summary)).toEqual([
            'text-och-struktur-text',
            'navigering-lankar',
        ]);
    });

    test('läser detekterade id från data.results om detectedContentTypeIds saknas', () => {
        const summary = {
            contentTypes: {
                data: {
                    results: [
                        { contentTypeId: 'formular-knappar', detected: true },
                        { contentTypeId: 'mediespelare-mediespelare-for-video', detected: false },
                    ],
                },
            },
        };

        expect(extract_detected_content_type_ids_from_summary(summary)).toEqual(['formular-knappar']);
    });

    test('returnerar tom lista vid ogiltig eller saknad summary', () => {
        expect(extract_detected_content_type_ids_from_summary(null)).toEqual([]);
        expect(extract_detected_content_type_ids_from_summary({})).toEqual([]);
    });

    test('slår ihop förval och detekterade utan dubbletter', () => {
        expect(
            merge_bulk_import_content_type_ids(
                ['text-och-struktur-text', 'navigering-lankar'],
                ['navigering-lankar', 'formular-knappar']
            )
        ).toEqual(['text-och-struktur-text', 'navigering-lankar', 'formular-knappar']);
    });

    test('behåller förval när inget detekterades', () => {
        expect(merge_bulk_import_content_type_ids(['default-a'], [])).toEqual(['default-a']);
    });

    test('bygger patch med sammanslagna typer och sidtyp efter sidrapport', () => {
        const patch = build_bulk_import_sidrapport_sample_patch(
            {
                selected_content_type_ids: ['default-type'],
                suggested_sample_type_id: null,
                suggested_sample_type_confidence: 0,
            },
            {
                pageTypeClassification: { suggestedTypeId: 'startsida', confidence: 0.9 },
                contentTypes: {
                    data: {
                        detectedContentTypeIds: ['text-och-struktur-text', 'navigering-lankar'],
                    },
                },
            }
        );

        expect(patch.selected_content_type_ids).toEqual(
            expect.arrayContaining(['default-type', 'text-och-struktur-text', 'navigering-lankar'])
        );
        expect(patch.sampleType).toBe('startsida');
        expect(patch.suggestedSampleTypeConfidence).toBe(0.9);
        expect(patch.detected_content_type_ids).toEqual([
            'text-och-struktur-text',
            'navigering-lankar',
        ]);
    });
});
