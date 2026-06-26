import { merge_local_stuck_into_server_samples } from '../../js/logic/audit_stuck_merge.ts';

describe('merge_local_stuck_into_server_samples', () => {
    test('behåller lokal kört-fast när server saknar text', () => {
        const merged = merge_local_stuck_into_server_samples(
            [{
                id: 's1',
                requirementResults: {
                    R1: {
                        stuckProblemDescription: 'Lokal text',
                        lastStatusUpdate: '2025-06-01T12:00:00.000Z'
                    }
                }
            }],
            [{
                id: 's1',
                requirementResults: {
                    R1: { stuckProblemDescription: '', lastStatusUpdate: '2025-06-01T10:00:00.000Z' }
                }
            }]
        );
        expect(merged[0].requirementResults?.R1?.stuckProblemDescription).toBe('Lokal text');
    });

    test('behåller server när lokal text saknas', () => {
        const merged = merge_local_stuck_into_server_samples(
            [{ id: 's1', requirementResults: { R1: { stuckProblemDescription: '' } } }],
            [{ id: 's1', requirementResults: { R1: { stuckProblemDescription: 'Server' } } }]
        );
        expect(merged[0].requirementResults?.R1?.stuckProblemDescription).toBe('Server');
    });

    test('väljer nyare tidsstämpel vid konflikt', () => {
        const merged = merge_local_stuck_into_server_samples(
            [{
                id: 's1',
                requirementResults: {
                    R1: {
                        stuckProblemDescription: 'Nyare',
                        lastStatusUpdate: '2025-06-02T12:00:00.000Z'
                    }
                }
            }],
            [{
                id: 's1',
                requirementResults: {
                    R1: {
                        stuckProblemDescription: 'Äldre',
                        lastStatusUpdate: '2025-06-01T12:00:00.000Z'
                    }
                }
            }]
        );
        expect(merged[0].requirementResults?.R1?.stuckProblemDescription).toBe('Nyare');
    });
});
