/**
 * @fileoverview Taxonomival i Bilaga 2-export (POUR vs granskningstyp).
 */
import { describe, test, expect } from '@jest/globals';
import {
    get_export_concept_ids_for_requirement,
    get_export_grouping_taxonomy_id,
} from '../../js/export/export_taxonomy_mapping.ts';
import {
    get_primary_taxonomy_export_columns,
    get_primary_taxonomy_export_values_for_requirement,
} from '../../js/export/export_format_helpers.ts';

const RULE_WITH_TAXONOMIES = {
    metadata: {
        primaryGroupingTaxonomyId: 'fptt-bilaga-2',
        taxonomies: [
            {
                id: 'wcag22-pour',
                label: 'WCAG 2.2 POUR',
                concepts: [
                    { id: 'perceivable', label: 'Uppfattningsbar' },
                    { id: 'operable', label: 'Hanterbar' },
                ],
            },
            {
                id: 'fptt-bilaga-2',
                label: 'FPTT, bilaga 2',
                concepts: [
                    { id: 'fptt-uppfattningsbar', label: 'Uppfattningsbar' },
                    { id: 'fptt-hanterbar', label: 'Hanterbar' },
                ],
            },
        ],
        auditTypes: [
            { id: 'tillsyn-lptt', label: 'Tillsyn, LPTT', taxonomyId: 'wcag22-pour' },
            { id: 'marknadskontroll-lptt', label: 'Marknadskontroll LPTT', taxonomyId: 'fptt-bilaga-2' },
        ],
    },
};

describe('export_grouping_taxonomy', () => {
    test('använder POUR när granskningstyp saknas även om primär taxonomi är FPTT', () => {
        expect(
            get_export_grouping_taxonomy_id({
                ruleFileContent: RULE_WITH_TAXONOMIES,
                auditMetadata: {},
            })
        ).toBe('wcag22-pour');
    });

    test('Tillsyn använder POUR-kolumner och POUR-kopplingar', () => {
        const audit = {
            ruleFileContent: RULE_WITH_TAXONOMIES,
            auditMetadata: { auditTypeId: 'tillsyn-lptt' },
        };
        const requirement = {
            classifications: [{ taxonomyId: 'wcag22-pour', conceptId: 'operable' }],
        };

        expect(get_export_grouping_taxonomy_id(audit)).toBe('wcag22-pour');

        const values = get_primary_taxonomy_export_values_for_requirement(
            requirement,
            audit,
            (key) => (key === 'yes' ? 'Ja' : 'Nej')
        );

        expect(values.taxonomy_perceivable).toBe('Nej');
        expect(values.taxonomy_operable).toBe('Ja');
    });

    test('Marknadskontroll använder FPTT-kolumner', () => {
        const audit = {
            ruleFileContent: RULE_WITH_TAXONOMIES,
            auditMetadata: {
                auditTypeId: 'marknadskontroll-lptt',
                auditTypeLabel: 'Marknadskontroll LPTT',
            },
        };

        expect(get_export_grouping_taxonomy_id(audit)).toBe('fptt-bilaga-2');

        const columns = get_primary_taxonomy_export_columns(audit, (key) => key);
        expect(columns.map((col) => col.header)).toEqual(['Uppfattningsbar', 'Hanterbar']);
    });

    test('Marknadskontroll mappar legacy POUR-kopplingar till FPTT-kolumner', () => {
        const audit = {
            ruleFileContent: RULE_WITH_TAXONOMIES,
            auditMetadata: { auditTypeId: 'marknadskontroll-lptt' },
        };
        const requirement = {
            classifications: [{ taxonomyId: 'wcag22-pour', conceptId: 'operable' }],
        };

        const values = get_primary_taxonomy_export_values_for_requirement(
            requirement,
            audit,
            (key) => (key === 'yes' ? 'Ja' : 'Nej')
        );

        expect(values['taxonomy_fptt-uppfattningsbar']).toBe('Nej');
        expect(values['taxonomy_fptt-hanterbar']).toBe('Ja');
    });

    test('FPTT-koppling används direkt när den finns', () => {
        const audit = {
            ruleFileContent: RULE_WITH_TAXONOMIES,
            auditMetadata: { auditTypeId: 'marknadskontroll-lptt' },
        };
        const requirement = {
            classifications: [{ taxonomyId: 'fptt-bilaga-2', conceptId: 'fptt-hanterbar' }],
        };

        const mapped = get_export_concept_ids_for_requirement(
            requirement,
            RULE_WITH_TAXONOMIES.metadata,
            'fptt-bilaga-2',
            (key) => key
        );

        expect(mapped).toEqual(['fptt-hanterbar']);
    });
});
