/**
 * @fileoverview Skärmdumps-/media-bifogning i stickprovsformuläret (samma modal som vid bristbeskrivning).
 */

import { app_runtime_refs } from '../../utils/app_runtime_refs.js';

type AddSampleFormLike = {
    get_t_internally: () => (key: string, params?: Record<string, unknown>) => string;
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        escape_html?: (s: string) => string;
        get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
        init_auto_resize_for_textarea?: (el: HTMLTextAreaElement) => void;
    };
    sample_attached_media_filenames: string[];
    sample_attach_media_btn: HTMLButtonElement | null;
    current_editing_sample_id: string | null;
    save_form_data_immediately: (is_autosave?: boolean, should_trim?: boolean, skip_render?: boolean) => void;
    _persist_new_sample_draft: (should_trim: boolean) => void;
};

function normalize_filenames(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((filename) => String(filename).trim()).filter(Boolean);
}

export function sync_sample_attached_filenames_from_data(
    component: AddSampleFormLike,
    effective_sample_data: { attachedMediaFilenames?: unknown } | null | undefined
): void {
    component.sample_attached_media_filenames = normalize_filenames(effective_sample_data?.attachedMediaFilenames);
}

function get_attach_button_label(t: (key: string, params?: Record<string, unknown>) => string, count: number): string {
    return count > 0 ? t('edit_attached_media_button', { count }) : t('attach_media_button');
}

function build_attach_media_button(
    component: AddSampleFormLike,
    filenames: string[],
    t: (key: string, params?: Record<string, unknown>) => string
): HTMLButtonElement {
    const attached_count = filenames.length;
    const attach_btn_label = get_attach_button_label(t, attached_count);
    const attach_aria_label = `${attach_btn_label} ${t('attach_media_aria_label_for')} ${t('sample_screenshot_section_label')}`;
    const image_icon = component.Helpers.get_icon_svg ? component.Helpers.get_icon_svg('image', ['currentColor'], 16) : '';
    const video_icon = component.Helpers.get_icon_svg ? component.Helpers.get_icon_svg('videocam', ['currentColor'], 16) : '';
    const attach_icons_html =
        image_icon || video_icon
            ? `<span class="attach-media-button-icons" aria-hidden="true">${image_icon}${video_icon}</span>`
            : '';
    const escaped_label = component.Helpers.escape_html
        ? component.Helpers.escape_html(attach_btn_label)
        : attach_btn_label;

    return component.Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'button-small'],
        attributes: {
            'data-action': 'attach-sample-media',
            type: 'button',
            'aria-label': attach_aria_label
        },
        html_content: `<span>${escaped_label}</span>${attach_icons_html}`
    }) as HTMLButtonElement;
}

export function render_sample_screenshot_section(
    component: AddSampleFormLike,
    effective_sample_data: { attachedMediaFilenames?: unknown } | null | undefined
): HTMLElement {
    sync_sample_attached_filenames_from_data(component, effective_sample_data);
    const t = component.get_t_internally();
    const section = component.Helpers.create_element('div', { class_name: 'sample-screenshot-section' });
    section.appendChild(
        component.Helpers.create_element('h2', { text_content: t('sample_screenshot_title') })
    );
    section.appendChild(
        component.Helpers.create_element('p', {
            class_name: 'sample-screenshot-instruction',
            text_content: t('sample_screenshot_instruction'),
            style: { margin: '0 0 0.75rem 0', color: 'var(--text-color-muted)' }
        })
    );

    const row = component.Helpers.create_element('div', { class_name: 'sample-attach-media-row' });
    const attach_btn = build_attach_media_button(component, component.sample_attached_media_filenames, t);
    row.appendChild(attach_btn);
    section.appendChild(row);
    component.sample_attach_media_btn = attach_btn;
    return section;
}

export function update_sample_attach_media_button(component: AddSampleFormLike): void {
    const btn = component.sample_attach_media_btn;
    if (!btn) return;
    const t = component.get_t_internally();
    const filenames = component.sample_attached_media_filenames;
    const attach_btn_label = get_attach_button_label(t, filenames.length);
    const attach_aria_label = `${attach_btn_label} ${t('attach_media_aria_label_for')} ${t('sample_screenshot_section_label')}`;
    btn.setAttribute('aria-label', attach_aria_label);
    const text_span = btn.querySelector('span:first-child');
    if (text_span) {
        text_span.textContent = attach_btn_label;
    }
}

function parse_filenames_from_textarea(textarea: HTMLTextAreaElement): string[] {
    return textarea.value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

export function handle_sample_attach_media_click(component: AddSampleFormLike, event: Event): void {
    event.preventDefault();
    const target = event.currentTarget;
    if (!(target instanceof HTMLButtonElement) || target.getAttribute('data-action') !== 'attach-sample-media') {
        return;
    }

    const ModalComponent = app_runtime_refs.modal_component as {
        show?: (
            opts: { h1_text: string; message_text: string },
            render: (container: HTMLElement, modal: { close: (el?: HTMLElement | null) => void }) => void
        ) => void;
    } | null;
    if (!ModalComponent?.show) return;

    const t = component.get_t_internally();
    ModalComponent.show(
        {
            h1_text: t('attach_media_modal_h1'),
            message_text: t('attach_media_modal_intro')
        },
        (container, modal) => {
            const form_group = component.Helpers.create_element('div', { class_name: 'form-group' });
            const label = component.Helpers.create_element('label', {
                attributes: { for: 'attach-sample-media-filenames' },
                text_content: t('attach_media_modal_filename_label')
            });
            form_group.appendChild(label);

            const initial_text = component.sample_attached_media_filenames.join('\n');
            const textarea = component.Helpers.create_element('textarea', {
                id: 'attach-sample-media-filenames',
                class_name: 'form-control',
                attributes: { rows: '3' }
            }) as HTMLTextAreaElement;
            textarea.value = initial_text;
            if (component.Helpers.init_auto_resize_for_textarea) {
                component.Helpers.init_auto_resize_for_textarea(textarea);
            }
            form_group.appendChild(textarea);
            container.appendChild(form_group);

            const actions_wrapper = component.Helpers.create_element('div', { class_name: 'modal-attach-media-actions' });
            const save_btn = component.Helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                text_content: t('attach_media_modal_save')
            });
            save_btn.addEventListener('click', () => {
                component.sample_attached_media_filenames = parse_filenames_from_textarea(textarea);
                update_sample_attach_media_button(component);
                if (component.current_editing_sample_id) {
                    component.save_form_data_immediately(true, false, true);
                } else {
                    component._persist_new_sample_draft(false);
                }
                modal.close(target);
            });

            const discard_btn = component.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                attributes: { type: 'button' },
                text_content: t('attach_media_modal_discard')
            });
            discard_btn.addEventListener('click', () => {
                modal.close(target);
            });

            actions_wrapper.appendChild(save_btn);
            actions_wrapper.appendChild(discard_btn);
            container.appendChild(actions_wrapper);
        }
    );
}
