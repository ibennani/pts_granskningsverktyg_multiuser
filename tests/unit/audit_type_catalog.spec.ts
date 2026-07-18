/**
 * @file Enhetstester för overlay av granskningstyper från publicerad regelfil.
 */
import {
    apply_audit_type_overlay_to_rule_content,
    merge_audit_types_into_rule_metadata,
    resolve_available_audit_types_for_audit,
    resolve_effective_rule_file_for_audit_types,
    snapshot_lacks_audit_types,
} from '../../shared/audit/audit_type_catalog.js';
import { resolve_grouping_taxonomy_id } from '../../shared/audit/audit_type_metadata.js';

const PUBLISHED_TYPES = [
    { id: 'tillsyn-lptt', label: 'Tillsyn, LPTT', taxonomyId: 'wcag22-pour' },
    {
        id: 'marknadskontroll-lptt',
        label: 'Marknadskontroll LPTT',
        taxonomyId: 'fptt-bilaga-2',
    },
];

const PUBLISHED_RULE = {
    metadata: {
        auditTypes: PUBLISHED_TYPES,
    },
};

const LEGACY_SNAPSHOT = {
    metadata: {
        title: 'Webb LPTT',
    },
    requirements: [{ id: 'req-1' }],
};

describe('audit_type_catalog', () => {
    test('snapshot_lacks_audit_types när auditTypes saknas', () => {
        expect(snapshot_lacks_audit_types(LEGACY_SNAPSHOT)).toBe(true);
        expect(snapshot_lacks_audit_types({ metadata: { auditTypes: [] } })).toBe(true);
        expect(snapshot_lacks_audit_types(PUBLISHED_RULE)).toBe(false);
    });

    test('merge_audit_types_into_rule_metadata fyller i tom auditTypes-array', () => {
        const merged = merge_audit_types_into_rule_metadata(
            { auditTypes: [] },
            PUBLISHED_RULE.metadata
        );
        expect(merged.auditTypes).toEqual(PUBLISHED_TYPES);
    });

    test('merge_audit_types_into_rule_metadata fyller i från publicerad regelfil', () => {
        const merged = merge_audit_types_into_rule_metadata(
            LEGACY_SNAPSHOT.metadata,
            PUBLISHED_RULE.metadata
        );
        expect(merged.auditTypes).toEqual(PUBLISHED_TYPES);
    });

    test('merge_audit_types_into_rule_metadata skriver inte över befintliga typer', () => {
        const snapshot_types = [
            { id: 'custom', label: 'Egen typ', taxonomyId: 'custom-tax' },
        ];
        const merged = merge_audit_types_into_rule_metadata(
            { auditTypes: snapshot_types },
            PUBLISHED_RULE.metadata
        );
        expect(merged.auditTypes).toEqual(snapshot_types);
    });

    test('resolve_effective_rule_file_for_audit_types behåller krav i ögonblicksbilden', () => {
        const effective = resolve_effective_rule_file_for_audit_types(
            LEGACY_SNAPSHOT,
            PUBLISHED_RULE
        ) as typeof LEGACY_SNAPSHOT & { metadata: { auditTypes: typeof PUBLISHED_TYPES } };
        expect(effective.requirements).toEqual(LEGACY_SNAPSHOT.requirements);
        expect(effective.metadata.auditTypes).toEqual(PUBLISHED_TYPES);
        expect(effective.metadata.title).toBe('Webb LPTT');
    });

    test('ögonblicksbild utan typer + publicerad med typer ger två typer', () => {
        expect(resolve_available_audit_types_for_audit(LEGACY_SNAPSHOT, PUBLISHED_RULE)).toHaveLength(
            2
        );
    });

    test('apply_audit_type_overlay_to_rule_content utan publicerad regelfil lämnar snapshot oförändrad', () => {
        expect(apply_audit_type_overlay_to_rule_content(LEGACY_SNAPSHOT, null)).toBe(
            LEGACY_SNAPSHOT
        );
    });

    test('resolve_grouping_taxonomy_id med overlay och marknadskontroll', () => {
        const effective = resolve_effective_rule_file_for_audit_types(
            LEGACY_SNAPSHOT,
            PUBLISHED_RULE
        );
        expect(
            resolve_grouping_taxonomy_id(effective, {
                auditTypeId: 'marknadskontroll-lptt',
            })
        ).toBe('fptt-bilaga-2');
    });
});
