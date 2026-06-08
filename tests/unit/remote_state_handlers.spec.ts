/**
 * @fileoverview Tester för remoteStateHandlers (SET_REMOTE_AUDIT_ID m.m.).
 */

import { describe, expect, test } from '@jest/globals';
import { reduce_set_remote_audit_id } from '../../js/state/remoteStateHandlers.ts';

describe('reduce_set_remote_audit_id', () => {
    test('uppdaterar updated_at när server skickar ny tidsstämpel', () => {
        const current = {
            auditId: 'a1',
            ruleSetId: 'rs1',
            version: 3,
            updated_at: '2026-04-16T22:20:00.000Z'
        };
        const next = reduce_set_remote_audit_id(current, {
            payload: {
                auditId: 'a1',
                ruleSetId: 'rs1',
                version: 4,
                updated_at: '2026-05-21T13:05:56.000Z'
            }
        });
        expect(next.version).toBe(4);
        expect(next.updated_at).toBe('2026-05-21T13:05:56.000Z');
    });

    test('behåller befintlig updated_at om payload saknar fältet', () => {
        const current = {
            auditId: 'a1',
            version: 2,
            updated_at: '2026-04-16T22:20:00.000Z'
        };
        const next = reduce_set_remote_audit_id(current, {
            payload: { auditId: 'a1', version: 3 }
        });
        expect(next.updated_at).toBe('2026-04-16T22:20:00.000Z');
    });
});
