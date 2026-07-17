/**
 * @file Enhetstester för granskningstyp i granskningsmetadata.
 */
import {
    apply_audit_type_selection,
    apply_single_audit_type_if_unique,
    audit_type_editable_for_status,
    merge_appendix1_with_audit_type_override,
    resolve_grouping_taxonomy_id,
} from '../../shared/audit/audit_type_metadata.js';
import { DEFAULT_AUDIT_TYPES } from '../../shared/rulefile/rulefile_audit_types.js';

const RULE_WITH_TYPES = {
    metadata: {
        auditTypes: DEFAULT_AUDIT_TYPES.map((row) => ({ ...row })),
    },
    appendix1: {
        groupingTaxonomyId: 'wcag22-pour',
    },
};

describe('audit_type_metadata', () => {
    test('resolve_grouping_taxonomy_id använder granskningstypens taxonomi', () => {
        expect(
            resolve_grouping_taxonomy_id(RULE_WITH_TYPES, {
                auditTypeId: 'marknadskontroll-lptt',
            })
        ).toBe('wcag22-pour');
    });

    test('resolve_grouping_taxonomy_id faller tillbaka till appendix1', () => {
        expect(resolve_grouping_taxonomy_id({ appendix1: { groupingTaxonomyId: 'other' } }, {})).toBe(
            'other'
        );
    });

    test('apply_single_audit_type_if_unique sätter enda typen', () => {
        const meta: Record<string, unknown> = {};
        expect(apply_single_audit_type_if_unique(meta, RULE_WITH_TYPES)).toBe(false);
        const single = {
            metadata: { auditTypes: [{ id: 'tillsyn', label: 'Tillsyn', taxonomyId: 'tax-a' }] },
        };
        expect(apply_single_audit_type_if_unique(meta, single)).toBe(true);
        expect(meta.auditTypeId).toBe('tillsyn');
        expect(meta.auditTypeLabel).toBe('Tillsyn');
    });

    test('apply_audit_type_selection validerar id', () => {
        const meta: Record<string, unknown> = {};
        expect(apply_audit_type_selection(meta, RULE_WITH_TYPES, 'tillsyn-lptt')).toBe(true);
        expect(meta.auditTypeLabel).toBe('Tillsyn, LPTT');
        expect(apply_audit_type_selection(meta, RULE_WITH_TYPES, 'finns-inte')).toBe(false);
    });

    test('audit_type_editable_for_status endast not_started', () => {
        expect(audit_type_editable_for_status('not_started')).toBe(true);
        expect(audit_type_editable_for_status('in_progress')).toBe(false);
        expect(audit_type_editable_for_status('locked')).toBe(false);
    });

    test('merge_appendix1_with_audit_type_override slår ihop bodyText', () => {
        const merged = merge_appendix1_with_audit_type_override(
            {
                bodyText: 'Standard',
                byAuditType: {
                    'tillsyn-lptt': { bodyText: 'Tillsynstext' },
                },
            },
            'tillsyn-lptt'
        );
        expect(merged?.bodyText).toBe('Tillsynstext');
    });
});
