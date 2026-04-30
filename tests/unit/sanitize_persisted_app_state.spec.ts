/**
 * @fileoverview Tester för defensiv normalisering av persistensladdat app-state.
 */

import { describe, it, expect } from '@jest/globals';
import {
    coerce_to_array,
    coerce_audit_status,
    coerce_rule_file_content,
    coerce_audit_metadata,
    coerce_plain_object_or_empty,
    coerce_deficiency_counter,
    coerce_nullable_plain_object,
    sanitize_persisted_app_state_shape
} from '../../js/logic/sanitize_persisted_app_state.js';
import { initial_state } from '../../js/state/initialState.js';

describe('sanitize_persisted_app_state', () => {
    it('coerce_to_array ger tom array för ogiltiga värden', () => {
        expect(coerce_to_array(null)).toEqual([]);
        expect(coerce_to_array({})).toEqual([]);
        expect(coerce_to_array('x')).toEqual([]);
        expect(coerce_to_array([1, 2])).toEqual([1, 2]);
    });

    it('coerce_audit_status accepterar kända värden och faller tillbaka annars', () => {
        expect(coerce_audit_status('locked')).toBe('locked');
        expect(coerce_audit_status('error')).toBe('error');
        expect(coerce_audit_status('rulefile_editing')).toBe('rulefile_editing');
        expect(coerce_audit_status('okänd')).toBe('not_started');
        expect(coerce_audit_status(null)).toBe('not_started');
    });

    it('coerce_rule_file_content behåller objekt och nollar annat', () => {
        expect(coerce_rule_file_content({ a: 1 })).toEqual({ a: 1 });
        expect(coerce_rule_file_content(null)).toBe(null);
        expect(coerce_rule_file_content([])).toBe(null);
        expect(coerce_rule_file_content('x')).toBe(null);
    });

    it('coerce_audit_metadata ersätter icke-objekt med mall', () => {
        const template = { ...initial_state.auditMetadata } as Record<string, unknown>;
        expect(coerce_audit_metadata(null, template).caseNumber).toBe('');
        expect(coerce_audit_metadata([], template).actorName).toBe('');
        expect(coerce_audit_metadata({ caseNumber: '42' }, template).caseNumber).toBe('42');
    });

    it('coerce_plain_object_or_empty', () => {
        expect(coerce_plain_object_or_empty(null)).toEqual({});
        expect(coerce_plain_object_or_empty([1])).toEqual({});
        expect(coerce_plain_object_or_empty({ x: 1 })).toEqual({ x: 1 });
    });

    it('coerce_deficiency_counter', () => {
        expect(coerce_deficiency_counter(3)).toBe(3);
        expect(coerce_deficiency_counter('5')).toBe(5);
        expect(coerce_deficiency_counter(0)).toBe(1);
        expect(coerce_deficiency_counter(NaN)).toBe(1);
    });

    it('coerce_nullable_plain_object', () => {
        expect(coerce_nullable_plain_object(null)).toBe(null);
        expect(coerce_nullable_plain_object({ a: 1 })).toEqual({ a: 1 });
        expect(coerce_nullable_plain_object([])).toBe(null);
    });

    it('sanitize_persisted_app_state_shape rättar flera trasiga fält', () => {
        const raw: Record<string, unknown> = {
            ...JSON.parse(JSON.stringify(initial_state)),
            samples: {},
            archivedRequirementResults: 'bad',
            auditMetadata: null,
            auditStatus: 'ogiltig',
            ruleFileContent: [],
            deficiencyCounter: '0',
            manageUsersText: 123,
            pendingSampleChanges: [],
            auditCalculations: null
        };
        const out = sanitize_persisted_app_state_shape(raw);
        expect(Array.isArray(out.samples)).toBe(true);
        expect((out.samples as unknown[]).length).toBe(0);
        expect(Array.isArray(out.archivedRequirementResults)).toBe(true);
        expect(out.auditStatus).toBe('not_started');
        expect(out.ruleFileContent).toBe(null);
        expect(out.deficiencyCounter).toBe(1);
        expect(out.manageUsersText).toBe('');
        expect(out.pendingSampleChanges).toBe(null);
        expect(typeof out.auditMetadata).toBe('object');
        expect(out.auditMetadata).not.toBeNull();
        expect((out.auditMetadata as { caseNumber: string }).caseNumber).toBe('');
        expect(out.auditCalculations).toEqual({});
    });
});
