/**
 * @file Enhetstester för audit_remote_push_apply.ts
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import {
    build_remote_requirement_dispatch_payload,
    should_apply_remote_requirement_push
} from '../../js/logic/audit_remote_push_apply.js';
import {
    clear_rule_file_sync_baseline_for_testing,
    note_audit_full_sync_required,
    note_metadata_only_changed,
    note_requirement_result_changed
} from '../../js/sync/audit_sync_planning.js';

describe('audit_remote_push_apply', () => {
    beforeEach(() => {
        clear_rule_file_sync_baseline_for_testing();
    });

    const base_state = {
        auditId: 'audit-1',
        version: 5,
        samples: [
            {
                id: 'sample-a',
                requirementResults: {
                    'req-1': { lastStatusUpdate: '2026-06-08T10:00:00.000Z', status: 'passed' }
                }
            }
        ]
    };

    const base_push = {
        auditId: 'audit-1',
        changeKind: 'requirement_updated',
        version: 6,
        sampleId: 'sample-a',
        requirementId: 'req-1',
        result: { lastStatusUpdate: '2026-06-08T11:00:00.000Z', status: 'failed' },
        updatedBy: 'Anna'
    };

    test('applicerar push när version är nyare och inget lokalt väntar', () => {
        expect(should_apply_remote_requirement_push(base_state, base_push)).toBe(true);
    });

    test('hoppar över push när lokal version redan är nyare eller lika', () => {
        expect(should_apply_remote_requirement_push({ ...base_state, version: 6 }, base_push)).toBe(false);
    });

    test('hoppar över push vid full synk i kö', () => {
        note_audit_full_sync_required();
        expect(should_apply_remote_requirement_push(base_state, base_push)).toBe(false);
    });

    test('hoppar över push vid metadata-synk i kö', () => {
        note_metadata_only_changed();
        expect(should_apply_remote_requirement_push(base_state, base_push)).toBe(false);
    });

    test('vid pending synk för samma krav krävs nyare remote-tidsstämpel', () => {
        note_requirement_result_changed('sample-a', 'req-1');
        expect(should_apply_remote_requirement_push(base_state, base_push)).toBe(true);

        const older_push = {
            ...base_push,
            result: { lastStatusUpdate: '2026-06-08T09:00:00.000Z', status: 'failed' }
        };
        expect(should_apply_remote_requirement_push(base_state, older_push)).toBe(false);
    });

    test('bygger dispatch-payload med from_remote_push och skip_server_sync', () => {
        const payload = build_remote_requirement_dispatch_payload(base_push);
        expect(payload).toEqual({
            sampleId: 'sample-a',
            requirementId: 'req-1',
            newRequirementResult: base_push.result,
            skip_server_sync: true,
            from_remote_push: true,
            remote_version: 6
        });
    });
});
