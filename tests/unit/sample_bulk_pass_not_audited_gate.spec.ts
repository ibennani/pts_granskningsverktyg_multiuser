/**
 * Tester för pilotstyrning av bulk-knappen per stickprov.
 */
import { describe, expect, it } from '@jest/globals';
import { user_may_use_sample_mark_bulk_pass_not_audited } from '../../js/logic/sample_bulk_pass_not_audited_gate.js';

describe('user_may_use_sample_mark_bulk_pass_not_audited', () => {
    it('returnerar true för exakt Ilias Bennani med trim av mellanslag', () => {
        expect(user_may_use_sample_mark_bulk_pass_not_audited(() => '  Ilias Bennani  ')).toBe(true);
    });

    it('returnerar false vid fel skiftläge eller stavning', () => {
        expect(user_may_use_sample_mark_bulk_pass_not_audited(() => 'ilias bennani')).toBe(false);
    });

    it('returnerar false för annat användarnamn', () => {
        expect(user_may_use_sample_mark_bulk_pass_not_audited(() => 'annan')).toBe(false);
    });
});
