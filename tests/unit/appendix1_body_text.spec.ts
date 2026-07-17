import {
    combine_content_sections_to_body_text,
    parse_body_text_to_content_sections,
    read_appendix1_body_text_by_taxonomy_from_appendix1,
    read_appendix1_body_text_from_appendix1,
    replace_introduction_in_body_text,
    sanitize_appendix1_body_text,
    taxonomy_uses_legacy_appendix1_body_text_fallback,
} from '../../js/logic/appendix1_body_text.ts';
import { get_default_appendix1_sections_list } from '../../js/logic/appendix1_sections.ts';

describe('appendix1_body_text', () => {
    test('combine_content_sections_to_body_text bygger markdown med rubriker', () => {
        const combined = combine_content_sections_to_body_text([
            {
                id: 'introduction',
                kind: 'content',
                headingLevel: 1,
                title: '1. Inledning',
                content: 'Introtext.',
            },
            {
                id: 'method_legal',
                kind: 'content',
                headingLevel: 2,
                title: '2.1 Lagkrav',
                content: 'Lagtext.',
            },
        ]);
        expect(combined).toContain('# 1. Inledning');
        expect(combined).toContain('Introtext.');
        expect(combined).toContain('## 2.1 Lagkrav');
        expect(combined).toContain('Lagtext.');
    });

    test('parse_body_text_to_content_sections tolkar markdown-rubriker', () => {
        const body_text = '# 1. Inledning\n\nIntro.\n\n## 2.1 Lagkrav\n\nLag.';
        const sections = parse_body_text_to_content_sections(
            body_text,
            get_default_appendix1_sections_list()
        );
        expect(sections).toHaveLength(2);
        expect(sections[0].id).toBe('introduction');
        expect(sections[0].content).toBe('Intro.');
        expect(sections[1].id).toBe('method_legal');
    });

    test('replace_introduction_in_body_text ersätter inledning', () => {
        const defaults = get_default_appendix1_sections_list();
        const body_text = combine_content_sections_to_body_text(
            defaults.filter((section) => section.kind !== 'deficiency_group')
        );
        const updated = replace_introduction_in_body_text(body_text, 'Ny inledning.', defaults);
        const introduction = parse_body_text_to_content_sections(updated, defaults).find(
            (section) => section.id === 'introduction'
        );
        expect(introduction?.content).toBe('Ny inledning.');
        expect(updated).toContain('# 2. Metod');
    });

    test('sanitize_appendix1_body_text tar bort dubblettrubrik i inledning', () => {
        const defaults = get_default_appendix1_sections_list();
        const dirty = '# 1. Inledning\n\n# 1. Inledning\n\nBrödtext.';
        const cleaned = sanitize_appendix1_body_text(dirty, defaults);
        expect(cleaned).toBe('# 1. Inledning\n\nBrödtext.');
        expect(cleaned.match(/# 1\. Inledning/g)).toHaveLength(1);
    });

    test('read_appendix1_body_text_from_appendix1 returnerar tom sträng för icke-WCAG utan sparad post', () => {
        const body_text = read_appendix1_body_text_from_appendix1(
            {
                groupingTaxonomyId: 'wcag22-pour',
                bodyText: '# 1. Inledning\n\nWCAG-text.',
            },
            'Standard',
            [],
            'fptt-bilaga-2'
        );
        expect(body_text).toBe('');
    });

    test('read_appendix1_body_text_by_taxonomy_from_appendix1 fyller bara WCAG med fallback', () => {
        const by_taxonomy = read_appendix1_body_text_by_taxonomy_from_appendix1(
            {
                groupingTaxonomyId: 'wcag22-pour',
                bodyText: '# 1. Inledning\n\nWCAG-text.',
            },
            'Standard',
            [],
            ['wcag22-pour', 'fptt-bilaga-2']
        );
        expect(by_taxonomy['wcag22-pour']).toContain('WCAG-text.');
        expect(by_taxonomy['fptt-bilaga-2']).toBeUndefined();
    });

    test('taxonomy_uses_legacy_appendix1_body_text_fallback gäller endast wcag22-pour', () => {
        expect(taxonomy_uses_legacy_appendix1_body_text_fallback('wcag22-pour')).toBe(true);
        expect(taxonomy_uses_legacy_appendix1_body_text_fallback('fptt-bilaga-2')).toBe(false);
    });
});
