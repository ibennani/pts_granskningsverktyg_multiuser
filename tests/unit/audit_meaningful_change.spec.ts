/**
 * @fileoverview Tester för serverlogik: meningsfull granskningsändring (updated_at-styrning).
 */

import { describe, expect, test } from '@jest/globals';
import {
    has_meaningful_audit_patch_change,
    meaningful_audit_content_slice,
    merge_audit_patch_into_row,
    type AuditRowMeaningfulSource
} from '../../server/logic/audit_meaningful_change.ts';

const base_row: AuditRowMeaningfulSource = {
    metadata: { caseNumber: '1', actorName: 'A', audit_edit_log: [{ at: '2020-01-01', auditStatus: 'in_progress' }] },
    status: 'in_progress',
    samples: [{ id: 's1', requirementResults: {} }],
    rule_file_content: { metadata: { title: 'R' } },
    archived_requirement_results: [],
    last_rulefile_update_log: null
};

describe('audit_meaningful_change', () => {
    test('endast audit_edit_log ändrad → ingen meningsfull ändring', () => {
        const patch = {
            metadata: {
                ...((base_row.metadata as Record<string, unknown>) || {}),
                audit_edit_log: [
                    ...(Array.isArray((base_row.metadata as { audit_edit_log?: unknown[] })?.audit_edit_log)
                        ? (base_row.metadata as { audit_edit_log: unknown[] }).audit_edit_log
                        : []),
                    { at: '2026-01-02', auditStatus: 'in_progress' }
                ]
            }
        };
        expect(has_meaningful_audit_patch_change(base_row, patch)).toBe(false);
    });

    test('samples ändrade → meningsfull ändring', () => {
        const patch = {
            samples: [{ id: 's1', requirementResults: { r1: { status: 'pass' } } }]
        };
        expect(has_meaningful_audit_patch_change(base_row, patch)).toBe(true);
    });

    test('metadata (utan log) ändrad → meningsfull ändring', () => {
        const patch = {
            metadata: {
                caseNumber: '2',
                actorName: 'A',
                audit_edit_log: (base_row.metadata as { audit_edit_log: unknown[] }).audit_edit_log
            }
        };
        expect(has_meaningful_audit_patch_change(base_row, patch)).toBe(true);
    });

    test('status ändrad → meningsfull ändring', () => {
        expect(has_meaningful_audit_patch_change(base_row, { status: 'locked' })).toBe(true);
    });

    test('rule_file_content ändrad → meningsfull ändring', () => {
        expect(
            has_meaningful_audit_patch_change(base_row, {
                ruleFileContent: { metadata: { title: 'R2' } }
            })
        ).toBe(true);
    });

    test('meaningful_audit_content_slice tar bort audit_edit_log', () => {
        const slice = meaningful_audit_content_slice(base_row);
        expect(slice.metadata).not.toHaveProperty('audit_edit_log');
        expect(slice.metadata.caseNumber).toBe('1');
    });

    test('merge behåller fält som saknas i patch', () => {
        const merged = merge_audit_patch_into_row(base_row, { status: 'locked' });
        expect(merged.status).toBe('locked');
        expect(merged.samples).toEqual(base_row.samples);
    });
});
