/**
 * Tester för audit_sync_planning.ts
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import {
    clear_rule_file_sync_baseline_for_testing,
    fingerprint_rule_file_content,
    mark_rule_file_synced_from_state,
    note_audit_full_sync_required,
    note_metadata_only_changed,
    note_requirement_result_changed,
    peek_audit_sync_strategy,
    resolve_audit_sync_strategy,
    should_include_rule_file_in_patch
} from '../../js/sync/audit_sync_planning.js';

describe('audit_sync_planning', () => {
    beforeEach(() => {
        clear_rule_file_sync_baseline_for_testing();
    });

    test('should_include_rule_file_in_patch är true första gången', () => {
        const rule = { metadata: { title: 'A' } };
        expect(should_include_rule_file_in_patch(rule)).toBe(true);
    });

    test('should_include_rule_file_in_patch är false när regelfil oförändrad', () => {
        const rule = { metadata: { title: 'A' } };
        mark_rule_file_synced_from_state(rule);
        expect(should_include_rule_file_in_patch(rule)).toBe(false);
    });

    test('should_include_rule_file_in_patch är true efter regelfilsändring', () => {
        const rule = { metadata: { title: 'A' } };
        mark_rule_file_synced_from_state(rule);
        expect(should_include_rule_file_in_patch({ metadata: { title: 'B' } })).toBe(true);
    });

    test('resolve_audit_sync_strategy: ett krav → single_requirement', () => {
        note_requirement_result_changed('s1', 'r1');
        expect(resolve_audit_sync_strategy()).toEqual({
            mode: 'single_requirement',
            sample_id: 's1',
            requirement_id: 'r1'
        });
    });

    test('resolve_audit_sync_strategy: två krav → full', () => {
        note_requirement_result_changed('s1', 'r1');
        note_requirement_result_changed('s1', 'r2');
        expect(resolve_audit_sync_strategy()).toEqual({ mode: 'full' });
    });

    test('note_audit_full_sync_required tvingar full', () => {
        note_requirement_result_changed('s1', 'r1');
        note_audit_full_sync_required();
        expect(resolve_audit_sync_strategy()).toEqual({ mode: 'full' });
    });

    test('resolve_audit_sync_strategy: endast metadata → metadata_only', () => {
        note_metadata_only_changed();
        expect(resolve_audit_sync_strategy()).toEqual({ mode: 'metadata_only' });
    });

    test('metadata + krav i samma debounce → single_requirement eller full, inte metadata_only', () => {
        note_metadata_only_changed();
        note_requirement_result_changed('s1', 'r1');
        const strategy = resolve_audit_sync_strategy();
        expect(strategy.mode).toBe('single_requirement');
    });

    test('krav efter metadata i kö → krav vinner', () => {
        note_metadata_only_changed();
        note_requirement_result_changed('s1', 'r1');
        expect(resolve_audit_sync_strategy().mode).not.toBe('metadata_only');
    });

    test('fingerprint_rule_file_content är stabil', () => {
        const rule = { x: 1 };
        expect(fingerprint_rule_file_content(rule)).toBe(fingerprint_rule_file_content(rule));
    });

    test('has_pending_audit_sync_plan är false utan köer', async () => {
        const {
            clear_rule_file_sync_baseline_for_testing,
            has_pending_audit_sync_plan
        } = await import('../../js/sync/audit_sync_planning.js');
        clear_rule_file_sync_baseline_for_testing();
        expect(has_pending_audit_sync_plan()).toBe(false);
    });

    test('peek_audit_sync_strategy tömmer inte köer', () => {
        note_requirement_result_changed('s1', 'r1');
        expect(peek_audit_sync_strategy()).toEqual({
            mode: 'single_requirement',
            sample_id: 's1',
            requirement_id: 'r1'
        });
        expect(resolve_audit_sync_strategy()).toEqual({
            mode: 'single_requirement',
            sample_id: 's1',
            requirement_id: 'r1'
        });
    });
});
