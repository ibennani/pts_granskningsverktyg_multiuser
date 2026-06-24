/**
 * Tester för tillgång till bulk-knappen per stickprov.
 */
import { describe, expect, it } from '@jest/globals';
import { user_may_use_sample_mark_bulk_pass_not_audited } from '../../js/logic/sample_bulk_pass_not_audited_gate.js';

describe('user_may_use_sample_mark_bulk_pass_not_audited', () => {
    it('returnerar true oavsett inloggat namn', () => {
        expect(user_may_use_sample_mark_bulk_pass_not_audited(() => 'annan')).toBe(true);
    });

    it('returnerar true oavsett granskare i metadata', () => {
        expect(
            user_may_use_sample_mark_bulk_pass_not_audited(
                () => 'annan',
                () => 'Anna Andersson'
            )
        ).toBe(true);
    });

    it('returnerar true utan argument', () => {
        expect(user_may_use_sample_mark_bulk_pass_not_audited()).toBe(true);
    });
});
