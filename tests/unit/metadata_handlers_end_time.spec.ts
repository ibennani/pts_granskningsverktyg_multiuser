import { reduce_update_metadata } from '../../js/state/metadataHandlers.js';
import { AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY } from '../../js/logic/audit_list_last_updated.js';

describe('reduce_update_metadata endTime', () => {
    const after_end = '2024-06-20T12:00:00.000Z';
    const end_date = '2024-06-15T00:00:00.000Z';

    const locked_state = {
        auditStatus: 'locked',
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: after_end,
        auditMetadata: {
            actorName: 'Test',
            endTime: after_end,
            [AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY]: after_end
        },
        auditLastUpdatedAtFrozen: after_end,
        samples: [{
            id: 's1',
            requirementResults: {
                r1: {
                    lastStatusUpdate: after_end,
                    checkResults: {
                        c1: {
                            timestamp: after_end,
                            passCriteria: { pc1: { timestamp: after_end } }
                        }
                    }
                }
            }
        }]
    };

    test('sparar endTime i state och auditMetadata för locked', () => {
        const next = reduce_update_metadata(locked_state, {
            payload: { endTime: end_date }
        });
        expect(next.endTime).toBe(end_date);
        expect(next.auditMetadata.endTime).toBe(end_date);
    });

    test('clampar stickprov och sätter samples_modified på action', () => {
        const action = { payload: { endTime: end_date } };
        const next = reduce_update_metadata(locked_state, action);
        expect(action.payload.samples_modified).toBe(true);
        expect(next.samples[0].requirementResults.r1.lastStatusUpdate).not.toBe(after_end);
    });

    test('blockerar endTime-ändring när in_progress', () => {
        const in_progress = { ...locked_state, auditStatus: 'in_progress' };
        const next = reduce_update_metadata(in_progress, {
            payload: { endTime: end_date, actorName: 'Ny' }
        });
        expect(next.endTime).toBe(after_end);
        expect(next.auditMetadata.actorName).toBe('Ny');
    });

    test('blockerar endTime-ändring när archived', () => {
        const archived = { ...locked_state, auditStatus: 'archived' };
        const next = reduce_update_metadata(archived, {
            payload: { endTime: end_date }
        });
        expect(next).toBe(archived);
    });

    test('blockerar slutdatum före startdatum', () => {
        const next = reduce_update_metadata(locked_state, {
            payload: { endTime: '2023-12-01T00:00:00.000Z' }
        });
        expect(next).toBe(locked_state);
    });
});
