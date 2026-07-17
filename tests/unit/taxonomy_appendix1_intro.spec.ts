/**
 * Enhetstester för Bilaga 1-inledningar på taxonomiprinciper.
 */
import {
    merge_concept_intros_into_metadata,
    migrate_deficiency_intro_content_to_taxonomy,
    read_concept_appendix1_intro,
    read_audit_principle_intro_overrides,
    resolve_principle_intro_content,
} from '../../js/logic/appendix1_principle_intro.ts';
import {
    generate_deficiency_sections_from_taxonomy,
    get_default_appendix1_sections_list,
    normalize_rulefile_appendix1,
    resolve_appendix1_sections_list,
} from '../../js/logic/appendix1_sections.ts';

describe('taxonomy_appendix1_intro', () => {
    test('normalize_rulefile_appendix1 migrerar deficiency-innehåll till concepts.appendix1Intro', () => {
        const sections = get_default_appendix1_sections_list();
        const normalized = normalize_rulefile_appendix1({
            appendix1: { sections },
            metadata: {
                taxonomies: [
                    {
                        id: 'wcag22-pour',
                        concepts: [{ id: 'perceivable', label: 'Uppfattningsbar' }],
                    },
                ],
            },
        });

        const metadata = normalized.metadata as {
            taxonomies: Array<{ concepts: Array<{ id: string; appendix1Intro?: string }> }>;
        };
        const appendix1 = normalized.appendix1 as {
            sections: Array<{ kind: string; content: string; conceptId?: string }>;
        };
        const perceivable = metadata.taxonomies[0]?.concepts.find((c) => c.id === 'perceivable');
        expect(perceivable?.appendix1Intro).toContain('PTS har funnit brister');
        const stored_group = appendix1.sections.find((s) => s.conceptId === 'perceivable');
        expect(stored_group?.content).toBe('');
    });

    test('resolve_principle_intro_content prioriterar granskningsöverstyrning', () => {
        const rule_file = {
            metadata: {
                taxonomies: [
                    {
                        id: 'wcag22-pour',
                        concepts: [
                            {
                                id: 'perceivable',
                                label: 'Uppfattningsbar',
                                appendix1Intro: 'Regelfilens text',
                            },
                        ],
                    },
                ],
            },
        };
        const audit = {
            auditMetadata: {
                appendix1PrincipleIntroOverrides: {
                    perceivable: 'Granskningsspecifik text',
                },
            },
        };
        expect(
            resolve_principle_intro_content(audit, rule_file, 'wcag22-pour', 'perceivable')
        ).toBe('Granskningsspecifik text');
    });

    test('resolve_appendix1_sections_list fyller deficiency-innehåll från taxonomi', () => {
        const audit = {
            ruleFileContent: {
                appendix1: {
                    groupingTaxonomyId: 'wcag22-pour',
                    sections: [
                        {
                            id: 'results_perceivable',
                            kind: 'deficiency_group',
                            headingLevel: 2,
                            conceptId: 'perceivable',
                            title: '3.1 Test',
                            content: '',
                        },
                    ],
                },
                metadata: {
                    taxonomies: [
                        {
                            id: 'wcag22-pour',
                            concepts: [
                                {
                                    id: 'perceivable',
                                    label: 'Uppfattningsbar',
                                    appendix1Intro: 'Taxonomi-inledning',
                                },
                            ],
                        },
                    ],
                },
            },
        };
        const section = resolve_appendix1_sections_list(audit).find(
            (entry) => entry.conceptId === 'perceivable'
        );
        expect(section?.content).toBe('Taxonomi-inledning');
    });

    test('merge_concept_intros_into_metadata uppdaterar rätt princip', () => {
        const rule_file = {
            metadata: {
                taxonomies: [
                    {
                        id: 'wcag22-pour',
                        concepts: [{ id: 'operable', label: 'Hanterbar' }],
                    },
                ],
            },
        };
        merge_concept_intros_into_metadata(rule_file, 'wcag22-pour', {
            operable: 'Ny inledning',
        });
        expect(read_concept_appendix1_intro(rule_file.metadata, 'wcag22-pour', 'operable')).toBe(
            'Ny inledning'
        );
    });

    test('generate_deficiency_sections_from_taxonomy hämtar innehåll från taxonomi', () => {
        const rule_file = {
            appendix1: { groupingTaxonomyId: 'wcag22-pour' },
            metadata: {
                taxonomies: [
                    {
                        id: 'wcag22-pour',
                        concepts: [
                            {
                                id: 'robust',
                                label: 'Robust',
                                appendix1Intro: 'Robust intro',
                            },
                        ],
                    },
                ],
            },
        };
        const sections = generate_deficiency_sections_from_taxonomy(rule_file, (key) => key);
        expect(sections[0]?.content).toBe('Robust intro');
    });

    test('read_audit_principle_intro_overrides tolererar saknat fält', () => {
        expect(read_audit_principle_intro_overrides({})).toEqual({});
    });

    test('migrate_deficiency_intro_content_to_taxonomy seedar default för WCAG-principer', () => {
        const rule_file = { metadata: { taxonomies: [{ id: 'wcag22-pour', concepts: [] }] } };
        migrate_deficiency_intro_content_to_taxonomy(rule_file, [], 'wcag22-pour');
        expect(read_concept_appendix1_intro(rule_file.metadata, 'wcag22-pour', 'robust')).toContain(
            'PTS har funnit brister'
        );
    });
});
