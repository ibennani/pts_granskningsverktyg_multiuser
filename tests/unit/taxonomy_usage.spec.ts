/**
 * Enhetstester för taxonomy_usage.
 */
import { describe, test, expect } from '@jest/globals';
import { get_taxonomy_usage_check } from '../../js/logic/taxonomy_usage.ts';

describe('get_taxonomy_usage_check', () => {
    test('tillåter radering när taxonomin inte används', () => {
        const result = get_taxonomy_usage_check(
            {
                metadata: {
                    taxonomies: [{ id: 'unused', label: 'Oanvänd' }],
                    auditTypes: [],
                },
                requirements: {},
            },
            'unused'
        );
        expect(result.can_delete).toBe(true);
        expect(result.reasons).toEqual([]);
    });

    test('blockerar radering vid primär gruppering', () => {
        const result = get_taxonomy_usage_check(
            {
                metadata: {
                    primaryGroupingTaxonomyId: 'wcag22-pour',
                    taxonomies: [{ id: 'wcag22-pour', label: 'POUR' }],
                },
                requirements: {},
            },
            'wcag22-pour'
        );
        expect(result.can_delete).toBe(false);
        expect(result.reasons).toContain('primary_grouping');
    });

    test('blockerar radering vid kravkoppling', () => {
        const result = get_taxonomy_usage_check(
            {
                metadata: { taxonomies: [{ id: 'wcag22-pour', label: 'POUR' }] },
                requirements: {
                    req1: {
                        classifications: [{ taxonomyId: 'wcag22-pour', conceptId: 'a' }],
                    },
                },
            },
            'wcag22-pour'
        );
        expect(result.can_delete).toBe(false);
        expect(result.reasons).toContain('requirement_classifications');
    });
});
