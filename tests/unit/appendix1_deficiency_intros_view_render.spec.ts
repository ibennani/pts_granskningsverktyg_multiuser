/**
 * Enhetstester för Bilaga 1 visningsläge (3.x + bristtypslistor).
 */
import { describe, test, expect } from '@jest/globals';
import { render_appendix1_deficiency_sections_view } from '../../js/utils/appendix1_deficiency_intros_view_render.ts';

function create_helpers() {
    return {
        create_element: (tag: string, opts: Record<string, unknown> = {}) => {
            const el = document.createElement(tag);
            const class_name = opts.class_name;
            if (typeof class_name === 'string') {
                el.className = class_name;
            } else if (Array.isArray(class_name)) {
                el.className = class_name.join(' ');
            }
            if (typeof opts.text_content === 'string') {
                el.textContent = opts.text_content;
            }
            const attrs = opts.attributes as Record<string, string> | undefined;
            if (attrs) {
                for (const [key, value] of Object.entries(attrs)) {
                    el.setAttribute(key, value);
                }
            }
            return el;
        },
    };
}

describe('appendix1_deficiency_intros_view_render', () => {
    test('renderar rubriker, markdown och numrerad bristtypslista', () => {
        const container = document.createElement('div');
        const types_by_concept = new Map([
            [
                'perceivable',
                [{ primary: 'Primär brist', secondary: 'Sekundär förklaring.' }],
            ],
        ]);

        render_appendix1_deficiency_sections_view(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            {
                deficiency_sections: [
                    {
                        id: 'results_perceivable',
                        kind: 'deficiency_group',
                        headingLevel: 2,
                        conceptId: 'perceivable',
                        title: '3.1 Uppfattningsbar',
                        content: 'Inledning med **markdown**.',
                    },
                ],
                deficiency_types_by_concept: types_by_concept,
                hint_key: 'audit_appendix1_deficiency_intros_hint',
            }
        );

        expect(container.querySelector('.appendix1-deficiency-intros-view')).toBeTruthy();
        const panel = container.querySelector('.appendix1-deficiency-intros-view');
        const list = container.querySelector('.appendix1-deficiency-intros-view__list');
        expect(panel?.contains(list as Node)).toBe(false);
        expect(
            container.querySelector('.appendix1-deficiency-intro-view__heading')?.textContent
        ).toBe('3.1 Uppfattningsbar');
        expect(container.querySelector('.markdown-content strong')?.textContent).toBe('markdown');
        const strong = container.querySelector('.appendix1-deficiency-list li strong');
        expect(strong?.textContent).toBe('Primär brist');
        expect(container.querySelector('.appendix1-deficiency-list li')?.textContent).toBe(
            'Primär brist Sekundär förklaring.'
        );
        expect(
            container.querySelector('.appendix1-deficiency-intros-panel__hint')?.textContent
        ).toBe('audit_appendix1_deficiency_intros_hint');
    });

    test('visar ingen bristtypslista när concept saknar typer', () => {
        const container = document.createElement('div');
        render_appendix1_deficiency_sections_view(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            {
                deficiency_sections: [
                    {
                        id: 'results_operable',
                        kind: 'deficiency_group',
                        headingLevel: 2,
                        conceptId: 'operable',
                        title: '3.2 Hanterbar',
                        content: 'Tom granskning.',
                    },
                ],
                deficiency_types_by_concept: new Map(),
            }
        );

        expect(container.querySelector('.appendix1-deficiency-list')).toBeNull();
        expect(container.querySelector('.appendix1-deficiency-intro-view')).toBeTruthy();
    });
});
