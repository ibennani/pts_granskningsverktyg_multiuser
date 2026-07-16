import {
    apply_requirement_classifications,
    get_concept_ids_for_requirement,
    get_primary_grouping_taxonomy_id,
} from '../../shared/classification/taxonomy_grouping.ts';

describe('taxonomy_grouping', () => {
    const metadata = {
        primaryGroupingTaxonomyId: 'wcag22-pour',
        taxonomies: [
            {
                id: 'wcag22-pour',
                label: 'WCAG-principer',
                concepts: [
                    { id: 'perceivable', label: 'Uppfattningsbar' },
                    { id: 'operable', label: 'Hanterbar' },
                ],
            },
        ],
    };

    test('get_primary_grouping_taxonomy_id läser metadata', () => {
        expect(get_primary_grouping_taxonomy_id({ metadata })).toBe('wcag22-pour');
    });

    test('apply_requirement_classifications ersätter bara vald taxonomi', () => {
        const requirement = {
            classifications: [
                { taxonomyId: 'lagkrav', conceptId: 'a' },
                { taxonomyId: 'wcag22-pour', conceptId: 'operable' },
            ],
        };
        const updated = apply_requirement_classifications(requirement, 'wcag22-pour', ['perceivable']);
        expect(get_concept_ids_for_requirement(updated, 'wcag22-pour')).toEqual(['perceivable']);
        expect(get_concept_ids_for_requirement(updated, 'lagkrav')).toEqual(['a']);
    });
});
