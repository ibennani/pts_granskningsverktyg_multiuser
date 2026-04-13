import { describe, test, expect, beforeEach } from '@jest/globals';
import {
    clear_all_rulefile_baselines_for_testing,
    ensure_rulefile_baseline_for_current_focus,
    should_show_rulefile_collaboration_notice
} from '../../js/logic/rulefile_collaboration_notice.js';

function make_state({ ruleSetId, content }) {
    return {
        ruleSetId,
        auditStatus: 'rulefile_editing',
        ruleFileContent: content
    };
}

beforeEach(() => {
    clear_all_rulefile_baselines_for_testing();
});

describe('should_show_rulefile_collaboration_notice', () => {
    test('false när inte dirty (lokalt = baseline) även om remote skiljer sig i metadata', () => {
        window.__gv_current_view_name = 'rulefile_metadata_edit';
        window.__gv_current_view_params_json = JSON.stringify({});
        const local = make_state({
            ruleSetId: 'rs1',
            content: { metadata: { title: 'A' }, requirements: {} }
        });
        ensure_rulefile_baseline_for_current_focus(local);
        const remote = { metadata: { title: 'B' }, requirements: {} };
        expect(should_show_rulefile_collaboration_notice({ local_state: local, remote_content: remote })).toBe(false);
    });

    test('true när dirty och incoming i samma krav', () => {
        window.__gv_current_view_name = 'rulefile_edit_requirement';
        window.__gv_current_view_params_json = JSON.stringify({ requirementId: 'r1' });
        const baseline = make_state({
            ruleSetId: 'rs1',
            content: { metadata: { title: 'A' }, requirements: { r1: { title: 'T1' } } }
        });
        ensure_rulefile_baseline_for_current_focus(baseline);
        const local_dirty = make_state({
            ruleSetId: 'rs1',
            content: { metadata: { title: 'A' }, requirements: { r1: { title: 'Min' } } }
        });
        const remote = { metadata: { title: 'A' }, requirements: { r1: { title: 'Deras' } } };
        expect(should_show_rulefile_collaboration_notice({ local_state: local_dirty, remote_content: remote })).toBe(true);
    });

    test('false när jag bara tittar (baseline finns, men lokalt ej dirty) i krav-vy', () => {
        window.__gv_current_view_name = 'rulefile_view_requirement';
        window.__gv_current_view_params_json = JSON.stringify({ requirementId: 'r1' });
        const local = make_state({
            ruleSetId: 'rs1',
            content: { metadata: { title: 'A' }, requirements: { r1: { title: 'T1' } } }
        });
        ensure_rulefile_baseline_for_current_focus(local);
        const remote = { metadata: { title: 'A' }, requirements: { r1: { title: 'T2' } } };
        expect(should_show_rulefile_collaboration_notice({ local_state: local, remote_content: remote })).toBe(false);
    });
});

