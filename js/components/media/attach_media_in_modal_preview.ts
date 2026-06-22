/**
 * @fileoverview Bildförhandsvisning inuti modalen Bifoga media, med återgång till filistan.
 */

import {
    mount_audit_media_image_preview,
    reset_audit_media_preview_layout
} from './audit_media_image_preview_mount.js';
import { run_attach_media_modal_view_switch } from './attach_media_modal_view_switch.js';
import type { AuditMediaObservationEditOptions } from './audit_media_preview_observation.js';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type HelpersLike = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
};

const PREVIEW_HISTORY_FLAG = '__gv_attach_media_preview';

export type AttachMediaInModalPreviewOptions = {
    t: TranslateFn;
    Helpers: HelpersLike;
    audit_id: string;
    dialog_el: HTMLDialogElement | null | undefined;
    modal_container: HTMLElement;
    heading_el: HTMLHeadingElement;
    message_el: HTMLElement;
    list_mode_root: HTMLElement;
    modal_heading_text: string;
    modal_message_text: string;
    observation_detail?: string | null;
    observation_edit?: AuditMediaObservationEditOptions | null;
    get_observation_detail?: () => string | null;
    get_observation_edit?: () => AuditMediaObservationEditOptions | null;
    on_preview_open_change?: (is_open: boolean) => void;
};

export type AttachMediaInModalPreviewController = {
    open_preview: (
        filename: string,
        blob_url: string | null | undefined,
        trigger_element: HTMLElement | null
    ) => void;
    is_preview_open: () => boolean;
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
 * Skapar styrning för bildförhandsvisning inuti modalen Bifoga media.
 */
export function create_attach_media_in_modal_preview(
    options: AttachMediaInModalPreviewOptions
): AttachMediaInModalPreviewController {
    const {
        t,
        Helpers,
        audit_id,
        dialog_el,
        modal_container,
        heading_el,
        message_el,
        list_mode_root,
        modal_heading_text,
        modal_message_text,
        observation_detail,
        observation_edit,
        get_observation_detail,
        get_observation_edit,
        on_preview_open_change
    } = options;

    let preview_mount_destroy = () => {};
    let preview_open = false;
    let view_switch_in_flight = false;
    let preview_trigger: HTMLElement | null = null;

    const apply_list_view = () => {
        preview_mount_destroy();
        preview_mount_destroy = () => {};
        preview_open = false;
        on_preview_open_change?.(false);

        modal_container.classList.add('modal-content--attach-media');

        heading_el.textContent = modal_heading_text;
        message_el.textContent = modal_message_text;
        message_el.hidden = modal_message_text.trim().length === 0;

        if (!list_mode_root.isConnected) {
            modal_container.appendChild(list_mode_root);
        }
    };

    const show_list_view = (focus_target?: HTMLElement | null) => {
        if (!preview_open || view_switch_in_flight) return;

        const focus_el = focus_target ?? preview_trigger;
        view_switch_in_flight = true;

        void run_attach_media_modal_view_switch(modal_container, apply_list_view).finally(() => {
            view_switch_in_flight = false;
            focus_element_safe(focus_el);
            preview_trigger = null;
        });
    };

    const push_preview_history = () => {
        if (typeof window === 'undefined' || !window.history) return;
        try {
            window.history.pushState({ [PREVIEW_HISTORY_FLAG]: true }, '', window.location.href);
        } catch {
            /* ignore */
        }
    };

    const back_from_preview_history = () => {
        if (typeof window === 'undefined' || !window.history) {
            show_list_view();
            return;
        }
        if (window.history.state?.[PREVIEW_HISTORY_FLAG]) {
            window.history.back();
            return;
        }
        show_list_view();
    };

    const on_popstate = () => {
        if (!preview_open || view_switch_in_flight) return;
        if (window.history.state?.[PREVIEW_HISTORY_FLAG]) return;
        show_list_view();
    };

    window.addEventListener('popstate', on_popstate);

    const apply_preview_view = (
        filename: string,
        blob_url: string | null | undefined,
        trigger_element: HTMLElement | null
    ) => {
        list_mode_root.remove();
        modal_container.classList.remove('modal-content--attach-media');

        heading_el.textContent = filename;
        message_el.textContent = '';
        message_el.hidden = true;

        preview_mount_destroy = mount_audit_media_image_preview(
            modal_container,
            dialog_el ?? null,
            {
                t,
                Helpers,
                audit_id,
                filename,
                blob_url,
                observation_detail: get_observation_detail?.() ?? observation_detail,
                observation_edit: get_observation_edit?.() ?? observation_edit,
                close_button_label: t('attach_media_back_to_file_list'),
                on_close: () => {
                    back_from_preview_history();
                },
                trigger_element
            }
        ).destroy;

        preview_open = true;
        on_preview_open_change?.(true);
    };

    const open_preview = (
        filename: string,
        blob_url: string | null | undefined,
        trigger_element: HTMLElement | null
    ) => {
        if (!audit_id || preview_open || view_switch_in_flight) return;

        preview_trigger = trigger_element;
        view_switch_in_flight = true;

        void run_attach_media_modal_view_switch(modal_container, () => {
            apply_preview_view(filename, blob_url, trigger_element);
        }).finally(() => {
            view_switch_in_flight = false;
            push_preview_history();
        });
    };

    const destroy = () => {
        window.removeEventListener('popstate', on_popstate);
        if (!preview_open) return;

        preview_mount_destroy();
        preview_mount_destroy = () => {};
        preview_open = false;
        reset_audit_media_preview_layout(dialog_el, modal_container);
        modal_container.classList.add('modal-content--attach-media');
        modal_container.classList.remove('modal-content--attach-media-view-switch');
        modal_container.style.opacity = '';
        dialog_el?.classList.remove('modal-dialog--attach-media-view-switch');
        if (dialog_el) {
            dialog_el.style.width = '';
            dialog_el.style.minWidth = '';
            dialog_el.style.maxWidth = '';
            dialog_el.style.height = '';
            dialog_el.style.minHeight = '';
        }

        heading_el.textContent = modal_heading_text;
        message_el.textContent = modal_message_text;
        message_el.hidden = modal_message_text.trim().length === 0;

        if (!list_mode_root.isConnected) {
            modal_container.appendChild(list_mode_root);
        }

        if (typeof window !== 'undefined' && window.history?.state?.[PREVIEW_HISTORY_FLAG]) {
            try {
                window.history.back();
            } catch {
                /* ignore */
            }
        }
    };

    return {
        open_preview,
        is_preview_open: () => preview_open,
        destroy
    };
}
