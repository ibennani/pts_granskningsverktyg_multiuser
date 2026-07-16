/**
 * @fileoverview Redigerings-UI för Bilaga 1-sektionslistan i regelfilen.
 */
import {
    generate_deficiency_sections_from_taxonomy,
    read_rulefile_appendix1_grouping_taxonomy_id,
    read_rulefile_appendix1_sections_list,
} from '../../logic/appendix1_sections.js';
import { resolve_taxonomies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import type { Appendix1SectionDefinition } from '../../logic/appendix1_sections_types.js';

type EditorCtx = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        init_auto_resize_for_textarea?: (el: HTMLTextAreaElement) => void;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
};

export function render_appendix1_sections_editor(
    ctx: EditorCtx,
    container: HTMLElement,
    rule_file_content: Record<string, unknown>,
    options: {
        on_change?: () => void;
        on_generate?: (sections: Appendix1SectionDefinition[]) => void;
    } = {}
): { get_sections: () => Appendix1SectionDefinition[]; get_grouping_taxonomy_id: () => string } {
    const { Helpers, Translation } = ctx;
    const t = Translation.t;
    container.innerHTML = '';

    let sections = read_rulefile_appendix1_sections_list(rule_file_content).map((section) => ({ ...section }));
    let grouping_taxonomy_id = read_rulefile_appendix1_grouping_taxonomy_id(rule_file_content);
    const taxonomies = resolve_taxonomies(rule_file_content.metadata as Record<string, unknown>) as Array<{
        id?: string;
        label?: string;
    }>;

    const intro = Helpers.create_element('p', {
        class_name: 'field-hint',
        text_content: t('rulefile_appendix1_sections_intro'),
    });
    container.appendChild(intro);

    const taxonomy_field = Helpers.create_element('div', { class_name: 'form-group' });
    const select_id = `appendix1-grouping-taxonomy-${Math.random().toString(36).slice(2, 8)}`;
    taxonomy_field.appendChild(
        Helpers.create_element('label', {
            attributes: { for: select_id },
            text_content: t('rulefile_appendix1_grouping_taxonomy_label'),
        })
    );
    const select = Helpers.create_element('select', {
        class_name: 'form-control',
        attributes: { id: select_id, name: 'appendix1GroupingTaxonomyId' },
    }) as HTMLSelectElement;
    taxonomies.forEach((taxonomy) => {
        const id = String(taxonomy.id ?? '').trim();
        if (!id) return;
        select.appendChild(
            Helpers.create_element('option', {
                attributes: { value: id },
                text_content: String(taxonomy.label ?? id),
            })
        );
    });
    select.value = grouping_taxonomy_id;
    select.addEventListener('change', () => {
        grouping_taxonomy_id = select.value.trim();
        options.on_change?.();
    });
    taxonomy_field.appendChild(select);
    container.appendChild(taxonomy_field);

    const sections_host = Helpers.create_element('div', { class_name: 'appendix1-sections-editor-list' });

    const render_section_cards = () => {
        sections_host.innerHTML = '';
        sections.forEach((section, index) => {
            const card = Helpers.create_element('article', { class_name: 'editable-card appendix1-section-card' });
            card.appendChild(
                Helpers.create_element('h3', {
                    text_content: section.title || section.id || t('rulefile_metadata_untitled_item'),
                })
            );
            const title_id = `appendix1-section-title-${index}`;
            const content_id = `appendix1-section-content-${index}`;
            const title_field = Helpers.create_element('div', { class_name: 'form-group' });
            title_field.appendChild(
                Helpers.create_element('label', {
                    attributes: { for: title_id },
                    text_content: t('rulefile_appendix1_section_title_label'),
                })
            );
            const title_input = Helpers.create_element('input', {
                class_name: 'form-control',
                attributes: { id: title_id, type: 'text' },
            }) as HTMLInputElement;
            title_input.value = section.title ?? '';
            title_input.addEventListener('input', () => {
                sections[index] = { ...sections[index], title: title_input.value };
                options.on_change?.();
            });
            title_field.appendChild(title_input);
            card.appendChild(title_field);

            const content_field = Helpers.create_element('div', { class_name: 'form-group' });
            content_field.appendChild(
                Helpers.create_element('label', {
                    attributes: { for: content_id },
                    text_content: t('rulefile_appendix1_section_content_label'),
                })
            );
            const content_input = Helpers.create_element('textarea', {
                class_name: 'form-control',
                attributes: { id: content_id, rows: '6' },
            }) as HTMLTextAreaElement;
            content_input.value = section.content ?? '';
            Helpers.init_auto_resize_for_textarea?.(content_input);
            content_input.addEventListener('input', () => {
                sections[index] = { ...sections[index], content: content_input.value };
                options.on_change?.();
            });
            content_field.appendChild(content_input);
            card.appendChild(content_field);

            if (section.kind === 'deficiency_group') {
                card.appendChild(
                    Helpers.create_element('p', {
                        class_name: 'field-hint',
                        text_content: t('rulefile_appendix1_section_deficiency_hint', {
                            concept: section.conceptId ?? '',
                        }),
                    })
                );
            }
            sections_host.appendChild(card);
        });
    };

    render_section_cards();
    container.appendChild(sections_host);

    const generate_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-secondary'],
        attributes: { type: 'button' },
        text_content: t('rulefile_appendix1_generate_sections_button'),
    });
    generate_btn.addEventListener('click', () => {
        const next_rule_file = {
            ...rule_file_content,
            appendix1: {
                ...(rule_file_content.appendix1 as Record<string, unknown> | undefined),
                groupingTaxonomyId: grouping_taxonomy_id,
            },
        };
        sections = generate_deficiency_sections_from_taxonomy(next_rule_file, t);
        render_section_cards();
        options.on_generate?.(sections);
        options.on_change?.();
    });
    container.appendChild(generate_btn);

    return {
        get_sections: () => sections.map((section) => ({ ...section })),
        get_grouping_taxonomy_id: () => grouping_taxonomy_id,
    };
}
