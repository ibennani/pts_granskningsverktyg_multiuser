/**
 * Tester för granskningsstatus (not_started → in_progress → locked → archived).
 */
import { describe, test, expect } from '@jest/globals';
import { reduce_set_audit_status } from '../../js/state/auditStatusHandlers.js';

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function base_state(overrides: Record<string, unknown> = {}) {
    return {
        saveFileVersion: 1,
        auditStatus: 'not_started',
        auditMetadata: {},
        samples: [],
        ruleFileContent: { requirements: {}, metadata: {} },
        deficiencyCounter: 1,
        endTime: null,
        auditLastUpdatedAtFrozen: null,
        ...overrides
    };
}

describe('reduce_set_audit_status', () => {
    test('not_started → in_progress sätter status och rensar brist-id', () => {
        const state = base_state({
            auditStatus: 'not_started',
            deficiencyCounter: 5
        });
        const next = reduce_set_audit_status(state, { payload: { status: 'in_progress' } });
        expect(next.auditStatus).toBe('in_progress');
        expect(next.deficiencyCounter).toBe(1);
    });

    test('in_progress → locked sätter status, endTime och fryser senast uppdaterad', () => {
        const state = base_state({
            auditStatus: 'in_progress',
            endTime: null
        });
        const next = reduce_set_audit_status(state, { payload: { status: 'locked' } });
        expect(next.auditStatus).toBe('locked');
        expect(next.endTime).toMatch(ISO_RE);
        expect(next.auditLastUpdatedAtFrozen).toBeNull();
    });

    test('locked → in_progress tar bort endTime och fryst tidsstämpel', () => {
        const state = base_state({
            auditStatus: 'locked',
            endTime: '2026-06-01T10:00:00.000Z',
            auditLastUpdatedAtFrozen: '2026-06-01T10:00:00.000Z',
            deficiencyCounter: 3
        });
        const next = reduce_set_audit_status(state, { payload: { status: 'in_progress' } });
        expect(next.auditStatus).toBe('in_progress');
        expect(next.endTime).toBeNull();
        expect(next.auditLastUpdatedAtFrozen).toBeNull();
        expect(next.deficiencyCounter).toBe(1);
    });

    test('locked → archived behåller endTime och fryst tidsstämpel', () => {
        const state = base_state({
            auditStatus: 'locked',
            endTime: '2026-06-01T10:00:00.000Z',
            auditLastUpdatedAtFrozen: '2026-06-01T10:00:00.000Z'
        });
        const next = reduce_set_audit_status(state, { payload: { status: 'archived' } });
        expect(next.auditStatus).toBe('archived');
        expect(next.endTime).toBe('2026-06-01T10:00:00.000Z');
        expect(next.auditLastUpdatedAtFrozen).toBe('2026-06-01T10:00:00.000Z');
    });

    test('archived → locked (återaktivera) behåller övrigt innehåll', () => {
        const state = base_state({
            auditStatus: 'archived',
            endTime: '2026-06-01T10:00:00.000Z',
            auditLastUpdatedAtFrozen: '2026-06-01T10:00:00.000Z'
        });
        const next = reduce_set_audit_status(state, { payload: { status: 'locked' } });
        expect(next.auditStatus).toBe('locked');
        expect(next.endTime).toBe('2026-06-01T10:00:00.000Z');
    });

    test('in_progress → locked sätter last_local_change_at', () => {
        const state = base_state({ auditStatus: 'in_progress' });
        const next = reduce_set_audit_status(state, { payload: { status: 'locked' } });
        expect(next.auditMetadata.last_local_change_at).toMatch(ISO_RE);
    });

    test('locked → in_progress sätter inte last_local_change_at (gammal status var låst)', () => {
        const state = base_state({
            auditStatus: 'locked',
            auditMetadata: { last_local_change_at: '2026-06-01T08:00:00.000Z' }
        });
        const next = reduce_set_audit_status(state, { payload: { status: 'in_progress' } });
        expect(next.auditMetadata.last_local_change_at).toBe('2026-06-01T08:00:00.000Z');
    });

    test('samma status lämnar last_local_change_at oförändrat', () => {
        const state = base_state({
            auditStatus: 'in_progress',
            auditMetadata: { last_local_change_at: '2026-06-01T08:00:00.000Z' }
        });
        const next = reduce_set_audit_status(state, { payload: { status: 'in_progress' } });
        expect(next.auditMetadata.last_local_change_at).toBe('2026-06-01T08:00:00.000Z');
    });
});
