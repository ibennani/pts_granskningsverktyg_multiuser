/**
 * @fileoverview Redigerbara Bilaga 1-inledningar per princip i regelfilens Bilaga 1-editor.
 */
import { read_concept_appendix1_intro } from '../../logic/appendix1_principle_intro.js';
import type { Appendix1SectionDefinition } from '../../logic/appendix1_sections_types.js';

type DeficiencyIntroEditorCtx = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        init_auto_resize_for_textarea?: (el: HTMLTextAreaElement) => void;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
};

export function render_deficiency_intro_editor(
    ctx: DeficiencyIntroEditorCtx,
    container: HTMLElement,
    options: {
        rule_file_content: Record<string, unknown>;
        grouping_taxonomy_id: string;
        deficiency_sections: Appendix1SectionDefinition[];
        on_change?: () => void;
        initial_concept_intros?: Record<string, string>;
        hint_key?: string;
    }
): {
    get_concept_intros: () => Record<string, string>;
    refresh: (sections: Appendix1SectionDefinition[]) => void;
} {
    const { Helpers, Translation } = ctx;
    const t = Translation.t;
    const concept_intros = new Map<string, string>();

    const sync_from_sections = (sections: Appendix1SectionDefinition[]) => {
        for (const section of sections) {
            if (section.kind !== 'deficiency_group' || !section.conceptId) continue;
            if (!concept_intros.has(section.conceptId)) {
                const from_initial = options.initial_concept_intros?.[section.conceptId];
                concept_intros.set(
                    section.conceptId,
                    typeof from_initial === 'string'
                        ? from_initial
                        : section.content
                        || read_concept_appendix1_intro(
                            options.rule_file_content.metadata,
                            options.grouping_taxonomy_id,
                            section.conceptId
                        )
                );
            }
        }
    };

    sync_from_sections(options.deficiency_sections);

    const panel = Helpers.create_element('section', {
        class_name: 'appendix1-deficiency-intros-panel appendix1-section-panel',
    });
    const heading_id = `appendix1-deficiency-intros-heading-${Math.random().toString(36).slice(2, 8)}`;
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
            text_content: t(
                options.hint_key ?? 'rulefile_appendix1_deficiency_intros_hint'
            ),
        })
    );

    container.appendChild(panel);

    const list = Helpers.create_element('div', {
        class_name: 'appendix1-deficiency-intros-list',
        attributes: { 'aria-labelledby': heading_id },
    });
    container.appendChild(list);

    const render_rows = (sections: Appendix1SectionDefinition[]) => {
        list.innerHTML = '';
        sections.forEach((section, index) => {
            if (section.kind !== 'deficiency_group' || !section.conceptId) return;
            const concept_id = section.conceptId;
            const field = Helpers.create_element('div', {
                class_name: 'form-group appendix1-deficiency-intro-field',
            });
            const textarea_id = `appendix1-deficiency-intro-${concept_id}-${index}`;
            field.appendChild(
                Helpers.create_element('label', {
                    attributes: { for: textarea_id },
                    text_content: t('rulefile_appendix1_deficiency_intro_label', {
                        title: section.title || concept_id,
                    }),
                })
            );
            const textarea = Helpers.create_element('textarea', {
                class_name: 'form-control appendix1-deficiency-intro-textarea',
                attributes: { id: textarea_id, rows: '6', name: `appendix1Intro-${concept_id}` },
            }) as HTMLTextAreaElement;
            textarea.value = concept_intros.get(concept_id) ?? '';
            textarea.addEventListener('input', () => {
                concept_intros.set(concept_id, textarea.value);
                options.on_change?.();
            });
            Helpers.init_auto_resize_for_textarea?.(textarea);
            field.appendChild(textarea);
            list.appendChild(field);
        });
    };

    render_rows(options.deficiency_sections);

    return {
        get_concept_intros: () => {
            const result: Record<string, string> = {};
            concept_intros.forEach((value, concept_id) => {
                result[concept_id] = value;
            });
            return result;
        },
        refresh: (sections: Appendix1SectionDefinition[]) => {
            sync_from_sections(sections);
            render_rows(sections);
        },
    };
}
