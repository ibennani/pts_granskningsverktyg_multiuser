import { count_stuck_in_samples } from '../../shared/audit/audit_metrics.js';

describe('shared/audit/audit_metrics', () => {
    test('count_stuck_in_samples räknar endast icke-tom stuckProblemDescription', () => {
        expect(count_stuck_in_samples(null)).toBe(0);
        expect(count_stuck_in_samples([])).toBe(0);

        const samples = [
            { requirementResults: { a: { stuckProblemDescription: '' } } },
            { requirementResults: { b: { stuckProblemDescription: '  ' } } },
            { requirementResults: { c: { stuckProblemDescription: 'Text' } } },
            { requirementResults: { d: { stuckProblemDescription: 'Mer text' } } },
        ];

        expect(count_stuck_in_samples(samples)).toBe(2);
    });
});

