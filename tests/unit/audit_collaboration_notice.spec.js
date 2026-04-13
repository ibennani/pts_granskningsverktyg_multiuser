import { describe, test, expect, beforeEach } from '@jest/globals';
import {
    clear_all_audit_baselines_for_testing,
    establish_baseline_for_current_audit_focus,
    should_show_audit_collaboration_notice
} from '../../js/logic/audit_collaboration_notice.js';

function make_state({ auditId, sampleId, reqKey, resultValue }) {
    return {
        auditId,
        ruleFileContent: { requirements: { [reqKey]: { id: reqKey, key: reqKey, title: 'T' } } },
        samples: [
            {
                id: sampleId,
                requirementResults: {
                    [reqKey]: resultValue
                }
            }
        ]
    };
}

beforeEach(() => {
    clear_all_audit_baselines_for_testing();
    window.__gv_current_view_name = 'requirement_audit';
    window.__gv_current_view_params_json = JSON.stringify({ sampleId: 's1', requirementId: 'r1' });
});

describe('should_show_audit_collaboration_notice', () => {
    test('false när baseline saknas (inte osparat spårat ännu)', () => {
        const local = make_state({ auditId: 'a1', sampleId: 's1', reqKey: 'r1', resultValue: { status: 'not_audited' } });
        const remote = make_state({ auditId: 'a1', sampleId: 's1', reqKey: 'r1', resultValue: { status: 'failed' } });
        expect(should_show_audit_collaboration_notice({ local_state: local, remote_state: remote })).toBe(false);
    });

    test('false när inte dirty (lokalt = baseline) även om remote skiljer sig', () => {
        const local = make_state({ auditId: 'a1', sampleId: 's1', reqKey: 'r1', resultValue: { status: 'not_audited' } });
        establish_baseline_for_current_audit_focus(local);
        const remote = make_state({ auditId: 'a1', sampleId: 's1', reqKey: 'r1', resultValue: { status: 'failed' } });
        expect(should_show_audit_collaboration_notice({ local_state: local, remote_state: remote })).toBe(false);
    });

    test('true när dirty och incoming i fokus-cellen', () => {
        const baseline = make_state({ auditId: 'a1', sampleId: 's1', reqKey: 'r1', resultValue: { status: 'not_audited' } });
        establish_baseline_for_current_audit_focus(baseline);
        const local_dirty = make_state({ auditId: 'a1', sampleId: 's1', reqKey: 'r1', resultValue: { status: 'passed' } });
        const remote = make_state({ auditId: 'a1', sampleId: 's1', reqKey: 'r1', resultValue: { status: 'failed' } });
        expect(should_show_audit_collaboration_notice({ local_state: local_dirty, remote_state: remote })).toBe(true);
    });

    test('false när remote inte skiljer sig från lokalt (incoming saknas)', () => {
        const baseline = make_state({ auditId: 'a1', sampleId: 's1', reqKey: 'r1', resultValue: { status: 'not_audited' } });
        establish_baseline_for_current_audit_focus(baseline);
        const local_dirty = make_state({ auditId: 'a1', sampleId: 's1', reqKey: 'r1', resultValue: { status: 'passed' } });
        const remote_same = make_state({ auditId: 'a1', sampleId: 's1', reqKey: 'r1', resultValue: { status: 'passed' } });
        expect(should_show_audit_collaboration_notice({ local_state: local_dirty, remote_state: remote_same })).toBe(false);
    });
});

