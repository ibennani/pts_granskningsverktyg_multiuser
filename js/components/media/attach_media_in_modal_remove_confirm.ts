/**
 * @fileoverview Bekräftelsevy för borttagning av fil inuti modalen Bifoga media.
 */

import {
    ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS,
    run_attach_media_modal_view_switch
} from './attach_media_modal_view_switch.js';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type HelpersLike = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
};

function get_modal_shell(container: HTMLElement): HTMLElement {
    return (container.closest('.modal-content') as HTMLElement | null) ?? container;
}

export type AttachMediaInModalRemoveConfirmOptions = {
    t: TranslateFn;
    Helpers: HelpersLike;
    modal_container: HTMLElement;
    heading_el: HTMLHeadingElement;
    message_el: HTMLElement;
    list_mode_root: HTMLElement;
    modal_heading_text: string;
    modal_message_text: string;
    on_prepare_confirm_remove: (
        filename: string,
        removed_index: number
    ) => HTMLElement | null | undefined;
    on_after_confirm_remove?: (filename: string) => void | Promise<void>;
    on_open_change?: (is_open: boolean) => void;
};

export type AttachMediaInModalRemoveConfirmController = {
    open_remove_confirm: (
        filename: string,
        removed_index: number,
        trigger_element: HTMLButtonElement
    ) => void;
    is_remove_confirm_open: () => boolean;
    destroy: () => void;
};

function focus_element_safe(element: HTMLElement | null | undefined): void {
    if (!element || !document.contains(element)) return;
    try {
        element.focus({ preventScroll: true });
    } catch {
        element.focus();
    }
}

/**
 * Skapar styrning för borttagningsbekräftelse inuti modalen Bifoga media.
 */
export function create_attach_media_in_modal_remove_confirm(
    options: AttachMediaInModalRemoveConfirmOptions
): AttachMediaInModalRemoveConfirmController {
    const {
        t,
        Helpers,
        modal_container,
        heading_el,
        message_el,
        list_mode_root,
        modal_heading_text,
        modal_message_text,
        on_prepare_confirm_remove,
        on_after_confirm_remove,
        on_open_change
    } = options;

    let confirm_actions_el: HTMLElement | null = null;
    let confirm_open = false;
    let view_switch_in_flight = false;
    let pending_filename = '';
    let pending_index = 0;
    let confirm_trigger: HTMLButtonElement | null = null;

    const remove_confirm_actions = () => {
        if (confirm_actions_el?.isConnected) {
            confirm_actions_el.remove();
        }
        confirm_actions_el = null;
    };

    const apply_list_view = () => {
        confirm_open = false;
        on_open_change?.(false);
        remove_confirm_actions();

        get_modal_shell(modal_container).classList.add('modal-content--attach-media');
        modal_container.classList.add('modal-body--attach-media');

        heading_el.textContent = modal_heading_text;
        message_el.textContent = modal_message_text;
        message_el.hidden = modal_message_text.trim().length === 0;

        if (!list_mode_root.isConnected) {
            modal_container.appendChild(list_mode_root);
        }
    };

    const show_list_view = (focus_target?: HTMLElement | null) => {
        if (!confirm_open || view_switch_in_flight) return;

        const focus_el = focus_target ?? confirm_trigger;
        view_switch_in_flight = true;

        void run_attach_media_modal_view_switch(modal_container, apply_list_view, {
            transition_ms: ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS
        }).finally(() => {
            view_switch_in_flight = false;
            focus_element_safe(focus_el);
            confirm_trigger = null;
            pending_filename = '';
            pending_index = 0;
        });
    };

    const apply_confirm_view = (filename: string) => {
        list_mode_root.remove();

        heading_el.textContent = t('attach_media_remove_confirm_h1');
        message_el.textContent = t('attach_media_remove_confirm_message', { filename });
        message_el.hidden = false;

        const actions = Helpers.create_element('div', {
            class_name: 'attach-media-remove-confirm-actions'
        });
        const confirm_btn = Helpers.create_element('button', {
            class_name: ['button', 'button-danger'],
            attributes: { type: 'button' },
            text_content: t('attach_media_remove_confirm_button')
        }) as HTMLButtonElement;
        confirm_btn.addEventListener('click', () => {
            const name = pending_filename;
            const index = pending_index;
            const focus_target = on_prepare_confirm_remove(name, index);
            confirm_open = false;
            on_open_change?.(false);
            view_switch_in_flight = true;
            void run_attach_media_modal_view_switch(modal_container, apply_list_view, {
                transition_ms: ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS
            }).finally(() => {
                view_switch_in_flight = false;
                confirm_trigger = null;
                pending_filename = '';
                pending_index = 0;
                focus_element_safe(focus_target);
                void on_after_confirm_remove?.(name);
            });
        });

        const keep_btn = Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: { type: 'button' },
            text_content: t('attach_media_remove_confirm_keep')
        });
        keep_btn.addEventListener('click', () => {
            show_list_view(confirm_trigger);
        });

        actions.appendChild(confirm_btn);
        actions.appendChild(keep_btn);
        modal_container.appendChild(actions);
        confirm_actions_el = actions;

        confirm_open = true;
        on_open_change?.(true);
    };

    const open_remove_confirm = (
        filename: string,
        removed_index: number,
        trigger_element: HTMLButtonElement
    ) => {
        if (confirm_open || view_switch_in_flight) return;

        pending_filename = filename;
        pending_index = removed_index;
        confirm_trigger = trigger_element;
        view_switch_in_flight = true;

        void run_attach_media_modal_view_switch(modal_container, () => {
            apply_confirm_view(filename);
        }, {
            transition_ms: ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS
        }).finally(() => {
            view_switch_in_flight = false;
            focus_element_safe(heading_el);
        });
    };

    const destroy = () => {
        if (!confirm_open) return;

        remove_confirm_actions();
        confirm_open = false;
        const shell_el = get_modal_shell(modal_container);
        shell_el.classList.add('modal-content--attach-media');
        shell_el.classList.remove('modal-content--attach-media-view-switch');
        shell_el.style.opacity = '';
        modal_container.classList.add('modal-body--attach-media');

        heading_el.textContent = modal_heading_text;
        message_el.textContent = modal_message_text;
        message_el.hidden = modal_message_text.trim().length === 0;

        if (!list_mode_root.isConnected) {
            modal_container.appendChild(list_mode_root);
        }

        confirm_trigger = null;
        pending_filename = '';
        pending_index = 0;
    };

    return {
        open_remove_confirm,
        is_remove_confirm_open: () => confirm_open,
        destroy
    };
}
