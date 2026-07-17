/**
 * @fileoverview Enhetstester för Bilaga 1-visning i regelfilens rapportmall.
 */
import { describe, test, expect } from '@jest/globals';
import { render_appendix1_sections_view } from '../../js/components/rulefile_sections/rulefile_appendix1_sections_view_ui.ts';
import { get_default_appendix1_body_text } from '../../js/logic/appendix1_sections.ts';

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
            if (typeof opts.html_content === 'string') {
                el.innerHTML = opts.html_content;
            }
            const attrs = opts.attributes as Record<string, string> | undefined;
            if (attrs) {
                for (const [key, value] of Object.entries(attrs)) {
                    el.setAttribute(key, value);
                }
            }
            return el;
        },
        safe_set_inner_html: (el: HTMLElement, html: string) => {
            el.innerHTML = html;
        },
    };
}

const sample_rule_file = {
    appendix1: {
        groupingTaxonomyId: 'wcag22-pour',
        bodyText: get_default_appendix1_body_text(),
    },
    metadata: {
        taxonomies: [
            {
                id: 'wcag22-pour',
                label: 'WCAG 2.2 POUR',
                concepts: [
                    { id: 'perceivable', label: 'Uppfattningsbar' },
                    { id: 'operable', label: 'Hanterbar' },
                ],
            },
        ],
    },
};

describe('rulefile_appendix1_sections_view_ui', () => {
    test('visar h2-avsnitt i logisk ordning', () => {
        const container = document.createElement('div');

        render_appendix1_sections_view(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            sample_rule_file
        );

        const headings = Array.from(container.querySelectorAll('.appendix1-section-panel__heading')).map(
            (heading) => heading.textContent
        );

        expect(headings).toEqual([
            'rulefile_appendix1_body_text_heading',
            'rulefile_appendix1_taxonomy_groups_heading',
            'rulefile_appendix1_deficiency_intros_heading',
            'rulefile_appendix1_body_text_placeholders_heading',
        ]);
    });

    test('visar bristgruppsförhandsvisning och markdown-förhandsvisning', () => {
        const container = document.createElement('div');

        render_appendix1_sections_view(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            sample_rule_file
        );

        expect(container.querySelector('.appendix1-body-text-preview')).toBeTruthy();
        expect(container.querySelectorAll('.appendix1-deficiency-sections-preview__item').length).toBe(2);
        expect(container.querySelector('.appendix1-view-taxonomy-value')).toBeTruthy();
        expect(container.querySelector('.appendix1-editor-intro__placeholder-copy-btn')).toBeNull();
    });
});
