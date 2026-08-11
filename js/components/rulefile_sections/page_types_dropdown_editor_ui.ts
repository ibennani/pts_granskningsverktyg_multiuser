/**
 * @file UI för redigering av sidtypslistor (dropdown) per sampleCategory.
 */

import {
    read_page_types_dropdown_state,
    type PageTypesDropdownReadState,
} from '../../../shared/rulefile/page_types_dropdown_sync.js';

export const PAGE_TYPES_WEBBSIDA_TEXTAREA_NAME = 'pageTypesWebbsida';
export const PAGE_TYPES_ATERKOMMANDE_TEXTAREA_NAME = 'pageTypesAterkommande';

type EditorHelpers = {
    create_element: (
        tag: string,
        options?: {
            class_name?: string | string[];
            attributes?: Record<string, string>;
            text_content?: string;
            html_content?: string;
            children?: HTMLElement[];
        }
    ) => HTMLElement;
    init_auto_resize_for_textarea?: (el: HTMLTextAreaElement) => void;
    escape_html?: (value: string) => string;
    build_save_button_html_content?: (label: string) => string;
};

type EditorTranslation = {
    t: (key: string, opts?: Record<string, string>) => string;
};

export type PageTypesDropdownEditorResult = {
    form: HTMLFormElement;
    webbsida_textarea: HTMLTextAreaElement | null;
    aterkommande_textarea: HTMLTextAreaElement | null;
    read_state: PageTypesDropdownReadState;
};

type CreatePageTypesDropdownEditorOptions = {
    metadata: Record<string, unknown>;
    Helpers: EditorHelpers;
    Translation: EditorTranslation;
    on_input: () => void;
    on_save: () => void | Promise<void>;
    on_cancel: () => void;
};

function create_textarea_section(
    Helpers: EditorHelpers,
    options: {
        section_id: string;
        label_key: string;
        hint_key: string;
        textarea_name: string;
        heading_text: string;
        initial_value: string;
        on_input: () => void;
        t: (key: string) => string;
    }
): HTMLElement {
    const section = Helpers.create_element('section', {
        class_name: 'form-section page-types-dropdown-section',
        attributes: { 'data-section-id': options.section_id },
    });

    const heading = Helpers.create_element('h2', {
        class_name: 'page-types-dropdown-section-heading',
        text_content: options.heading_text,
    });

    const label = Helpers.create_element('label', {
        attributes: { for: `${options.textarea_name}-textarea` },
        text_content: options.t(options.label_key),
    });

    const hint = Helpers.create_element('p', {
        class_name: 'field-hint',
        text_content: options.t(options.hint_key),
    });

    const textarea = Helpers.create_element('textarea', {
        class_name: 'form-control',
        attributes: {
            id: `${options.textarea_name}-textarea`,
            name: options.textarea_name,
            rows: '6',
        },
    }) as HTMLTextAreaElement;
    textarea.value = options.initial_value;
    textarea.addEventListener('input', options.on_input);
    Helpers.init_auto_resize_for_textarea?.(textarea);

    section.appendChild(heading);
    section.appendChild(label);
    section.appendChild(hint);
    section.appendChild(textarea);

    return section;
}

export function create_page_types_dropdown_editor(
    options: CreatePageTypesDropdownEditorOptions
): PageTypesDropdownEditorResult {
    const { Helpers, Translation, metadata, on_input, on_save, on_cancel } = options;
    const t = Translation.t;
    const read_state = read_page_types_dropdown_state(metadata);

    const form = Helpers.create_element('form', {
        class_name: 'rulefile-metadata-edit-form page-types-dropdown-editor-form',
    }) as HTMLFormElement;

    let webbsida_textarea: HTMLTextAreaElement | null = null;
    let aterkommande_textarea: HTMLTextAreaElement | null = null;

    if (read_state.webbsida_category) {
        const webbsida_section = create_textarea_section(Helpers, {
            section_id: 'webbsida',
            label_key: 'rulefile_page_types_webbsida_textarea_label',
            hint_key: 'rulefile_page_types_webbsida_textarea_hint',
            textarea_name: PAGE_TYPES_WEBBSIDA_TEXTAREA_NAME,
            heading_text: String(read_state.webbsida_category.text || t('rulefile_page_types_webbsida_heading_fallback')),
            initial_value: read_state.webbsida_lines.join('\n'),
            on_input,
            t,
        });
        webbsida_textarea = webbsida_section.querySelector(
            `textarea[name="${PAGE_TYPES_WEBBSIDA_TEXTAREA_NAME}"]`
        ) as HTMLTextAreaElement;
        form.appendChild(webbsida_section);
    }

    if (read_state.aterkommande_category) {
        const aterkommande_section = create_textarea_section(Helpers, {
            section_id: 'aterkommande',
            label_key: 'rulefile_page_types_aterkommande_textarea_label',
            hint_key: 'rulefile_page_types_aterkommande_textarea_hint',
            textarea_name: PAGE_TYPES_ATERKOMMANDE_TEXTAREA_NAME,
            heading_text: String(
                read_state.aterkommande_category.text || t('rulefile_page_types_aterkommande_heading_fallback')
            ),
            initial_value: read_state.aterkommande_lines.join('\n'),
            on_input,
            t,
        });
        aterkommande_textarea = aterkommande_section.querySelector(
            `textarea[name="${PAGE_TYPES_ATERKOMMANDE_TEXTAREA_NAME}"]`
        ) as HTMLTextAreaElement;
        form.appendChild(aterkommande_section);
    }

    const actions = Helpers.create_element('div', { class_name: 'form-actions' });

    const save_button = Helpers.create_element('button', {
        class_name: ['button', 'button-primary'],
        attributes: {
            type: 'button',
            'aria-label': t('rulefile_metadata_save_page_types'),
        },
        html_content: Helpers.build_save_button_html_content?.(t('rulefile_metadata_save_page_types')) || t('rulefile_metadata_save_page_types'),
    });
    save_button.addEventListener('click', () => {
        void on_save();
    });

    const cancel_button = Helpers.create_element('button', {
        class_name: ['button', 'button-default'],
        attributes: {
            type: 'button',
            'aria-label': t('rulefile_page_types_back_without_saving'),
        },
        html_content: `<span>${t('rulefile_page_types_back_without_saving')}</span>`,
    });
    cancel_button.addEventListener('click', on_cancel);

    actions.appendChild(save_button);
    actions.appendChild(cancel_button);
    form.appendChild(actions);

    form.addEventListener('submit', (event) => {
        event.preventDefault();
    });

    return { form, webbsida_textarea, aterkommande_textarea, read_state };
}
