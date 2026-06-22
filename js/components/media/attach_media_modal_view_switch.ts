/**
 * @fileoverview Animerar innehålls- och storleksbyte i modalen Bifoga media (0,5 s).
 */

import { MODAL_TRANSITION_MS } from '../../../shared/constants/modal_layout.js';

const DIALOG_SWITCH_CLASS = 'modal-dialog--attach-media-view-switch';
const CONTENT_SWITCH_CLASS = 'modal-content--attach-media-view-switch';

type DialogSize = {
    width: number;
    height: number;
};

function prefers_reduced_motion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function wait_ms(ms: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

function measure_dialog(dialog_el: HTMLDialogElement): DialogSize {
    const rect = dialog_el.getBoundingClientRect();
    return {
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height))
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
    if (container.classList.contains('modal-content--media-preview')) {
        dialog_el.style.height = '';
        dialog_el.style.minHeight = '';
        return;
    }
    dialog_el.style.width = '';
    dialog_el.style.minWidth = '';
    dialog_el.style.maxWidth = '';
    dialog_el.style.height = '';
    dialog_el.style.minHeight = '';
}

async function wait_for_layout(container: HTMLElement): Promise<void> {
    const img = container.querySelector('.audit-media-preview-image');
    if (img instanceof HTMLImageElement && !img.complete) {
        await new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
        });
    }
    await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
        });
    });
}

function start_transition(
    dialog_el: HTMLDialogElement,
    container: HTMLElement,
    target: DialogSize
): void {
    dialog_el.classList.add(DIALOG_SWITCH_CLASS);
    container.classList.add(CONTENT_SWITCH_CLASS);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            apply_dialog_size(dialog_el, target);
            container.style.opacity = '1';
        });
    });
}

function cleanup_transition(
    dialog_el: HTMLDialogElement,
    container: HTMLElement
): void {
    dialog_el.classList.remove(DIALOG_SWITCH_CLASS);
    container.classList.remove(CONTENT_SWITCH_CLASS);
    container.style.opacity = '';
    clear_dialog_size(dialog_el, container);
}

/**
 * Byter vy med parallell toning och storleksanimation (0,5 s).
 */
export async function run_attach_media_modal_view_switch(
    container: HTMLElement,
    apply_change: () => void
): Promise<void> {
    const dialog_el = container.closest('dialog');
    if (prefers_reduced_motion() || !(dialog_el instanceof HTMLDialogElement)) {
        apply_change();
        return;
    }

    const start_size = measure_dialog(dialog_el);
    container.style.opacity = '0';

    apply_change();
    await wait_for_layout(container);

    const target_size = measure_dialog(dialog_el);
    apply_dialog_size(dialog_el, start_size);
    start_transition(dialog_el, container, target_size);

    await wait_ms(MODAL_TRANSITION_MS);
    cleanup_transition(dialog_el, container);
}
