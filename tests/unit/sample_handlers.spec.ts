/**
 * @fileoverview Enhetstester för sampleHandlers (stickprov i audit-reducern).
 */

import { describe, test, expect } from '@jest/globals';
import { reduce_delete_sample } from '../../js/state/sampleHandlers.js';

describe('reduce_delete_sample', () => {
    const base_state = {
        saveFileVersion: '2.1.0',
        auditStatus: 'in_progress',
        auditMetadata: { last_server_sync_at: '2026-06-01T10:00:00.000Z' },
        samples: [
            { id: 'sample-a', description: 'A', requirementResults: {} },
            { id: 'sample-b', description: 'B', requirementResults: {} }
        ]
    };

    test('tar bort stickprov via sträng-id', () => {
        const next = reduce_delete_sample(base_state, { payload: { sampleId: 'sample-a' } });
        expect(next.samples).toHaveLength(1);
        expect(next.samples[0].id).toBe('sample-b');
        expect(next.auditMetadata.last_local_change_at).toBeTruthy();
    });

    test('matchar id från data-attribut (sträng) mot numeriskt id i state', () => {
        const numeric_state = {
            ...base_state,
            samples: [
                { id: 42, description: 'Num', requirementResults: {} },
                { id: 'sample-b', description: 'B', requirementResults: {} }
            ]
        };
        const next = reduce_delete_sample(numeric_state, { payload: { sampleId: '42' } });
        expect(next.samples).toHaveLength(1);
        expect(next.samples[0].id).toBe('sample-b');
    });

    test('returnerar samma state om id saknas eller inte hittas', () => {
        expect(reduce_delete_sample(base_state, { payload: { sampleId: '' } })).toBe(base_state);
        expect(reduce_delete_sample(base_state, { payload: { sampleId: 'saknas' } })).toBe(base_state);
    });

    test('ändrar inte arkiverad granskning', () => {
        const archived = { ...base_state, auditStatus: 'archived' };
        expect(reduce_delete_sample(archived, { payload: { sampleId: 'sample-a' } })).toBe(archived);
    });
});
