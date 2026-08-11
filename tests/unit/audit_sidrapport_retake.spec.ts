import { describe, test, expect } from '@jest/globals';
import {
    resolve_retake_sample_for_row,
    is_sidrapport_retake_in_progress,
} from '../../js/logic/audit_sidrapport_retake.ts';

describe('audit_sidrapport_retake', () => {
    test('resolve_retake_sample_for_row använder state när granskningsdel finns', () => {
        const sample = resolve_retake_sample_for_row(
            { sampleId: 's1', requestedUrl: 'https://fallback.example' },
            [{ id: 's1', url: 'https://example.com', attachedMediaFilenames: ['a.png'] }]
        );
        expect(sample).toEqual({
            id: 's1',
            url: 'https://example.com',
            attachedMediaFilenames: ['a.png'],
        });
    });

    test('resolve_retake_sample_for_row faller tillbaka till radens URL', () => {
        const sample = resolve_retake_sample_for_row(
            {
                sampleId: 'legacy-1',
                requestedUrl: 'https://apohem.se/sida',
                sampleDescription: 'Gammal sida',
            },
            [{ id: 's2', url: 'https://other.example' }]
        );
        expect(sample).toEqual({
            id: 'legacy-1',
            url: 'https://apohem.se/sida',
        });
    });

    test('resolve_retake_sample_for_row returnerar null utan URL', () => {
        expect(
            resolve_retake_sample_for_row({ sampleId: 'x', requestedUrl: '' }, [])
        ).toBeNull();
    });

    test('is_sidrapport_retake_in_progress ignorerar failed', () => {
        expect(
            is_sidrapport_retake_in_progress({
                pendingAttempt: { status: 'failed' },
            })
        ).toBe(false);
    });
});
