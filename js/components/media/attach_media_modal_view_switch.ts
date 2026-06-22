/**
 * @fileoverview Animerar innehålls- och storleksbyte i modalen Bifoga media (0,5 s).
 */

import { MODAL_TRANSITION_MS } from '../../../shared/constants/modal_layout.js';
import {
    apply_audit_media_preview_image_dimensions,
    capture_audit_media_preview_open_target,
    fit_audit_media_preview_layout,
    sync_audit_media_preview_heading_layout,
    type AuditMediaPreviewOpenTarget
} from './audit_media_image_preview_mount.js';

const DIALOG_SWITCH_CLASS = 'modal-dialog--attach-media-view-switch';
const CONTENT_SWITCH_CLASS = 'modal-content--attach-media-view-switch';
const PREVIEW_OPENING_CLASS = 'modal-content--media-preview-opening';

type DialogSize = {
    width: number;
    height: number;
};

export type AttachMediaModalDialogSize = DialogSize;

export type AttachMediaModalViewSwitchOptions = {
    on_transition_complete?: () => void;
    /** Listvyns storlek vid stängning av bildförhandsvisning (undviker hopp vid målmätning). */
    close_target_size?: AttachMediaModalDialogSize | null;
};

/** Mäter dialogens aktuella storlek (px). */
export function measure_attach_media_modal_dialog(
    dialog_el: HTMLDialogElement
): AttachMediaModalDialogSize {
    const rect = dialog_el.getBoundingClientRect();
    return {
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height))
    };
}

function prefers_reduced_motion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function wait_ms(ms: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

function measure_dialog(dialog_el: HTMLDialogElement): DialogSize {
    return measure_attach_media_modal_dialog(dialog_el);
}

function open_target_to_dialog_size(target: AuditMediaPreviewOpenTarget): DialogSize {
    return {
        width: target.dialog_width,
        height: target.dialog_height
    };
}

function apply_dialog_size(dialog_el: HTMLDialogElement, size: DialogSize): void {
    dialog_el.style.width = `${size.width}px`;
    dialog_el.style.minWidth = `${size.width}px`;
    dialog_el.style.maxWidth = `${size.width}px`;
    dialog_el.style.height = `${size.height}px`;
    dialog_el.style.minHeight = `${size.height}px`;
}

function clear_dialog_size(dialog_el: HTMLDialogElement, container: HTMLElement): void {
    dialog_el.style.width = '';
    dialog_el.style.minWidth = '';
    dialog_el.style.maxWidth = '';
    dialog_el.style.height = '';
    dialog_el.style.minHeight = '';
}

function clear_preview_container_layout_locks(container: HTMLElement): void {
    container.style.width = '';
    container.style.maxWidth = '';
    container.style.boxSizing = '';
    delete container.dataset.previewLayoutLocked;
}

async function wait_for_next_frame(): Promise<void> {
    await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
        });
    });
}

async function wait_for_layout(container: HTMLElement): Promise<void> {
    const img = container.querySelector('.audit-media-preview-image');
    if (img instanceof HTMLImageElement && !img.complete) {
        await new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
        });
    }
    await wait_for_next_frame();
}

function is_media_preview_container(container: HTMLElement): boolean {
    return container.classList.contains('modal-content--media-preview');
}

function force_reflow(dialog_el: HTMLDialogElement): void {
    void dialog_el.getBoundingClientRect();
}

function start_transition(
    dialog_el: HTMLDialogElement,
    container: HTMLElement,
    start: DialogSize,
    target: DialogSize,
    on_animate_start?: () => void
): void {
    dialog_el.classList.add(DIALOG_SWITCH_CLASS);
    container.classList.add(CONTENT_SWITCH_CLASS);
    apply_dialog_size(dialog_el, start);
    force_reflow(dialog_el);
    requestAnimationFrame(() => {
        apply_dialog_size(dialog_el, target);
        container.style.opacity = '1';
        on_animate_start?.();
    });
}

function cleanup_transition(
    dialog_el: HTMLDialogElement,
    container: HTMLElement,
    keep_dialog_size: boolean
): void {
    dialog_el.classList.remove(DIALOG_SWITCH_CLASS);
    container.classList.remove(CONTENT_SWITCH_CLASS);
    container.classList.remove(PREVIEW_OPENING_CLASS);
    container.style.opacity = '';
    if (!keep_dialog_size) {
        clear_preview_container_layout_locks(container);
        clear_dialog_size(dialog_el, container);
    }
}

async function layout_preview_after_instant_switch(
    container: HTMLElement,
    dialog_el: HTMLDialogElement
): Promise<void> {
    await wait_for_layout(container);
    fit_audit_media_preview_layout(container, dialog_el);
}

/**
 * Byter vy med parallell toning och storleksanimation (0,5 s).
 */
export async function run_attach_media_modal_view_switch(
    container: HTMLElement,
    apply_change: () => void,
    options: AttachMediaModalViewSwitchOptions = {}
): Promise<void> {
    const dialog_el = container.closest('dialog');
    if (!(dialog_el instanceof HTMLDialogElement)) {
        apply_change();
        options.on_transition_complete?.();
        return;
    }

    if (prefers_reduced_motion()) {
        apply_change();
        if (is_media_preview_container(container)) {
            await layout_preview_after_instant_switch(container, dialog_el);
        }
        options.on_transition_complete?.();
        return;
    }

    const was_preview = is_media_preview_container(container);
    const start_size = measure_dialog(dialog_el);
    container.style.opacity = '0';

    apply_change();
    await wait_for_layout(container);

    const opening_preview = is_media_preview_container(container);
    const closing_preview = was_preview && !opening_preview;

    let target_size: DialogSize;
    let open_target: AuditMediaPreviewOpenTarget | null = null;

    if (opening_preview) {
        sync_audit_media_preview_heading_layout(container, dialog_el);
        open_target = capture_audit_media_preview_open_target(container, dialog_el);
        target_size = open_target
            ? open_target_to_dialog_size(open_target)
            : measure_dialog(dialog_el);
    } else if (closing_preview) {
        clear_preview_container_layout_locks(container);
        if (options.close_target_size) {
            target_size = options.close_target_size;
        } else {
            clear_dialog_size(dialog_el, container);
            await wait_for_next_frame();
            target_size = measure_dialog(dialog_el);
        }
    } else {
        target_size = measure_dialog(dialog_el);
    }

    apply_dialog_size(dialog_el, start_size);

    if (open_target) {
        fit_audit_media_preview_layout(container, dialog_el);
        container.classList.add(PREVIEW_OPENING_CLASS);
        await wait_for_next_frame();
    }

    start_transition(dialog_el, container, start_size, target_size, () => {
        if (open_target) {
            apply_audit_media_preview_image_dimensions(container, open_target);
        }
    });

    await wait_ms(MODAL_TRANSITION_MS);
    options.on_transition_complete?.();
    cleanup_transition(dialog_el, container, opening_preview);
}
