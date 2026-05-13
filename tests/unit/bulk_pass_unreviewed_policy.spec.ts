import { effective_status_is_fully_unreviewed_for_bulk_pass } from '../../js/logic/bulk_pass_unreviewed_policy.js';

describe('bulk_pass_unreviewed_policy', () => {
    test('endast not_audited räknas som bulk-mål', () => {
        expect(effective_status_is_fully_unreviewed_for_bulk_pass('not_audited')).toBe(true);
        expect(effective_status_is_fully_unreviewed_for_bulk_pass('partially_audited')).toBe(false);
        expect(effective_status_is_fully_unreviewed_for_bulk_pass('passed')).toBe(false);
        expect(effective_status_is_fully_unreviewed_for_bulk_pass('failed')).toBe(false);
    });
});
