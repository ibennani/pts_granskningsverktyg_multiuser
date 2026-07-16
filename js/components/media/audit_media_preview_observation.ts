/**
 * @fileoverview Bristbeskrivning i bildförhandsvisning med valfri redigering.
 */

import { MODAL_TRANSITION_MS } from '../../../shared/constants/modal_layout.js';
import { build_save_button_html_content } from '../../ui/save_button_html.js';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type HelpersLike = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    init_auto_resize_for_textarea?: (el: HTMLTextAreaElement) => void;
    trim_textarea_preserve_lines?: (raw: string) => string;
};

export type AuditMediaObservationEditOptions = {
    can_edit: boolean;
    on_save: (trimmed_text: string) => void;
};

export type ObservationLayoutChangeOptions = {
    animated?: boolean;
    finalize?: boolean;
    observation_body_height_from?: number;
    observation_body_height_to?: number;
};

export type ObservationLayoutChangeFn = (options?: ObservationLayoutChangeOptions) => void;

type ObservationViewRefs = {
    block: HTMLElement;
    body_el: HTMLElement;
    heading_el: HTMLHeadingElement;
    read_text: string;
    text_el: HTMLParagraphElement;
    edit_btn: HTMLButtonElement;
    edit_panel: HTMLElement | null;
    textarea: HTMLTextAreaElement | null;
    transition_timer: ReturnType<typeof setTimeout> | null;
};

export const OBSERVATION_TRANSITION_MS = MODAL_TRANSITION_MS;

function prefers_reduced_motion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function get_observation_transition_ms(): number {
    return prefers_reduced_motion() ? 0 : OBSERVATION_TRANSITION_MS;
}

function measure_element_height(element: HTMLElement): number {
    return Math.round(element.getBoundingClientRect().height);
}

function sync_textarea_height(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

function clear_observation_transition_timer(refs: ObservationViewRefs): void {
    if (refs.transition_timer !== null) {
        clearTimeout(refs.transition_timer);
        refs.transition_timer = null;
    }
}

function clear_body_height_lock(body_el: HTMLElement): void {
    body_el.style.height = '';
    body_el.style.transition = '';
    body_el.style.overflow = '';
}

function after_observation_transition(refs: ObservationViewRefs, callback: () => void): void {
    clear_observation_transition_timer(refs);
    const delay_ms = get_observation_transition_ms();
    if (delay_ms <= 0) {
        callback();
        return;
    }
    refs.transition_timer = setTimeout(() => {
        refs.transition_timer = null;
        callback();
    }, delay_ms);
}

function trim_observation_text(Helpers: HelpersLike, raw: string): string {
    if (typeof Helpers.trim_textarea_preserve_lines === 'function') {
        return Helpers.trim_textarea_preserve_lines(raw);
    }
    return raw.trim();
}

function remove_edit_panel(refs: ObservationViewRefs): void {
    if (refs.edit_panel?.isConnected) {
        refs.edit_panel.remove();
    }
    refs.edit_panel = null;
    refs.textarea = null;
}

function set_read_body_mode(refs: ObservationViewRefs): void {
    refs.block.classList.remove('audit-media-preview-observation--edit-mode');
    refs.body_el.classList.remove('audit-media-preview-observation__body--edit');
    refs.body_el.classList.add('audit-media-preview-observation__body--read');
}

function set_edit_body_mode(refs: ObservationViewRefs): void {
    refs.block.classList.add('audit-media-preview-observation--edit-mode');
    refs.body_el.classList.remove('audit-media-preview-observation__body--read');
    refs.body_el.classList.add('audit-media-preview-observation__body--edit');
}

function run_body_height_flip_transition(
    refs: ObservationViewRefs,
    apply_target_mode: () => void,
    on_layout_change?: ObservationLayoutChangeFn,
    on_complete?: () => void
): void {
    const duration_ms = get_observation_transition_ms();
    const first_height = measure_element_height(refs.body_el);

    apply_target_mode();
    refs.body_el.offsetHeight;
    const last_height = measure_element_height(refs.body_el);

    if (duration_ms <= 0 || Math.abs(first_height - last_height) < 1) {
        clear_body_height_lock(refs.body_el);
        on_layout_change?.({ animated: false });
        on_complete?.();
        return;
    }

    refs.body_el.style.overflow = 'hidden';
    refs.body_el.style.height = `${first_height}px`;
    refs.body_el.offsetHeight;
    refs.body_el.style.transition = `height ${duration_ms}ms ease`;

    requestAnimationFrame(() => {
        refs.body_el.style.height = `${last_height}px`;
        on_layout_change?.({
            animated: true,
            observation_body_height_from: first_height,
            observation_body_height_to: last_height
        });
    });

    after_observation_transition(refs, () => {
        clear_body_height_lock(refs.body_el);
        on_layout_change?.({ finalize: true });
        on_complete?.();
    });
}

function show_read_mode(
    refs: ObservationViewRefs,
    text: string,
    on_layout_change?: ObservationLayoutChangeFn
): void {
    refs.read_text = text;
    refs.text_el.textContent = text;

    if (!refs.edit_panel?.isConnected) {
        set_read_body_mode(refs);
        on_layout_change?.({ animated: false });
        return;
    }

    clear_observation_transition_timer(refs);
    run_body_height_flip_transition(
        refs,
        () => {
            set_read_body_mode(refs);
        },
        on_layout_change,
        () => {
            remove_edit_panel(refs);
        }
    );
}

function focus_observation_textarea(textarea: HTMLTextAreaElement): void {
    requestAnimationFrame(() => {
        try {
            textarea.focus({ preventScroll: true });
        } catch {
            textarea.focus();
        }
    });
}

function wire_observation_edit_actions(
    Helpers: HelpersLike,
    edit_options: AuditMediaObservationEditOptions,
    refs: ObservationViewRefs,
    on_layout_change?: ObservationLayoutChangeFn
): void {
    if (!refs.edit_panel) return;

    const save_btn = refs.edit_panel.querySelector('.audit-media-preview-observation__save-btn');
    const undo_btn = refs.edit_panel.querySelector('.audit-media-preview-observation__undo-btn');
    if (!(save_btn instanceof HTMLButtonElement) || !(undo_btn instanceof HTMLButtonElement)) return;

    save_btn.addEventListener('click', () => {
        const trimmed = trim_observation_text(Helpers, refs.textarea?.value || '');
        edit_options.on_save(trimmed);
        show_read_mode(refs, trimmed, on_layout_change);
    });

    undo_btn.addEventListener('click', () => {
        show_read_mode(refs, refs.read_text, on_layout_change);
    });
}

function build_observation_edit_panel(
    Helpers: HelpersLike,
    t: TranslateFn,
    textarea_id: string,
    heading_id: string
): HTMLElement {
    const edit_panel = Helpers.create_element('div', {
        class_name: 'audit-media-preview-observation__edit'
    });

    const textarea = Helpers.create_element('textarea', {
        class_name: ['form-control', 'audit-media-preview-observation__textarea'],
        attributes: {
            id: textarea_id,
            rows: '5',
            'aria-labelledby': heading_id
        }
    }) as HTMLTextAreaElement;
    edit_panel.appendChild(textarea);

    const actions = Helpers.create_element('div', {
        class_name: 'audit-media-preview-observation__edit-actions'
    });
    actions.appendChild(
        Helpers.create_element('button', {
            class_name: ['button', 'button-primary', 'audit-media-preview-observation__save-btn'],
            attributes: { type: 'button' },
            html_content: build_save_button_html_content(t('audit_media_preview_observation_save'))
        })
    );
    actions.appendChild(
        Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'audit-media-preview-observation__undo-btn'],
            attributes: { type: 'button' },
            text_content: t('audit_media_preview_observation_undo')
        })
    );
    edit_panel.appendChild(actions);
    return edit_panel;
}

function open_observation_edit_mode(
    refs: ObservationViewRefs,
    Helpers: HelpersLike,
    t: TranslateFn,
    edit_options: AuditMediaObservationEditOptions,
    on_layout_change?: ObservationLayoutChangeFn
): void {
    if (refs.edit_panel?.isConnected || refs.block.classList.contains('audit-media-preview-observation--edit-mode')) {
        return;
    }

    clear_observation_transition_timer(refs);
    remove_edit_panel(refs);

    const textarea_id = `audit-media-preview-observation-${Date.now()}`;
    refs.edit_panel = build_observation_edit_panel(Helpers, t, textarea_id, refs.heading_el.id);
    refs.textarea = refs.edit_panel.querySelector('textarea');
    if (!(refs.textarea instanceof HTMLTextAreaElement)) {
        remove_edit_panel(refs);
        set_read_body_mode(refs);
        return;
    }

    refs.textarea.value = refs.read_text;
    refs.body_el.appendChild(refs.edit_panel);
    wire_observation_edit_actions(Helpers, edit_options, refs, on_layout_change);

    run_body_height_flip_transition(
        refs,
        () => {
            set_edit_body_mode(refs);
            if (refs.textarea) {
                sync_textarea_height(refs.textarea);
            }
        },
        on_layout_change,
        () => {
            if (refs.textarea) {
                if (Helpers.init_auto_resize_for_textarea) {
                    Helpers.init_auto_resize_for_textarea(refs.textarea);
                }
                focus_observation_textarea(refs.textarea);
            }
        }
    );
}

/**
 * Lägger till bristbeskrivning med valfri redigering i bildmodalen.
 */
export function append_audit_media_preview_observation_block(
    container: HTMLElement,
    Helpers: HelpersLike,
    t: TranslateFn,
    observation_detail?: string | null,
    edit_options?: AuditMediaObservationEditOptions | null,
    on_layout_change?: ObservationLayoutChangeFn
): void {
    const observation_text = String(observation_detail || '').trim();
    if (!observation_text && !edit_options?.can_edit) return;

    const heading_id = `audit-media-preview-observation-heading-${Date.now()}`;
    const block = Helpers.create_element('div', {
        class_name: 'audit-media-preview-observation'
    });

    const header = Helpers.create_element('div', {
        class_name: 'audit-media-preview-observation__header'
    });
    const heading_el = Helpers.create_element('h2', {
        class_name: 'audit-media-preview-observation__label',
        attributes: { id: heading_id },
        text_content: t('audit_media_preview_observation_label')
    }) as HTMLHeadingElement;
    header.appendChild(heading_el);

    let edit_btn: HTMLButtonElement | null = null;
    if (edit_options?.can_edit) {
        edit_btn = Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'button-small', 'audit-media-preview-observation__edit-btn'],
            attributes: { type: 'button' },
            text_content: t('audit_media_preview_observation_edit')
        }) as HTMLButtonElement;
        header.appendChild(edit_btn);
    }
    block.appendChild(header);

    const body_el = Helpers.create_element('div', {
        class_name: ['audit-media-preview-observation__body', 'audit-media-preview-observation__body--read']
    });
    const text_el = Helpers.create_element('p', {
        class_name: 'audit-media-preview-observation__text',
        text_content: observation_text
    }) as HTMLParagraphElement;
    body_el.appendChild(text_el);
    block.appendChild(body_el);

    if (edit_options?.can_edit && edit_btn) {
        const refs: ObservationViewRefs = {
            block,
            body_el,
            heading_el,
            read_text: observation_text,
            text_el,
            edit_btn,
            edit_panel: null,
            textarea: null,
            transition_timer: null
        };

        edit_btn.addEventListener('click', () => {
            open_observation_edit_mode(refs, Helpers, t, edit_options, on_layout_change);
        });
    }

    container.appendChild(block);
}
