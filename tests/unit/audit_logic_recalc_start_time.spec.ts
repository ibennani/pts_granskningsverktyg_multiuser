import { recalculateAuditTimes } from '../../js/audit_logic.js';

describe('recalculateAuditTimes manuell startTime', () => {
    test('behåller auditMetadata.startTime framför beräknad minTime', () => {
        const state = {
            auditMetadata: { startTime: '2023-01-01T00:00:00.000Z' },
            startTime: '2023-01-01T00:00:00.000Z',
            samples: [{
                requirementResults: {
                    req1: { lastStatusUpdate: '2024-06-01T12:00:00.000Z' }
                }
            }]
        };
        const next = recalculateAuditTimes(state);
        expect(next?.startTime).toBe('2023-01-01T00:00:00.000Z');
    });

    test('sätter startTime från stickprov när ingen manuell finns', () => {
        const state = {
            auditMetadata: {},
            samples: [{
                requirementResults: {
                    req1: { lastStatusUpdate: '2024-06-01T12:00:00.000Z' }
                }
            }]
        };
        const next = recalculateAuditTimes(state);
        expect(next?.startTime).toBe('2024-06-01T12:00:00.000Z');
    });
});
