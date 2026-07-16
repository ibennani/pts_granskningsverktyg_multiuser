/**
 * @fileoverview Gemensam markdown-förhandsgranskning med redigera-läge (textarea).
 */
import '../components/markdown_preview_editor.css';

import { render_markdown_to_html } from '../export/export_html_build_primitives.js';
import { build_save_button_html_content } from '../ui/save_button_html.js';

export type MarkdownPreviewEditorDeps = {
    Helpers: {
        create_element: (
            tag: string,
            opts?: {
                class_name?: string | string[];
                text_content?: string;
                attributes?: Record<string, string>;
                html_content?: string;
            }
        ) => HTMLElement;
        escape_html?: (value: string) => string;
    };
    Translation: {
        t: (key: string) => string;
    };
};

export type MarkdownPreviewEditorOptions = {
    heading_id?: string;
    heading_text?: string;
    label_key: string;
    textarea_id: string;
    initial_text: string;
    readonly?: boolean;
    /** Döljer inbyggd rubrikrad (h2 + redigera) i editorn. */
    hide_heading?: boolean;
    /** Placera redigera-knappen i sidans huvudrad (t.ex. bredvid h1). */
    external_edit_button_container?: HTMLElement;
    on_save?: (text: string) => void | Promise<void>;
    /** Lämnar redigering utan att spara (t.ex. navigera tillbaka). */
    on_discard?: () => void;
    discard_button_key?: string;
    /** Navigering tillbaka i visningsläge (ej redigering). */
    on_back?: () => void;
    back_button_key?: string;
};

export type MarkdownPreviewEditorHost = {
    is_editing: boolean;
    working_text: string;
    textarea_ref: HTMLTextAreaElement | null;
    preview_container_ref: HTMLElement | null;
};

function set_external_edit_button_visible(container: HTMLElement | undefined, visible: boolean): void {
    if (!container) return;
    const btn = container.querySelector('.markdown-preview-editor__edit-btn');
    if (btn instanceof HTMLElement) {
        btn.hidden = !visible;
    }
}

function create_edit_button(
    deps: MarkdownPreviewEditorDeps,
    host: MarkdownPreviewEditorHost,
    options: MarkdownPreviewEditorOptions,
    wrapper: HTMLElement
): HTMLButtonElement {
    const { Helpers, Translation } = deps;
    const edit_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'button-small', 'markdown-preview-editor__edit-btn'],
        attributes: {
            type: 'button',
            'aria-controls': options.textarea_id,
        },
        text_content: Translation.t('markdown_preview_editor_edit_button'),
    }) as HTMLButtonElement;
    edit_btn.addEventListener('click', () => {
        host.is_editing = true;
        host.working_text = host.textarea_ref?.value ?? host.working_text;
        set_external_edit_button_visible(options.external_edit_button_container, false);
        rerender_markdown_preview_editor_body(deps, host, options, wrapper);
        queueMicrotask(() => host.textarea_ref?.focus());
    });
    return edit_btn;
}

/**
 * Bygger preview/edit-block med rubrik, redigera-knapp och knapprad.
 */
export function build_markdown_preview_editor_ui(
    deps: MarkdownPreviewEditorDeps,
    host: MarkdownPreviewEditorHost,
    options: MarkdownPreviewEditorOptions
): HTMLElement {
    const { Helpers } = deps;
    const wrapper = Helpers.create_element('section', { class_name: 'markdown-preview-editor' });

    if (!options.hide_heading) {
        const header_row = Helpers.create_element('div', { class_name: 'markdown-preview-editor__header' });
        header_row.appendChild(
            Helpers.create_element('h2', {
                attributes: { id: options.heading_id ?? '' },
                text_content: options.heading_text ?? '',
            })
        );

        if (!options.readonly) {
            header_row.appendChild(create_edit_button(deps, host, options, wrapper));
        }

        wrapper.appendChild(header_row);
    } else if (!options.readonly && options.external_edit_button_container) {
        const existing = options.external_edit_button_container.querySelector('.markdown-preview-editor__edit-btn');
        if (!existing) {
            options.external_edit_button_container.appendChild(
                create_edit_button(deps, host, options, wrapper)
            );
        }
        set_external_edit_button_visible(options.external_edit_button_container, !host.is_editing);
    }

    const body_slot = Helpers.create_element('div', { class_name: 'markdown-preview-editor__body' });
    wrapper.appendChild(body_slot);

    render_markdown_preview_editor_body(deps, host, options, body_slot);
    return wrapper;
}

function render_markdown_preview_editor_body(
    deps: MarkdownPreviewEditorDeps,
    host: MarkdownPreviewEditorHost,
    options: MarkdownPreviewEditorOptions,
    body_slot: HTMLElement
): void {
    body_slot.innerHTML = '';
    const { Helpers, Translation } = deps;
    const t = Translation.t;

    if (host.is_editing && !options.readonly) {
        const label = Helpers.create_element('label', {
            attributes: { for: options.textarea_id },
            text_content: t(options.label_key),
        });
        body_slot.appendChild(label);

        const textarea = Helpers.create_element('textarea', {
            class_name: 'form-control markdown-preview-editor__textarea',
            attributes: {
                id: options.textarea_id,
                rows: '16',
            },
        }) as HTMLTextAreaElement;
        textarea.value = host.working_text;
        host.textarea_ref = textarea;
        body_slot.appendChild(textarea);

        const actions = Helpers.create_element('div', { class_name: 'markdown-preview-editor__actions' });
        const wrapper = body_slot.closest('.markdown-preview-editor') as HTMLElement;

        const save_btn = Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'button' },
            html_content: build_save_button_html_content(t('markdown_preview_editor_save_button')),
        });
        save_btn.addEventListener('click', async () => {
            host.working_text = textarea.value;
            if (options.on_save) {
                await options.on_save(host.working_text);
            }
            host.is_editing = false;
            set_external_edit_button_visible(options.external_edit_button_container, true);
            rerender_markdown_preview_editor_body(deps, host, options, wrapper);
        });

        actions.appendChild(save_btn);

        if (options.on_discard) {
            const discard_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                attributes: { type: 'button' },
                text_content: t(
                    options.discard_button_key ?? 'markdown_preview_editor_discard_button'
                ),
            });
            discard_btn.addEventListener('click', () => {
                options.on_discard?.();
            });
            actions.appendChild(discard_btn);
        }

        body_slot.appendChild(actions);
        return;
    }

    host.textarea_ref = null;
    const preview = Helpers.create_element('div', {
        class_name: ['markdown-preview-editor__preview', 'markdown-content'],
    });
    const html = render_markdown_to_html(host.working_text);
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
    host.preview_container_ref = preview;
    body_slot.appendChild(preview);

    if (!options.readonly && options.on_back && options.back_button_key) {
        const back_actions = Helpers.create_element('div', {
            class_name: 'markdown-preview-editor__actions',
        });
        const back_btn = Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: { type: 'button' },
            text_content: t(options.back_button_key),
        });
        back_btn.addEventListener('click', () => {
            options.on_back?.();
        });
        back_actions.appendChild(back_btn);
        body_slot.appendChild(back_actions);
    }
}

function rerender_markdown_preview_editor_body(
    deps: MarkdownPreviewEditorDeps,
    host: MarkdownPreviewEditorHost,
    options: MarkdownPreviewEditorOptions,
    wrapper: HTMLElement
): void {
    const body_slot = wrapper.querySelector('.markdown-preview-editor__body');
    if (!body_slot) return;
    render_markdown_preview_editor_body(deps, host, options, body_slot as HTMLElement);
}

