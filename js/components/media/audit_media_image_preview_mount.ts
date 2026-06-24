/**
 * @fileoverview Monterar bildförhandsvisning (bild, bristbeskrivning, layout) i valfri container.
 */

import { fetch_audit_media_blob_url } from '../../api/audit_media_api.js';
import {
    clamp_dialog_size_to_viewport,
    ensure_preview_fits_viewport_limits,
    get_media_preview_viewport_limits
} from '../../logic/audit_media_preview_viewport.js';
import { append_audit_media_preview_observation_block } from './audit_media_preview_observation.js';
import type {
    AuditMediaObservationEditOptions,
    ObservationLayoutChangeFn,
    ObservationLayoutChangeOptions
} from './audit_media_preview_observation.js';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type HelpersLike = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
};

type PreviewModalBaseline = {
    dialog_width: number;
    dialog_height: number;
};

function get_modal_shell(container: HTMLElement): HTMLElement {
    return (container.closest('.modal-content') as HTMLElement | null) ?? container;
}

function measure_modal_header_height(shell_el: HTMLElement): number {
    const header = shell_el.querySelector('.modal-header');
    if (!(header instanceof HTMLElement)) return 0;
    return Math.round(header.getBoundingClientRect().height);
}

export type MountAuditMediaImagePreviewOptions = {
    t: TranslateFn;
    Helpers: HelpersLike;
    audit_id: string;
    filename: string;
    blob_url?: string | null;
    observation_detail?: string | null;
    observation_edit?: AuditMediaObservationEditOptions | null;
    close_button_label: string;
    on_close: (focus_target: HTMLElement | null) => void;
    trigger_element?: HTMLElement | null;
    /** Skjuter upp breddlås tills modalens storleksanimation är klar (Bifoga media). */
    defer_baseline_lock?: boolean;
};

export type MountAuditMediaImagePreviewResult = {
    destroy: () => void;
    finalize_layout: () => void;
};

function parse_css_px(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function is_visible_modal_child(child: Element): child is HTMLElement {
    if (!(child instanceof HTMLElement)) return false;
    const style = getComputedStyle(child);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return child.getBoundingClientRect().height > 0 || child.classList.contains('audit-media-preview-close-btn');
}

function measure_non_image_chrome_height(
    dialog_el: HTMLDialogElement,
    container: HTMLElement,
    observation_body_height?: number
): number {
    const shell_el = get_modal_shell(container);
    const dialog_style = getComputedStyle(dialog_el);
    const padding_y = parse_css_px(dialog_style.paddingTop) + parse_css_px(dialog_style.paddingBottom);
    const gap = parse_css_px(getComputedStyle(shell_el).rowGap)
        || parse_css_px(getComputedStyle(shell_el).gap)
        || 12;
    const header_height = measure_modal_header_height(shell_el);
    const preview_wrap = container.querySelector('.audit-media-preview-wrap');
    const observation_block = container.querySelector('.audit-media-preview-observation');
    const observation_body = observation_block?.querySelector('.audit-media-preview-observation__body');

    let siblings_height = 0;
    let visible_siblings = 0;

    for (const child of container.children) {
        if (child === preview_wrap || !is_visible_modal_child(child)) continue;

        if (
            observation_body_height !== undefined
            && child === observation_block
            && observation_block instanceof HTMLElement
            && observation_body instanceof HTMLElement
        ) {
            const block_height = observation_block.getBoundingClientRect().height;
            const live_body_height = observation_body.getBoundingClientRect().height;
            const block_without_body = Math.max(0, block_height - live_body_height);
            siblings_height += block_without_body + observation_body_height;
            visible_siblings += 1;
            continue;
        }

        siblings_height += child.getBoundingClientRect().height;
        visible_siblings += 1;
    }

    const header_gap = header_height > 0 ? gap : 0;
    const body_gap = visible_siblings > 0 ? gap * Math.max(0, visible_siblings - 1) : 0;

    return padding_y + header_height + header_gap + siblings_height + body_gap;
}

function compute_max_image_box(
    dialog_el: HTMLDialogElement,
    container: HTMLElement,
    modal_baseline: PreviewModalBaseline | null = null,
    observation_body_height?: number
): { max_width: number; max_height: number } {
    const { width: max_width, height: max_height } = get_media_preview_viewport_limits();
    const dialog_style = getComputedStyle(dialog_el);
    const padding_x = parse_css_px(dialog_style.paddingLeft) + parse_css_px(dialog_style.paddingRight);
    const padding_y = parse_css_px(dialog_style.paddingTop) + parse_css_px(dialog_style.paddingBottom);
    const chrome_height = measure_non_image_chrome_height(
        dialog_el,
        container,
        observation_body_height
    );

    const content_max_width = modal_baseline
        ? Math.max(1, modal_baseline.dialog_width - padding_x)
        : Math.max(1, max_width - padding_x);

    const dialog_height = Math.max(
        dialog_el.getBoundingClientRect().height,
        modal_baseline?.dialog_height ?? 0
    );

    return {
        max_width: Math.max(1, Math.min(max_width - padding_x, content_max_width)),
        max_height: Math.max(1, Math.min(
            max_height - chrome_height,
            dialog_height - padding_y - chrome_height
        ))
    };
}

function set_preview_image_size(preview_img: HTMLImageElement, width: number, height: number): void {
    const safe_width = Math.max(1, Math.round(width));
    const safe_height = Math.max(1, Math.round(height));
    preview_img.style.width = `${safe_width}px`;
    preview_img.style.height = `${safe_height}px`;
}

function apply_modal_baseline_lock(
    dialog_el: HTMLDialogElement,
    container: HTMLElement,
    baseline: PreviewModalBaseline
): void {
    const capped = clamp_dialog_size_to_viewport({
        width: baseline.dialog_width,
        height: baseline.dialog_height
    });
    const { width: max_width, height: max_height } = get_media_preview_viewport_limits();

    dialog_el.style.width = `${capped.width}px`;
    dialog_el.style.minWidth = `${capped.width}px`;
    dialog_el.style.maxWidth = `${max_width}px`;
    dialog_el.style.height = `${capped.height}px`;
    dialog_el.style.minHeight = `${capped.height}px`;
    dialog_el.style.maxHeight = `${max_height}px`;

    const shell_el = get_modal_shell(container);
    shell_el.dataset.previewLayoutLocked = 'true';
    container.dataset.previewLayoutLocked = 'true';
}

function measure_heading_single_line_width(container: HTMLElement): number {
    const shell_el = get_modal_shell(container);
    const heading = shell_el.querySelector('#modal-dialog-title');
    if (!(heading instanceof HTMLElement)) return 0;

    const previous_white_space = heading.style.whiteSpace;
    heading.style.whiteSpace = 'nowrap';
    const width = Math.ceil(heading.scrollWidth);
    heading.style.whiteSpace = previous_white_space;
    return width;
}

function get_preview_dialog_padding_x(dialog_el: HTMLDialogElement): number {
    const dialog_style = getComputedStyle(dialog_el);
    return parse_css_px(dialog_style.paddingLeft) + parse_css_px(dialog_style.paddingRight);
}

function get_preview_content_max_width(dialog_el: HTMLDialogElement): number {
    const { width: max_width } = get_media_preview_viewport_limits();
    return Math.max(1, max_width - get_preview_dialog_padding_x(dialog_el));
}

function sync_preview_heading_layout_mode(
    container: HTMLElement,
    dialog_el: HTMLDialogElement
): void {
    const shell_el = get_modal_shell(container);
    const heading = shell_el.querySelector('#modal-dialog-title');
    if (!(heading instanceof HTMLElement)) return;

    const wrap_at_cap = measure_heading_single_line_width(container)
        > get_preview_content_max_width(dialog_el);
    heading.classList.toggle('modal-heading--wrap-at-cap', wrap_at_cap);
}

function resolve_preview_dialog_width(
    dialog_el: HTMLDialogElement,
    container: HTMLElement,
    preview_img: HTMLImageElement
): number {
    const { width: max_width } = get_media_preview_viewport_limits();
    const dialog_style = getComputedStyle(dialog_el);
    const padding_x =
        parse_css_px(dialog_style.paddingLeft) + parse_css_px(dialog_style.paddingRight);
    const img_width = Math.max(1, Math.round(preview_img.getBoundingClientRect().width));
    const heading_width = measure_heading_single_line_width(container);
    const content_width = Math.max(img_width, heading_width);

    return Math.min(max_width, Math.max(1, content_width + padding_x));
}

function capture_preview_modal_baseline(
    dialog_el: HTMLDialogElement,
    container: HTMLElement,
    preview_img: HTMLImageElement,
    baseline_ref: { current: PreviewModalBaseline | null }
): void {
    if (baseline_ref.current) return;

    const img_width = Math.round(preview_img.getBoundingClientRect().width);
    if (img_width < 1) return;

    const dialog_rect = dialog_el.getBoundingClientRect();
    if (dialog_rect.height < 1) return;

    sync_preview_heading_layout_mode(container, dialog_el);

    const dialog_width = resolve_preview_dialog_width(dialog_el, container, preview_img);
    dialog_el.style.width = `${dialog_width}px`;
    dialog_el.style.minWidth = `${dialog_width}px`;
    dialog_el.style.maxWidth = `${dialog_width}px`;
    fit_audit_media_preview_layout(container, dialog_el);

    const measured_height = Math.round(dialog_el.getBoundingClientRect().height);
    if (measured_height < 1) return;

    const capped = clamp_dialog_size_to_viewport({
        width: dialog_width,
        height: measured_height
    });
    baseline_ref.current = {
        dialog_width: capped.width,
        dialog_height: capped.height
    };
    apply_modal_baseline_lock(dialog_el, container, baseline_ref.current);
}

function shrink_preview_if_dialog_overflows(
    preview_img: HTMLImageElement,
    preview_wrap: HTMLElement,
    dialog_el: HTMLDialogElement
): void {
    ensure_preview_fits_viewport_limits(preview_img, preview_wrap, dialog_el);
}

function sync_dialog_size_to_content(
    dialog_el: HTMLDialogElement,
    container: HTMLElement,
    preview_img: HTMLImageElement
): void {
    fit_audit_media_preview_layout(container, dialog_el);

    const preview_wrap = preview_img.closest('.audit-media-preview-wrap');
    if (!(preview_wrap instanceof HTMLElement)) {
        return;
    }

    const { width: max_width, height: max_height } = get_media_preview_viewport_limits();
    sync_preview_heading_layout_mode(container, dialog_el);

    const dialog_width = clamp_dialog_size_to_viewport({
        width: resolve_preview_dialog_width(dialog_el, container, preview_img),
        height: 1
    }).width;

    dialog_el.style.width = `${dialog_width}px`;
    dialog_el.style.minWidth = `${dialog_width}px`;
    dialog_el.style.maxWidth = `${max_width}px`;

    ensure_preview_fits_viewport_limits(preview_img, preview_wrap, dialog_el);

    const measured_height = clamp_dialog_size_to_viewport({
        width: dialog_width,
        height: Math.round(dialog_el.getBoundingClientRect().height)
    }).height;

    dialog_el.style.height = `${measured_height}px`;
    dialog_el.style.minHeight = `${measured_height}px`;
    dialog_el.style.maxHeight = `${max_height}px`;
}

function fit_preview_image_in_viewport(
    preview_img: HTMLImageElement,
    container: HTMLElement,
    dialog_el: HTMLDialogElement | null | undefined,
    options: {
        sync_shrink?: boolean;
        modal_baseline?: PreviewModalBaseline | null;
        observation_body_height?: number;
        capture_baseline?: () => void;
    } = {}
): void {
    const preview_wrap = preview_img.closest('.audit-media-preview-wrap');
    if (!(preview_wrap instanceof HTMLElement) || !dialog_el) return;

    const modal_baseline = options.modal_baseline ?? null;
    if (modal_baseline) {
        apply_modal_baseline_lock(dialog_el, container, modal_baseline);
    }

    const { max_width, max_height } = compute_max_image_box(
        dialog_el,
        container,
        modal_baseline,
        options.observation_body_height
    );
    preview_wrap.style.maxWidth = `${max_width}px`;
    preview_wrap.style.maxHeight = `${max_height}px`;

    const natural_width = preview_img.naturalWidth;
    const natural_height = preview_img.naturalHeight;
    if (natural_width <= 0 || natural_height <= 0) return;

    const scale = Math.min(1, max_width / natural_width, max_height / natural_height);
    set_preview_image_size(preview_img, natural_width * scale, natural_height * scale);

    if (!modal_baseline && options.capture_baseline) {
        options.capture_baseline();
    }

    if (options.sync_shrink) {
        shrink_preview_if_dialog_overflows(preview_img, preview_wrap, dialog_el);
        return;
    }

    requestAnimationFrame(() => {
        shrink_preview_if_dialog_overflows(preview_img, preview_wrap, dialog_el);
    });
}

type BindPreviewImageLayoutOptions = {
    defer_baseline_lock?: boolean;
};

function bind_preview_image_layout(
    preview_img: HTMLImageElement,
    container: HTMLElement,
    dialog_el: HTMLDialogElement | null | undefined,
    layout_options: BindPreviewImageLayoutOptions = {}
): ObservationLayoutChangeFn {
    const defer_baseline_lock = layout_options.defer_baseline_lock ?? false;
    const baseline_ref: { current: PreviewModalBaseline | null } = { current: null };

    const remember_modal_baseline = () => {
        if (!dialog_el) return;
        capture_preview_modal_baseline(dialog_el, container, preview_img, baseline_ref);
    };

    const fit_options = (
        extra: {
            sync_shrink?: boolean;
            observation_body_height?: number;
        } = {},
        allow_baseline_capture = !defer_baseline_lock
    ) => ({
        sync_shrink: extra.sync_shrink ?? true,
        modal_baseline: baseline_ref.current,
        observation_body_height: extra.observation_body_height,
        capture_baseline: allow_baseline_capture ? remember_modal_baseline : undefined
    });

    const apply_instant = () => {
        fit_preview_image_in_viewport(
            preview_img,
            container,
            dialog_el,
            fit_options({ sync_shrink: true })
        );
        requestAnimationFrame(() => {
            fit_preview_image_in_viewport(
                preview_img,
                container,
                dialog_el,
                fit_options({ sync_shrink: true })
            );
        });
    };

    const run_parallel_layout_transition = (
        layout_options: ObservationLayoutChangeOptions
    ): void => {
        const target_body_height = layout_options.observation_body_height_to;
        if (target_body_height === undefined) {
            apply_instant();
            return;
        }

        fit_preview_image_in_viewport(preview_img, container, dialog_el, fit_options({
            observation_body_height: target_body_height
        }));
    };

    const apply_finalize = () => {
        fit_preview_image_in_viewport(
            preview_img,
            container,
            dialog_el,
            fit_options({ sync_shrink: true }, !defer_baseline_lock)
        );

        if (defer_baseline_lock && !baseline_ref.current && dialog_el) {
            sync_dialog_size_to_content(dialog_el, container, preview_img);
            const dialog_width = Math.round(dialog_el.getBoundingClientRect().width);
            const dialog_height = Math.round(dialog_el.getBoundingClientRect().height);
            if (dialog_width >= 1 && dialog_height >= 1) {
                const capped = clamp_dialog_size_to_viewport({
                    width: dialog_width,
                    height: dialog_height
                });
                baseline_ref.current = {
                    dialog_width: capped.width,
                    dialog_height: capped.height
                };
                apply_modal_baseline_lock(dialog_el, container, baseline_ref.current);
            } else {
                remember_modal_baseline();
            }
            fit_preview_image_in_viewport(
                preview_img,
                container,
                dialog_el,
                fit_options({ sync_shrink: true }, true)
            );
            return;
        }

        fit_preview_image_in_viewport(preview_img, container, dialog_el, fit_options({}, true));
    };

    if (!defer_baseline_lock) {
        if (preview_img.complete && preview_img.naturalWidth > 0) {
            apply_instant();
        } else {
            preview_img.addEventListener('load', apply_instant, { once: true });
        }
    }

    return (options) => {
        if (options?.finalize) {
            apply_finalize();
            return;
        }
        if (options?.animated && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            run_parallel_layout_transition(options);
            return;
        }
        apply_instant();
    };
}

/**
 * Tar bort bildförhandsvisningens DOM-noder utan att röra övrigt modalinnehåll.
 */
export function unmount_audit_media_image_preview_content(container: HTMLElement): void {
    const selectors = [
        '.audit-media-preview-wrap',
        '.audit-media-preview-observation',
        '.audit-media-preview-close-btn'
    ];
    for (const selector of selectors) {
        container.querySelectorAll(selector).forEach((node) => {
            node.remove();
        });
    }
}

/**
 * Tar bort förhandsvisningens DOM och klasser men behåller dialogens px-storlek (stängningsanimation).
 */
export function teardown_audit_media_preview_for_view_switch(
    dialog_el: HTMLDialogElement | null | undefined,
    container: HTMLElement
): void {
    if (dialog_el) {
        dialog_el.classList.remove('modal-dialog--media-preview');
    }

    const shell_el = get_modal_shell(container);
    shell_el.classList.remove('modal-content--media-preview');
    container.classList.remove('modal-body--media-preview');

    const heading = shell_el.querySelector('#modal-dialog-title');
    if (heading instanceof HTMLElement) {
        heading.classList.remove('modal-heading--wrap-at-cap');
    }

    unmount_audit_media_image_preview_content(container);
}

/**
 * Återställer inline-layout efter bildförhandsvisning i dialog.
 */
export function reset_audit_media_preview_layout(
    dialog_el: HTMLDialogElement | null | undefined,
    container: HTMLElement
): void {
    if (dialog_el) {
        dialog_el.style.width = '';
        dialog_el.style.minWidth = '';
        dialog_el.style.maxWidth = '';
        dialog_el.style.minHeight = '';
        dialog_el.classList.remove('modal-dialog--media-preview');
    }

    const shell_el = get_modal_shell(container);
    shell_el.classList.remove('modal-content--media-preview');
    shell_el.style.width = '';
    shell_el.style.maxWidth = '';
    shell_el.style.boxSizing = '';
    delete shell_el.dataset.previewLayoutLocked;

    container.classList.remove('modal-body--media-preview');
    container.style.width = '';
    container.style.maxWidth = '';
    container.style.boxSizing = '';
    delete container.dataset.previewLayoutLocked;

    const heading = shell_el.querySelector('#modal-dialog-title');
    if (heading instanceof HTMLElement) {
        heading.classList.remove('modal-heading--wrap-at-cap');
    }

    unmount_audit_media_image_preview_content(container);
}

/**
 * Monterar samma bildförhandsvisning som fristående modal, i given container.
 */
export function mount_audit_media_image_preview(
    container: HTMLElement,
    dialog_el: HTMLDialogElement | null | undefined,
    options: MountAuditMediaImagePreviewOptions
): MountAuditMediaImagePreviewResult {
    const {
        t,
        Helpers,
        audit_id,
        filename,
        blob_url,
        observation_detail,
        observation_edit,
        close_button_label,
        on_close,
        trigger_element,
        defer_baseline_lock = false
    } = options;

    container.classList.add('modal-body--media-preview');
    get_modal_shell(container).classList.add('modal-content--media-preview');
    dialog_el?.classList.add('modal-dialog--media-preview');

    const preview_wrap = Helpers.create_element('div', {
        class_name: 'audit-media-preview-wrap'
    });
    const preview_img = Helpers.create_element('img', {
        class_name: 'audit-media-preview-image',
        attributes: { alt: filename }
    }) as HTMLImageElement;
    preview_wrap.appendChild(preview_img);
    container.appendChild(preview_wrap);

    let refit_layout: ObservationLayoutChangeFn = () => {};

    append_audit_media_preview_observation_block(
        container,
        Helpers,
        t,
        observation_detail,
        observation_edit,
        (layout_options) => {
            refit_layout(layout_options);
        }
    );

    const close_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-primary', 'audit-media-preview-close-btn'],
        attributes: { type: 'button' },
        text_content: close_button_label
    });
    close_btn.addEventListener('click', () => {
        on_close(trigger_element || close_btn);
    });
    container.appendChild(close_btn);

    refit_layout = bind_preview_image_layout(preview_img, container, dialog_el ?? null, {
        defer_baseline_lock
    });

    if (dialog_el) {
        sync_preview_heading_layout_mode(container, dialog_el);
    }

    const set_preview_src = (url: string | null | undefined) => {
        if (url) {
            preview_img.src = url;
        }
    };

    if (blob_url) {
        set_preview_src(blob_url);
    } else {
        void fetch_audit_media_blob_url(audit_id, filename).then(set_preview_src);
    }

    return {
        destroy: () => {
            reset_audit_media_preview_layout(dialog_el, container);
        },
        finalize_layout: () => {
            refit_layout({ finalize: true });
        }
    };
}

/**
 * Anpassar bildförhandsvisningens layout till aktuell dialogstorlek (ett pass).
 */
export function fit_audit_media_preview_layout(
    container: HTMLElement,
    dialog_el: HTMLDialogElement | null | undefined
): void {
    const preview_img = container.querySelector('.audit-media-preview-image');
    if (!(preview_img instanceof HTMLImageElement) || !dialog_el) return;

    fit_preview_image_in_viewport(preview_img, container, dialog_el, { sync_shrink: true });
}

export type AuditMediaPreviewImageDimensions = {
    img_width: number;
    img_height: number;
    wrap_max_width: number;
    wrap_max_height: number;
};

export type AuditMediaPreviewOpenTarget = AuditMediaPreviewImageDimensions & {
    dialog_width: number;
    dialog_height: number;
};

type PreviewOpenMeasureOptions = {
    /** Behåll liststorlek synlig medan mått tas (mätning sker dolt). */
    lock_size_during_measure?: { width: number; height: number };
};

function apply_dialog_px_size(
    dialog_el: HTMLDialogElement,
    width: number,
    height: number
): void {
    dialog_el.style.width = `${width}px`;
    dialog_el.style.minWidth = `${width}px`;
    dialog_el.style.maxWidth = `${width}px`;
    dialog_el.style.height = `${height}px`;
    dialog_el.style.minHeight = `${height}px`;
}

function clear_dialog_px_size(dialog_el: HTMLDialogElement): void {
    dialog_el.style.width = '';
    dialog_el.style.minWidth = '';
    dialog_el.style.maxWidth = '';
    dialog_el.style.height = '';
    dialog_el.style.minHeight = '';
}

/**
 * Styr rubrikens radbrytning när filnamnet är bredare än viewport-taket (90 vw).
 */
export function sync_audit_media_preview_heading_layout(
    container: HTMLElement,
    dialog_el: HTMLDialogElement
): void {
    sync_preview_heading_layout_mode(container, dialog_el);
}

/**
 * Mäter dialog- och bildmått efter full layout (före öppningsanimation).
 */
export function capture_audit_media_preview_open_target(
    container: HTMLElement,
    dialog_el: HTMLDialogElement,
    options: PreviewOpenMeasureOptions = {}
): AuditMediaPreviewOpenTarget | null {
    const preview_img = container.querySelector('.audit-media-preview-image');
    const preview_wrap = preview_img?.closest('.audit-media-preview-wrap');
    if (!(preview_img instanceof HTMLImageElement) || !(preview_wrap instanceof HTMLElement)) {
        return null;
    }

    const lock_size = options.lock_size_during_measure ?? null;
    const previous_visibility = dialog_el.style.visibility;

    if (lock_size) {
        dialog_el.style.visibility = 'hidden';
    }

    clear_dialog_px_size(dialog_el);

    sync_preview_heading_layout_mode(container, dialog_el);

    sync_dialog_size_to_content(dialog_el, container, preview_img);

    const img_rect = preview_img.getBoundingClientRect();
    if (img_rect.width < 1 || img_rect.height < 1) {
        if (lock_size) {
            apply_dialog_px_size(dialog_el, lock_size.width, lock_size.height);
            dialog_el.style.visibility = previous_visibility;
        } else {
            clear_dialog_px_size(dialog_el);
        }
        return null;
    }

    const capped_dialog = clamp_dialog_size_to_viewport({
        width: Math.round(dialog_el.getBoundingClientRect().width),
        height: Math.round(dialog_el.getBoundingClientRect().height)
    });
    const dialog_width = capped_dialog.width;
    const dialog_height = capped_dialog.height;

    dialog_el.style.width = `${dialog_width}px`;
    dialog_el.style.minWidth = `${dialog_width}px`;
    dialog_el.style.height = `${dialog_height}px`;
    dialog_el.style.minHeight = `${dialog_height}px`;

    const wrap_max_width = parse_css_px(preview_wrap.style.maxWidth) || img_rect.width;
    const wrap_max_height = parse_css_px(preview_wrap.style.maxHeight) || img_rect.height;

    const open_target: AuditMediaPreviewOpenTarget = {
        dialog_width,
        dialog_height,
        img_width: img_rect.width,
        img_height: img_rect.height,
        wrap_max_width: Math.max(1, wrap_max_width),
        wrap_max_height: Math.max(1, wrap_max_height)
    };

    if (lock_size) {
        apply_dialog_px_size(dialog_el, lock_size.width, lock_size.height);
        dialog_el.style.visibility = previous_visibility;
    } else {
        clear_dialog_px_size(dialog_el);
    }

    return open_target;
}

/**
 * Sätter bildmått — används tillsammans med CSS-transition vid öppning.
 */
export function apply_audit_media_preview_image_dimensions(
    container: HTMLElement,
    dimensions: AuditMediaPreviewImageDimensions
): void {
    const preview_img = container.querySelector('.audit-media-preview-image');
    const preview_wrap = preview_img?.closest('.audit-media-preview-wrap');
    if (!(preview_img instanceof HTMLImageElement) || !(preview_wrap instanceof HTMLElement)) {
        return;
    }

    preview_wrap.style.maxWidth = `${Math.round(dimensions.wrap_max_width)}px`;
    preview_wrap.style.maxHeight = `${Math.round(dimensions.wrap_max_height)}px`;
    set_preview_image_size(preview_img, dimensions.img_width, dimensions.img_height);
}

/** @deprecated Använd fit_audit_media_preview_layout */
export function sync_audit_media_preview_layout(
    container: HTMLElement,
    dialog_el: HTMLDialogElement | null | undefined
): void {
    fit_audit_media_preview_layout(container, dialog_el);
}
