/**
 * @fileoverview Enhetstester för ensure_audit_id_for_server_sync.
 */
import { describe, test, expect, jest } from '@jest/globals';
import { ensure_audit_id_for_server_sync } from '../../js/logic/ensure_audit_id_for_server_sync.ts';

describe('ensure_audit_id_for_server_sync', () => {
    test('returnerar befintligt auditId utan synk', async () => {
        const getState = jest.fn(() => ({ auditId: 'audit-1', ruleFileContent: {} }));
        const dispatch = jest.fn();

        const audit_id = await ensure_audit_id_for_server_sync(getState, dispatch);

        expect(audit_id).toBe('audit-1');
        expect(dispatch).not.toHaveBeenCalled();
    });

    test('väntar in auditId efter serversynk', async () => {
        let calls = 0;
        const getState = jest.fn(() => {
            calls += 1;
            if (calls < 3) {
                return { auditId: null, ruleFileContent: { metadata: {} } };
            }
            return { auditId: 'audit-new', ruleFileContent: { metadata: {} } };
        });
        const dispatch = jest.fn();
        const sync_to_server_now = jest.fn(() => Promise.resolve());

        const audit_id = await ensure_audit_id_for_server_sync(
            getState,
            dispatch,
            { sync_to_server_now, has_auth_token: () => true }
        );

        expect(sync_to_server_now).toHaveBeenCalledTimes(1);
        expect(audit_id).toBe('audit-new');
    });
});
