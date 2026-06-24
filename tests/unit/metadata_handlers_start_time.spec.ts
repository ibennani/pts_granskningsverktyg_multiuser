import { reduce_update_metadata } from '../../js/state/metadataHandlers.js';

describe('reduce_update_metadata startTime', () => {
    const base_state = {
        auditStatus: 'locked',
        startTime: '2024-01-01T08:00:00.000Z',
        auditMetadata: { actorName: 'Test' }
    };

    test('sparar startTime i state och auditMetadata', () => {
        const next = reduce_update_metadata(base_state, {
            payload: { startTime: '2024-03-15T00:00:00.000Z' }
        });
        expect(next.startTime).toBe('2024-03-15T00:00:00.000Z');
        expect(next.auditMetadata.startTime).toBe('2024-03-15T00:00:00.000Z');
    });

    test('tar bort startTime vid null', () => {
        const with_manual = {
            ...base_state,
            startTime: '2024-03-15T00:00:00.000Z',
            auditMetadata: { ...base_state.auditMetadata, startTime: '2024-03-15T00:00:00.000Z' }
        };
        const next = reduce_update_metadata(with_manual, { payload: { startTime: null } });
        expect(next.startTime).toBeNull();
        expect(next.auditMetadata.startTime).toBeUndefined();
    });

    test('blockerar startTime-ändring när arkiverad', () => {
        const archived = { ...base_state, auditStatus: 'archived' };
        const next = reduce_update_metadata(archived, {
            payload: { startTime: '2024-03-15T00:00:00.000Z' }
        });
        expect(next).toBe(archived);
    });
});
