import {
    combine_content_sections_to_body_text,
    parse_body_text_to_content_sections,
    replace_introduction_in_body_text,
    sanitize_appendix1_body_text,
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
});
