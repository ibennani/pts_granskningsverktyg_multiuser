import {
    apply_appendix1_placeholders,
    build_appendix1_placeholder_context,
    build_rulefile_appendix1_persisted_sections,
    dedupe_appendix1_sections_by_id,
    format_appendix1_placeholder_token,
    generate_deficiency_sections_from_taxonomy,
    get_default_appendix1_sections,
    get_default_appendix1_sections_list,
    get_default_appendix1_body_text,
    migrate_appendix1_sections_object_to_array,
    normalize_rulefile_appendix1,
    normalize_section_definition,
    parse_body_text_to_content_sections,
    read_rulefile_appendix1_body_text,
    read_rulefile_appendix1_body_text_by_taxonomy,
    read_rulefile_appendix1_sections,
    read_rulefile_appendix1_sections_list,
    resolve_appendix1_body_text,
    resolve_appendix1_sections,
    resolve_appendix1_sections_list,
    strip_leading_duplicate_appendix1_heading,
} from '../../js/logic/appendix1_sections.ts';
import { build_appendix1_pdf_print_css } from '../../js/export/export_report_appendix1_print_css.ts';

describe('appendix1_print_css', () => {
    test('PDF print-CSS har sidnummer i innehållsförteckning och helsidesomslag', () => {
        const css = build_appendix1_pdf_print_css();
        expect(css).toContain('.appendix1-toc__page');
        expect(css).not.toContain('target-counter');
        expect(css).toMatch(/height:\s*297mm/);
        expect(css).toContain('object-fit: cover');
        expect(css).toContain('@page :first');
    });
});

describe('appendix1_sections', () => {
    test('read_rulefile_appendix1_body_text migrerar legacy-sektioner', () => {
        const sections = get_default_appendix1_sections_list();
        const body_text = read_rulefile_appendix1_body_text({ appendix1: { sections } });
        expect(body_text).toContain('# 1. Inledning');
        expect(body_text).toContain('{{actorName}}');
    });

    test('get_default_appendix1_body_text innehåller kapitel 1 till 3 intro', () => {
        const body_text = get_default_appendix1_body_text();
        expect(body_text).toContain('# 1. Inledning');
        expect(body_text).toContain('# 2. Metod');
        expect(body_text).toContain('# 3. Sammanfattning av granskningsresultatet');
    });

    test('normalize_rulefile_appendix1 skapar bodyText och sparar bara bristgrupper', () => {
        const normalized = normalize_rulefile_appendix1({
            appendix1: { sections: get_default_appendix1_sections_list() },
        });
        const appendix1 = normalized.appendix1 as {
            bodyText: string;
            sections: Array<{ id: string; kind?: string; content?: string }>;
        };
        expect(typeof appendix1.bodyText).toBe('string');
        expect(appendix1.bodyText).toContain('# 1. Inledning');
        expect(appendix1.sections.every((section) => section.kind === 'deficiency_group')).toBe(true);
        expect(appendix1.sections.every((section) => !section.content?.trim())).toBe(true);
        expect(appendix1.sections.find((section) => section.id === 'introduction')).toBeUndefined();
    });

    test('resolve_appendix1_body_text prioriterar granskningstext för inledning', () => {
        const audit = {
            auditMetadata: { appendix1SummaryText: 'Granskningsspecifik inledning' },
            ruleFileContent: {
                appendix1: {
                    bodyText: get_default_appendix1_body_text(),
                },
            },
        };
        const body_text = resolve_appendix1_body_text(audit);
        const introduction = parse_body_text_to_content_sections(
            body_text,
            get_default_appendix1_sections_list()
        ).find((section) => section.id === 'introduction');
        expect(introduction?.content).toBe('Granskningsspecifik inledning');
    });

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

    test('format_appendix1_placeholder_token bygger token i exportformat', () => {
        expect(format_appendix1_placeholder_token('caseNumber')).toBe('{{caseNumber}}');
        expect(format_appendix1_placeholder_token(' actorName ')).toBe('{{actorName}}');
    });

    test('build_appendix1_placeholder_context använder beräknad sluttid för låst granskning', () => {
        const context = build_appendix1_placeholder_context({
            auditStatus: 'locked',
            auditMetadata: { actorName: 'Test AB' },
            samples: [{
                id: 's1',
                requirementResults: {
                    r1: { lastStatusUpdate: '2024-06-15T12:00:00.000Z', checkResults: {} },
                },
            }],
        });
        expect(context.endDate).toMatch(/2024/);
    });

    test('strip_leading_duplicate_appendix1_heading tar bort markdown-rubrik som matchar titel', () => {
        const stripped = strip_leading_duplicate_appendix1_heading(
            '## 1. Inledning\n\nBrödtext här.',
            '1. Inledning'
        );
        expect(stripped).toBe('Brödtext här.');
    });

    test('strip_leading_duplicate_appendix1_heading tar bort plain text-rad som matchar titel', () => {
        const stripped = strip_leading_duplicate_appendix1_heading(
            '1. Inledning\n\nBrödtext här.',
            '1. Inledning'
        );
        expect(stripped).toBe('Brödtext här.');
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

    test('normalize_rulefile_appendix1 migrerar summaryText till bodyText', () => {
        const normalized = normalize_rulefile_appendix1({
            appendix1: { summaryText: 'Gammal sammanfattning' },
        });
        const appendix1 = normalized.appendix1 as {
            bodyText: string;
            sections: Array<{ id: string; content: string }>;
            groupingTaxonomyId: string;
        };
        expect(typeof appendix1.bodyText).toBe('string');
        expect(appendix1.bodyText).toContain('Gammal sammanfattning');
        expect(appendix1.sections.find((section) => section.id === 'introduction')).toBeUndefined();
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

    test('generate_deficiency_sections_from_taxonomy returnerar bara bristgrupper', () => {
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
        expect(sections.find((section) => section.id === 'introduction')).toBeUndefined();
    });

    test('dedupe_appendix1_sections_by_id tar bort upprepade id:n i ordning', () => {
        const defaults = get_default_appendix1_sections_list();
        const duplicate_block = defaults.filter((section) =>
            ['method', 'method_legal', 'method_scope', 'method_approach', 'results_intro'].includes(section.id)
        );
        const doubled = [...defaults, ...duplicate_block];
        const deduped = dedupe_appendix1_sections_by_id(doubled);
        expect(deduped).toHaveLength(defaults.length);
        expect(deduped.filter((section) => section.id === 'method')).toHaveLength(1);
    });

    test('resolve_appendix1_sections_list avdubblerar sparad sektionslista med dubbletter', () => {
        const defaults = get_default_appendix1_sections_list();
        const duplicate_block = defaults.filter((section) =>
            ['method', 'method_legal', 'method_scope', 'method_approach', 'results_intro'].includes(section.id)
        );
        const audit = {
            auditMetadata: { appendix1SectionOverrides: {} },
            ruleFileContent: {
                appendix1: {
                    sections: [...defaults, ...duplicate_block],
                },
            },
        };
        const resolved = resolve_appendix1_sections_list(audit);
        expect(resolved.filter((section) => section.id === 'method')).toHaveLength(1);
        expect(resolved.filter((section) => section.id === 'results_intro')).toHaveLength(1);
        expect(resolved).toHaveLength(defaults.length);
    });

    test('generate_deficiency_sections_from_taxonomy returnerar inga innehållssektioner', () => {
        const defaults = get_default_appendix1_sections_list();
        const duplicate_block = defaults.filter((section) =>
            ['method', 'method_legal', 'method_scope', 'method_approach', 'results_intro'].includes(section.id)
        );
        const corrupt = [...defaults, ...duplicate_block];
        const rule_file = {
            appendix1: { groupingTaxonomyId: 'wcag22-pour', sections: corrupt },
            metadata: {
                taxonomies: [
                    {
                        id: 'wcag22-pour',
                        concepts: [{ id: 'perceivable', label: 'Uppfattningsbar' }],
                    },
                ],
            },
        };
        const sections = generate_deficiency_sections_from_taxonomy(rule_file, (key) => key);
        expect(sections.every((section) => section.kind === 'deficiency_group')).toBe(true);
        expect(sections.filter((section) => section.id === 'method')).toHaveLength(0);
        expect(sections.filter((section) => section.id === 'results_intro')).toHaveLength(0);
    });

    test('build_rulefile_appendix1_persisted_sections behåller brödtext och bristgrupper', () => {
        const body_text = get_default_appendix1_body_text();
        const deficiency_sections = generate_deficiency_sections_from_taxonomy(
            {
                appendix1: { groupingTaxonomyId: 'wcag22-pour' },
                metadata: {
                    taxonomies: [
                        {
                            id: 'wcag22-pour',
                            concepts: [{ id: 'perceivable', label: 'Uppfattningsbar' }],
                        },
                    ],
                },
            },
            (key) => key
        );
        const persisted = build_rulefile_appendix1_persisted_sections(body_text, deficiency_sections);
        expect(persisted.find((section) => section.id === 'introduction')).toBeDefined();
        expect(persisted.filter((section) => section.kind === 'deficiency_group')).toHaveLength(1);
    });

    test('read_rulefile_appendix1_body_text använder bodyTextByTaxonomy för aktiv taxonomi', () => {
        const wcag_text = '# 1. Inledning\n\nWCAG-text.';
        const other_text = '# 1. Inledning\n\nAnnan taxonomi.';
        const body_text = read_rulefile_appendix1_body_text({
            appendix1: {
                groupingTaxonomyId: 'other-taxonomy',
                bodyText: wcag_text,
                bodyTextByTaxonomy: {
                    'wcag22-pour': wcag_text,
                    'other-taxonomy': other_text,
                },
            },
        });
        expect(body_text).toBe(other_text);
    });

    test('normalize_rulefile_appendix1 migrerar bodyText till bodyTextByTaxonomy', () => {
        const normalized = normalize_rulefile_appendix1({
            appendix1: {
                groupingTaxonomyId: 'wcag22-pour',
                bodyText: get_default_appendix1_body_text(),
            },
        });
        const appendix1 = normalized.appendix1 as {
            bodyText: string;
            bodyTextByTaxonomy: Record<string, string>;
        };
        expect(appendix1.bodyTextByTaxonomy['wcag22-pour']).toBe(appendix1.bodyText);
        expect(appendix1.bodyText).toContain('# 1. Inledning');
        expect(appendix1.bodyText.match(/# 1\. Inledning/g)).toHaveLength(1);
    });

    test('read_rulefile_appendix1_body_text_by_taxonomy fyller saknade taxonomier med fallback', () => {
        const by_taxonomy = read_rulefile_appendix1_body_text_by_taxonomy(
            {
                appendix1: {
                    groupingTaxonomyId: 'wcag22-pour',
                    bodyText: '# 1. Inledning\n\nGemensam text.',
                },
            },
            ['wcag22-pour', 'other-taxonomy']
        );
        expect(by_taxonomy['wcag22-pour']).toContain('Gemensam text.');
        expect(by_taxonomy['other-taxonomy']).toContain('Gemensam text.');
    });
});
