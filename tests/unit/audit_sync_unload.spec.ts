/**
 * @jest-environment jsdom
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
    clear_rule_file_sync_baseline_for_testing,
    note_requirement_result_changed
} from '../../js/sync/audit_sync_planning.js';
import { send_audit_sync_keepalive } from '../../js/sync/audit_sync_unload.js';

const fetch_mock = jest.fn(() => Promise.resolve({ ok: true }));

beforeEach(() => {
    clear_rule_file_sync_baseline_for_testing();
    fetch_mock.mockClear();
    global.fetch = fetch_mock;
    sessionStorage.setItem('gv_auth_token', 'test-jwt');
});

function build_state() {
    return {
        auditId: 'audit-1',
        auditStatus: 'in_progress',
        version: 3,
        ruleFileContent: { requirements: {} },
        auditMetadata: {},
        samples: [{
            id: 'sample-1',
            requirementResults: {
                req1: { status: 'passed', checkResults: {} }
            }
        }]
    };
}

describe('send_audit_sync_keepalive', () => {
    test('skickar enstaka krav-PATCH med keepalive', () => {
        note_requirement_result_changed('sample-1', 'req1');
        const sent = send_audit_sync_keepalive(build_state());
        expect(sent).toBe(true);
        expect(fetch_mock).toHaveBeenCalledTimes(1);
        const [, options] = fetch_mock.mock.calls[0];
        expect(options.method).toBe('PATCH');
        expect(options.keepalive).toBe(true);
        expect(String(options.body)).toContain('"status":"passed"');
    });

    test('returnerar false utan inloggning', () => {
        sessionStorage.removeItem('gv_auth_token');
        expect(send_audit_sync_keepalive(build_state())).toBe(false);
        expect(fetch_mock).not.toHaveBeenCalled();
    });
});
