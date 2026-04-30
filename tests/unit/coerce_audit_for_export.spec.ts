/**
 * @fileoverview Tester för exportfasadens audit-normalisering.
 */

import { describe, it, expect } from '@jest/globals';
import { coerce_audit_for_export } from '../../js/logic/coerce_audit_for_export.js';

describe('coerce_audit_for_export', () => {
    it('lämnar null och undefined orörda', () => {
        expect(coerce_audit_for_export(null)).toBe(null);
        expect(coerce_audit_for_export(undefined)).toBe(undefined);
    });

    it('ersätter icke-array samples med tom array', () => {
        const audit = { samples: {}, auditMetadata: { x: 1 } } as Record<string, unknown>;
        const out = coerce_audit_for_export(audit);
        expect(Array.isArray(out.samples)).toBe(true);
        expect((out.samples as unknown[]).length).toBe(0);
        expect((out as { auditMetadata: { x: number } }).auditMetadata.x).toBe(1);
    });

    it('ersätter icke-array archivedRequirementResults', () => {
        const out = coerce_audit_for_export({ archivedRequirementResults: 'x' } as Record<string, unknown>);
        expect(out.archivedRequirementResults).toEqual([]);
    });

    it('bevarar giltiga arrayer', () => {
        const s = [{ id: '1' }];
        const out = coerce_audit_for_export({ samples: s } as Record<string, unknown>);
        expect(out.samples).toBe(s);
    });
});
