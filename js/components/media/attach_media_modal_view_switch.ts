/**

 * @fileoverview Animerar innehålls- och storleksbyte i modalen Bifoga media.

 * Inline-vyer: uttoning, storleksbyte, intoning i följd (0,25 s totalt); bildförhandsvisning 0,5 s.

 */



import {

    ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS,

    MODAL_TRANSITION_MS

} from '../../../shared/constants/modal_layout.js';

import {

    apply_audit_media_preview_image_dimensions,

    capture_audit_media_preview_open_target,

    fit_audit_media_preview_layout,

    sync_audit_media_preview_heading_layout,

    type AuditMediaPreviewOpenTarget

} from './audit_media_image_preview_mount.js';

import { clamp_dialog_size_to_viewport } from '../../logic/audit_media_preview_viewport.js';



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

    /** Anpassad animationstid; standard är {@link MODAL_TRANSITION_MS}. */

    transition_ms?: number;

};



type TransitionPhaseMs = {

    fade_out_ms: number;

    resize_ms: number;

    fade_in_ms: number;

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

    const shell = get_modal_shell_from_container(container);

    if (shell !== container) {

        shell.style.width = '';

        shell.style.maxWidth = '';

        shell.style.boxSizing = '';

        delete shell.dataset.previewLayoutLocked;

    }

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



function get_modal_shell_from_container(container: HTMLElement): HTMLElement {

    return (container.closest('.modal-content') as HTMLElement | null) ?? container;

}



/** Element som tonas vid vybyte: hela skalet inklusive rubrik och brödtext. */

function get_view_switch_fade_el(container: HTMLElement): HTMLElement {

    return get_modal_shell_from_container(container);

}



function is_media_preview_container(container: HTMLElement): boolean {

    const shell = get_modal_shell_from_container(container);

    return shell.classList.contains('modal-content--media-preview');

}



function force_reflow(el: HTMLElement): void {

    void el.getBoundingClientRect();

}



export function split_transition_phases(transition_ms: number): TransitionPhaseMs {

    const fade_out_ms = Math.round(transition_ms * 0.32);

    const resize_ms = Math.round(transition_ms * 0.36);

    return {

        fade_out_ms,

        resize_ms,

        fade_in_ms: transition_ms - fade_out_ms - resize_ms

    };

}



function set_view_switch_duration(dialog_el: HTMLDialogElement, ms: number): void {

    dialog_el.style.setProperty('--modal-transition-duration', `${ms}ms`);

}



function prepare_fade_phase(

    fade_el: HTMLElement,

    dialog_el: HTMLDialogElement,

    duration_ms: number,

    from_opacity: '0' | '1',

    to_opacity: '0' | '1'

): void {

    set_view_switch_duration(dialog_el, duration_ms);

    fade_el.classList.add(CONTENT_SWITCH_CLASS);

    fade_el.style.opacity = from_opacity;

    force_reflow(fade_el);

    fade_el.style.opacity = to_opacity;

}



function cleanup_transition(

    dialog_el: HTMLDialogElement,

    container: HTMLElement,

    keep_dialog_size: boolean

): void {

    const fade_el = get_view_switch_fade_el(container);

    dialog_el.classList.remove(DIALOG_SWITCH_CLASS);

    fade_el.classList.remove(CONTENT_SWITCH_CLASS);

    container.classList.remove(PREVIEW_OPENING_CLASS);

    fade_el.style.opacity = '';

    dialog_el.style.removeProperty('--modal-transition-duration');

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



type TargetSizeResult = {

    target_size: DialogSize;

    open_target: AuditMediaPreviewOpenTarget | null;

    opening_preview: boolean;

};



async function measure_target_size_after_swap(

    container: HTMLElement,

    dialog_el: HTMLDialogElement,

    was_preview: boolean,

    start_size: DialogSize,

    close_target_size: AttachMediaModalDialogSize | null | undefined

): Promise<TargetSizeResult> {

    const opening_preview = is_media_preview_container(container);

    const closing_preview = was_preview && !opening_preview;



    let target_size: DialogSize;

    let open_target: AuditMediaPreviewOpenTarget | null = null;



    if (opening_preview) {

        sync_audit_media_preview_heading_layout(container, dialog_el);

        open_target = capture_audit_media_preview_open_target(container, dialog_el, {

            lock_size_during_measure: start_size

        });

        target_size = open_target

            ? clamp_dialog_size_to_viewport(open_target_to_dialog_size(open_target))

            : clamp_dialog_size_to_viewport(measure_dialog(dialog_el));

    } else if (closing_preview) {

        clear_preview_container_layout_locks(container);

        if (close_target_size) {

            target_size = close_target_size;

        } else {

            clear_dialog_size(dialog_el, container);

            await wait_for_next_frame();

            target_size = measure_dialog(dialog_el);

        }

    } else {

        clear_dialog_size(dialog_el, container);

        await wait_for_next_frame();

        target_size = measure_dialog(dialog_el);

    }



    return { target_size, open_target, opening_preview };

}



async function fade_out_old_content(

    fade_el: HTMLElement,

    dialog_el: HTMLDialogElement,

    fade_out_ms: number

): Promise<void> {

    prepare_fade_phase(fade_el, dialog_el, fade_out_ms, '1', '0');

    await wait_ms(fade_out_ms);

}



async function animate_dialog_resize(

    dialog_el: HTMLDialogElement,

    container: HTMLElement,

    start_size: DialogSize,

    target_size: DialogSize,

    resize_ms: number,

    open_target: AuditMediaPreviewOpenTarget | null

): Promise<void> {

    set_view_switch_duration(dialog_el, resize_ms);

    dialog_el.classList.add(DIALOG_SWITCH_CLASS);

    apply_dialog_size(dialog_el, start_size);

    force_reflow(dialog_el);



    if (open_target) {

        fit_audit_media_preview_layout(container, dialog_el);

        container.classList.add(PREVIEW_OPENING_CLASS);

        await wait_for_next_frame();

    }



    await new Promise<void>((resolve) => {

        requestAnimationFrame(() => {

            apply_dialog_size(dialog_el, target_size);

            if (open_target) {

                apply_audit_media_preview_image_dimensions(container, open_target);

            }

            resolve();

        });

    });



    await wait_ms(resize_ms);

}



async function fade_in_new_content(

    fade_el: HTMLElement,

    dialog_el: HTMLDialogElement,

    fade_in_ms: number

): Promise<void> {

    prepare_fade_phase(fade_el, dialog_el, fade_in_ms, '0', '1');

    await wait_ms(fade_in_ms);

}



/**

 * Byter vy sekventiellt: uttoning, storleksbyte (innehåll dolt), intoning.

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



    const fade_el = get_view_switch_fade_el(container);

    const transition_ms = options.transition_ms ?? MODAL_TRANSITION_MS;

    const { fade_out_ms, resize_ms, fade_in_ms } = split_transition_phases(transition_ms);



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



    await fade_out_old_content(fade_el, dialog_el, fade_out_ms);



    apply_change();

    apply_dialog_size(dialog_el, start_size);

    await wait_for_layout(container);



    const { target_size, open_target, opening_preview } = await measure_target_size_after_swap(

        container,

        dialog_el,

        was_preview,

        start_size,

        options.close_target_size

    );



    await animate_dialog_resize(

        dialog_el,

        container,

        start_size,

        target_size,

        resize_ms,

        open_target

    );



    await fade_in_new_content(fade_el, dialog_el, fade_in_ms);



    options.on_transition_complete?.();

    cleanup_transition(dialog_el, container, opening_preview);

}



export { ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS };


