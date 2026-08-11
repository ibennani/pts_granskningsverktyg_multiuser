/**
 * @fileoverview Läsvisning av Bilaga 1 taxonomirubriker (3.x) och inledningstexter.
 */
import type { DeficiencyTypeText } from '../export/export_deficiency_types_collect.js';
import type { Appendix1SectionDefinition } from '../logic/appendix1_sections_types.js';
import { render_markdown_to_html } from '../export/export_html_build_primitives.js';
import { append_deficiency_types_list_dom } from './appendix1_deficiency_list_render.js';

export type Appendix1DeficiencyIntrosViewDeps = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
};

export type Appendix1DeficiencyIntrosViewOptions = {
    deficiency_sections: Appendix1SectionDefinition[];
    deficiency_types_by_concept?: Map<string, DeficiencyTypeText[]>;
    hint_key?: string;
};

/**
 * Renderar bristgrupper (3.x) med rubrik och markdown-innehåll i visningsläge.
 */
export function render_appendix1_deficiency_sections_view(
    deps: Appendix1DeficiencyIntrosViewDeps,
    container: HTMLElement,
    options: Appendix1DeficiencyIntrosViewOptions
): void {
    const deficiency_sections = options.deficiency_sections.filter(
        (section) => section.kind === 'deficiency_group' && section.conceptId
    );
    if (deficiency_sections.length === 0) return;

    const { Helpers, Translation } = deps;
    const t = Translation.t;
    const types_by_concept = options.deficiency_types_by_concept ?? new Map();

    const panel = Helpers.create_element('section', {
        class_name: 'appendix1-deficiency-intros-panel appendix1-section-panel appendix1-deficiency-intros-view',
    });
    const heading_id = `appendix1-deficiency-intros-view-heading-${Math.random().toString(36).slice(2, 8)}`;
    panel.appendChild(
        Helpers.create_element('h2', {
            class_name: 'appendix1-section-panel__heading appendix1-deficiency-intros-panel__heading',
            attributes: { id: heading_id },
            text_content: t('rulefile_appendix1_deficiency_intros_heading'),
        })
    );
    panel.appendChild(
        Helpers.create_element('p', {
            class_name: 'field-hint appendix1-section-panel__hint appendix1-deficiency-intros-panel__hint',
            text_content: t(options.hint_key ?? 'rulefile_appendix1_deficiency_intros_hint'),
        })
    );

    container.appendChild(panel);

    const list = Helpers.create_element('div', {
        class_name: 'appendix1-deficiency-intros-list appendix1-deficiency-intros-view__list',
        attributes: { 'aria-labelledby': heading_id },
    });

    deficiency_sections.forEach((section, index) => {
        const concept_id = section.conceptId as string;
        const field = Helpers.create_element('article', {
            class_name: 'appendix1-deficiency-intro-field appendix1-deficiency-intro-view',
        });
        const heading_dom_id = `appendix1-deficiency-intro-view-${concept_id}-${index}`;
        const heading_tag = section.headingLevel === 2 ? 'h2' : 'h1';
        const heading_wrap = Helpers.create_element('div', {
            class_name: ['appendix1-deficiency-intro-view__heading-wrap', 'markdown-content'],
        });
        heading_wrap.appendChild(
            Helpers.create_element(heading_tag, {
                class_name: 'appendix1-deficiency-intro-view__heading',
                attributes: { id: heading_dom_id },
                text_content: section.title || concept_id,
            })
        );
        field.appendChild(heading_wrap);

        const content = typeof section.content === 'string' ? section.content : '';
        const preview = Helpers.create_element('div', {
            class_name: ['appendix1-deficiency-intro-view__content', 'markdown-content'],
            attributes: { 'aria-labelledby': heading_dom_id },
        });
        const html = render_markdown_to_html(content);
        if (html.trim()) {
            preview.innerHTML = html;
        } else {
            preview.appendChild(
                Helpers.create_element('p', {
                    class_name: 'markdown-preview-editor__empty',
                    text_content: t('markdown_preview_editor_empty'),
                })
            );
        }
        field.appendChild(preview);

        const deficiency_types = types_by_concept.get(concept_id) ?? [];
        append_deficiency_types_list_dom(Helpers, field, deficiency_types);

        list.appendChild(field);
    });

    container.appendChild(list);
}
