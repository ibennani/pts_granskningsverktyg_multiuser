/**
 * Tester för server/logic/audit_incoming_stale_guard.ts
 */
import { describe, test, expect } from '@jest/globals';
import { is_incoming_audit_samples_older_than_existing } from '../../server/logic/audit_incoming_stale_guard.ts';

describe('audit_incoming_stale_guard', () => {
    test('returnerar false när tidsstämplar saknas', () => {
        expect(is_incoming_audit_samples_older_than_existing([], [])).toBe(false);
    });

    test('returnerar true när inkommande krav är äldre', () => {
        const existing = [
            {
                requirementResults: {
                    r1: { lastStatusUpdate: '2026-05-20T12:00:00.000Z' }
                }
            }
        ];
        const incoming = [
            {
                requirementResults: {
                    r1: { lastStatusUpdate: '2026-05-19T08:00:00.000Z' }
                }
            }
        ];
        expect(is_incoming_audit_samples_older_than_existing(existing, incoming)).toBe(true);
    });

    test('returnerar false när inkommande krav är nyare', () => {
        const existing = [
            {
                requirementResults: {
                    r1: { lastStatusUpdate: '2026-05-19T08:00:00.000Z' }
                }
            }
        ];
        const incoming = [
            {
                requirementResults: {
                    r1: { lastStatusUpdate: '2026-05-20T12:00:00.000Z' }
                }
            }
        ];
        expect(is_incoming_audit_samples_older_than_existing(existing, incoming)).toBe(false);
    });
});
