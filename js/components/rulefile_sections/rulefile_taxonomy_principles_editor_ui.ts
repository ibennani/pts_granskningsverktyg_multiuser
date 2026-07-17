/**
 * @fileoverview Principlista i taxonomiredigeraren (Klassificeringar).
 */
import { show_confirm_delete_modal } from '../../logic/confirm_delete_modal_logic.js';
import type { TaxonomyEntryPersist } from '../../logic/taxonomy_persist.js';
import type { TaxonomyEditorCtx } from './rulefile_taxonomy_editor_ui.js';
import { append_principle_intro_field, build_principle_intro_hint } from './rulefile_taxonomy_principle_intro_ui.js';

type ConceptEntry = { id?: string; label?: string; appendix1Intro?: string };

function create_principle_input(
    ctx: TaxonomyEditorCtx,
    label_text: string,
    input_id: string,
    value: string,
    on_input: (value: string) => void
): HTMLElement {
    const { Helpers } = ctx;
    const field = Helpers.create_element('div', {
        class_name: 'form-group taxonomy-editor-principle-field',
    });
    field.appendChild(
        Helpers.create_element('label', {
            attributes: { for: input_id },
            text_content: label_text,
        })
    );
    const input = Helpers.create_element('input', {
        class_name: 'form-control',
        attributes: { id: input_id, type: 'text', name: 'taxonomy-principle-label' },
    }) as HTMLInputElement;
    input.value = value;
    input.addEventListener('input', () => on_input(input.value));
    field.appendChild(input);
    return field;
}

function confirm_remove_concept(
    ctx: TaxonomyEditorCtx,
    concept_label: string,
    delete_button: HTMLButtonElement,
    on_confirm: () => void
): void {
    const { Translation: { t } } = ctx;
    show_confirm_delete_modal({
        h1_text: t('confirm_delete_modal_title'),
        warning_text: t('rulefile_classifications_taxonomy_remove_principle_confirm', {
            name: concept_label,
        }),
        delete_button,
        on_confirm,
    });
}

function build_remove_principle_button(
    ctx: TaxonomyEditorCtx,
    concept: ConceptEntry,
    on_remove: () => void
): HTMLButtonElement {
    const { Helpers, Translation: { t } } = ctx;
    const remove_label = t('rulefile_classifications_taxonomy_remove_principle', {
        name: concept.label || t('rulefile_metadata_untitled_item'),
    });
    const remove_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-danger', 'button-small', 'taxonomy-editor-remove-principle'],
        attributes: { type: 'button', 'aria-label': remove_label },
        text_content: remove_label,
    }) as HTMLButtonElement;
    remove_btn.addEventListener('click', () => {
        const concept_name = concept.label || t('rulefile_metadata_untitled_item');
        confirm_remove_concept(ctx, concept_name, remove_btn, on_remove);
    });
    return remove_btn;
}

function build_add_principle_button(
    ctx: TaxonomyEditorCtx,
    on_add: () => void
): HTMLButtonElement {
    const { Helpers, Translation: { t } } = ctx;
    const add_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'taxonomy-editor-add-principle-button'],
        attributes: { type: 'button' },
        text_content: t('rulefile_classifications_taxonomy_add_principle'),
    }) as HTMLButtonElement;
    add_btn.addEventListener('click', on_add);
    return add_btn;
}

function build_principle_row(
    ctx: TaxonomyEditorCtx,
    concept: ConceptEntry,
    concept_index: number,
    on_input: (value: string) => void,
    on_remove: () => void,
    on_change?: () => void
): HTMLElement {
    const { Helpers, Translation: { t } } = ctx;
    const row = Helpers.create_element('article', { class_name: 'taxonomy-editor-principle-row' });
    const input_id = `taxonomy-principle-${concept_index}-${Math.random().toString(36).slice(2, 8)}`;
    const label_text = t('rulefile_classifications_taxonomy_principle_field_label', {
        number: concept_index + 1,
    });

    const body = Helpers.create_element('div', { class_name: 'taxonomy-editor-principle-row__body' });
    body.appendChild(create_principle_input(ctx, label_text, input_id, concept.label ?? '', on_input));
    append_principle_intro_field(ctx, body, concept, concept_index, on_change);
    row.appendChild(body);

    const actions = Helpers.create_element('div', {
        class_name: 'taxonomy-editor-principle-row__actions',
    });
    actions.appendChild(build_remove_principle_button(ctx, concept, on_remove));
    row.appendChild(actions);
    return row;
}

function focus_last_principle_input(list_host: HTMLElement): void {
    requestAnimationFrame(() => {
        const inputs = list_host.querySelectorAll('.taxonomy-editor-principle-field input');
        const last_input = inputs[inputs.length - 1] as HTMLInputElement | undefined;
        last_input?.focus();
    });
}

function render_principles_list(
    ctx: TaxonomyEditorCtx,
    list_host: HTMLElement,
    entry: TaxonomyEntryPersist,
    rerender: () => void,
    on_change?: () => void,
    on_add?: () => void
): void {
    const { Helpers, Translation: { t } } = ctx;
    list_host.innerHTML = '';
    entry.concepts = Array.isArray(entry.concepts) ? entry.concepts : [];

    if (entry.concepts.length === 0) {
        const empty = Helpers.create_element('div', { class_name: 'taxonomy-editor-principles-empty' });
        empty.appendChild(
            Helpers.create_element('p', {
                class_name: 'metadata-empty taxonomy-editor-principles-empty-text',
                text_content: t('rulefile_classifications_taxonomy_principles_empty'),
            })
        );
        empty.appendChild(build_add_principle_button(ctx, on_add ?? (() => {})));
        list_host.appendChild(empty);
        return;
    }

    entry.concepts.forEach((concept, concept_index) => {
        list_host.appendChild(
            build_principle_row(
                ctx,
                concept,
                concept_index,
                (value) => {
                    concept.label = value;
                    on_change?.();
                },
                () => {
                    entry.concepts!.splice(concept_index, 1);
                    rerender();
                    on_change?.();
                },
                on_change
            )
        );
    });
}

export function build_principles_section(
    ctx: TaxonomyEditorCtx,
    entry: TaxonomyEntryPersist,
    on_change?: () => void
): HTMLElement {
    const { Helpers, Translation: { t } } = ctx;
    const section = Helpers.create_element('section', {
        class_name: 'taxonomy-editor-principles-section',
    });
    section.appendChild(
        Helpers.create_element('h2', {
            class_name: 'taxonomy-editor-principles-heading',
            text_content: t('rulefile_classifications_taxonomy_principles_heading'),
        })
    );
    section.appendChild(
        Helpers.create_element('p', {
            class_name: 'field-hint taxonomy-editor-principles-hint',
            text_content: t('rulefile_classifications_taxonomy_principles_edit_hint'),
        })
    );
    build_principle_intro_hint(ctx, section);

    const panel = Helpers.create_element('div', { class_name: 'taxonomy-editor-principles-panel' });
    const scroll_wrapper = Helpers.create_element('div', {
        class_name: 'taxonomy-editor-principles-scroll-wrapper',
    });
    const principles_host = Helpers.create_element('div', {
        class_name: 'taxonomy-editor-principles',
    });
    scroll_wrapper.appendChild(principles_host);
    panel.appendChild(scroll_wrapper);

    const actions_host = Helpers.create_element('div', {
        class_name: 'taxonomy-editor-principles-actions',
    });
    panel.appendChild(actions_host);

    const rerender_principles = () => {
        render_principles_list(ctx, principles_host, entry, rerender_principles, on_change, add_principle);
        actions_host.replaceChildren();
        if ((entry.concepts?.length ?? 0) > 0) {
            actions_host.appendChild(build_add_principle_button(ctx, add_principle));
        }
    };

    const add_principle = () => {
        entry.concepts!.push({ id: '', label: '' });
        rerender_principles();
        on_change?.();
        focus_last_principle_input(principles_host);
    };

    rerender_principles();
    section.appendChild(panel);
    return section;
}
