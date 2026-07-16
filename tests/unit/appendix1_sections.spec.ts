import {
    apply_appendix1_placeholders,
    build_appendix1_placeholder_context,
    generate_deficiency_sections_from_taxonomy,
    get_default_appendix1_sections,
    get_default_appendix1_sections_list,
    migrate_appendix1_sections_object_to_array,
    normalize_rulefile_appendix1,
    normalize_section_definition,
    read_rulefile_appendix1_sections,
    read_rulefile_appendix1_sections_list,
    resolve_appendix1_sections,
    resolve_appendix1_sections_list,
} from '../../js/logic/appendix1_sections.ts';

describe('appendix1_sections', () => {
    test('read_rulefile_appendix1_sections_list fyller defaults', () => {
        const sections = read_rulefile_appendix1_sections_list({ appendix1: {} });
        const introduction = sections.find((section) => section.id === 'introduction');
        expect(introduction?.title).toBe('1. Inledning');
        expect(introduction?.content).toContain('{{actorName}}');
    });

    test('read_rulefile_appendix1_sections map-format behålls', () => {
        const sections = read_rulefile_appendix1_sections({ appendix1: {} });
        expect(sections.introduction.title).toBe('1. Inledning');
    });

    test('apply_appendix1_placeholders ersätter metadata', () => {
        const context = build_appendix1_placeholder_context({
            auditMetadata: {
                caseNumber: '25-001',
                actorName: 'Test AB',
                actorLink: 'https://www.example.se/',
            },
        });
        const text = apply_appendix1_placeholders('Ärende {{caseNumber}} för {{actorName}}', context);
        expect(text).toBe('Ärende 25-001 för Test AB');
    });

    test('resolve_appendix1_sections_list prioriterar granskningstext för inledning', () => {
        const audit = {
            auditMetadata: { appendix1SummaryText: 'Granskningsspecifik inledning' },
            ruleFileContent: {
                appendix1: {
                    sections: get_default_appendix1_sections_list(),
                },
            },
        };
        const introduction = resolve_appendix1_sections_list(audit).find(
            (section) => section.id === 'introduction'
        );
        expect(introduction?.content).toBe('Granskningsspecifik inledning');
    });

    test('resolve_appendix1_sections map-format fungerar fortfarande', () => {
        const audit = {
            auditMetadata: { appendix1SummaryText: 'Granskningsspecifik inledning' },
            ruleFileContent: {
                appendix1: {
                    sections: get_default_appendix1_sections(),
                },
            },
        };
        expect(resolve_appendix1_sections(audit).introduction.content).toBe('Granskningsspecifik inledning');
    });

    test('normalize_rulefile_appendix1 migrerar summaryText till introduction', () => {
        const normalized = normalize_rulefile_appendix1({
            appendix1: { summaryText: 'Gammal sammanfattning' },
        });
        const appendix1 = normalized.appendix1 as {
            sections: Array<{ id: string; content: string }>;
            groupingTaxonomyId: string;
        };
        expect(Array.isArray(appendix1.sections)).toBe(true);
        expect(appendix1.sections.find((section) => section.id === 'introduction')?.content).toBe(
            'Gammal sammanfattning'
        );
        expect(appendix1.groupingTaxonomyId).toBe('wcag22-pour');
    });

    test('migrate_appendix1_sections_object_to_array sätter conceptId på results_*', () => {
        const legacy = get_default_appendix1_sections();
        const migrated = migrate_appendix1_sections_object_to_array(legacy);
        const perceivable = migrated.find((section) => section.id === 'results_perceivable');
        expect(perceivable?.kind).toBe('deficiency_group');
        expect(perceivable?.conceptId).toBe('perceivable');
    });

    test('normalize_section_definition accepterar array-fält', () => {
        const section = normalize_section_definition({
            id: 'custom',
            kind: 'content',
            headingLevel: 2,
            title: 'Rubrik',
            content: 'Text',
            format: 'list',
        });
        expect(section).toEqual({
            id: 'custom',
            kind: 'content',
            headingLevel: 2,
            title: 'Rubrik',
            content: 'Text',
            format: 'list',
        });
    });

    test('generate_deficiency_sections_from_taxonomy bygger sektioner från taxonomi', () => {
        const rule_file = {
            appendix1: { groupingTaxonomyId: 'wcag22-pour' },
            metadata: {
                taxonomies: [
                    {
                        id: 'wcag22-pour',
                        concepts: [
                            { id: 'perceivable', label: 'Uppfattningsbar' },
                            { id: 'operable', label: 'Hanterbar' },
                        ],
                    },
                ],
            },
        };
        const sections = generate_deficiency_sections_from_taxonomy(rule_file, (key) => key);
        const groups = sections.filter((section) => section.kind === 'deficiency_group');
        expect(groups.map((section) => section.conceptId)).toEqual(['perceivable', 'operable']);
        expect(sections.find((section) => section.id === 'introduction')).toBeTruthy();
    });
});
