/**
 * @fileoverview Bilaga 1-inledning per princip i taxonomiredigeraren.
 */
import type { TaxonomyEntryPersist } from '../../logic/taxonomy_persist.js';
import type { TaxonomyEditorCtx } from './rulefile_taxonomy_editor_ui.js';

type ConceptEntry = { id?: string; label?: string; appendix1Intro?: string };

function create_intro_textarea(
    ctx: TaxonomyEditorCtx,
    label_text: string,
    textarea_id: string,
    value: string,
    on_input: (value: string) => void
): HTMLElement {
    const { Helpers } = ctx;
    const field = Helpers.create_element('div', {
        class_name: 'form-group taxonomy-editor-principle-intro-field',
    });
    field.appendChild(
        Helpers.create_element('label', {
            attributes: { for: textarea_id },
            text_content: label_text,
        })
    );
    const textarea = Helpers.create_element('textarea', {
        class_name: 'form-control taxonomy-editor-principle-intro-textarea',
        attributes: { id: textarea_id, rows: '6', name: 'taxonomy-principle-appendix1-intro' },
    }) as HTMLTextAreaElement;
    textarea.value = value;
    textarea.addEventListener('input', () => on_input(textarea.value));
    Helpers.init_auto_resize_for_textarea?.(textarea);
    field.appendChild(textarea);
    return field;
}

export function append_principle_intro_field(
    ctx: TaxonomyEditorCtx,
    row_body: HTMLElement,
    concept: ConceptEntry,
    concept_index: number,
    on_change?: () => void
): void {
    const { Translation: { t } } = ctx;
    const intro_id = `taxonomy-principle-intro-${concept_index}-${Math.random().toString(36).slice(2, 8)}`;
    row_body.appendChild(
        create_intro_textarea(
            ctx,
            t('rulefile_classifications_taxonomy_principle_intro_label', {
                number: concept_index + 1,
            }),
            intro_id,
            concept.appendix1Intro ?? '',
            (value) => {
                concept.appendix1Intro = value;
                on_change?.();
            }
        )
    );
}

export function build_principle_intro_hint(
    ctx: TaxonomyEditorCtx,
    section: HTMLElement
): void {
    const { Helpers, Translation: { t } } = ctx;
    section.appendChild(
        Helpers.create_element('p', {
            class_name: 'field-hint taxonomy-editor-principles-intro-hint',
            text_content: t('rulefile_classifications_taxonomy_principle_intro_hint'),
        })
    );
}
