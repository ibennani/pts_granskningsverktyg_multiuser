/**
 * @fileoverview Monterar bildförhandsvisning (bild, bristbeskrivning, layout) i valfri container.
 */

import { fetch_audit_media_blob_url } from '../../api/audit_media_api.js';
import { MODAL_MAX_VIEWPORT_RATIO } from '../../../shared/constants/modal_layout.js';
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

const MEDIA_PREVIEW_VIEWPORT_RATIO = MODAL_MAX_VIEWPORT_RATIO;

type PreviewModalBaseline = {
    dialog_width: number;
    dialog_height: number;
};

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
};

export type MountAuditMediaImagePreviewResult = {
    destroy: () => void;
};

function get_media_preview_viewport_limits(): { max_width: number; max_height: number } {
    return {
        max_width: window.innerWidth * MEDIA_PREVIEW_VIEWPORT_RATIO,
        max_height: window.innerHeight * MEDIA_PREVIEW_VIEWPORT_RATIO
    };
}

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
    const dialog_style = getComputedStyle(dialog_el);
    const padding_y = parse_css_px(dialog_style.paddingTop) + parse_css_px(dialog_style.paddingBottom);
    const gap = parse_css_px(getComputedStyle(container).rowGap)
        || parse_css_px(getComputedStyle(container).gap)
        || 12;
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

    return padding_y + siblings_height + gap * visible_siblings;
}

function compute_max_image_box(
    dialog_el: HTMLDialogElement,
    container: HTMLElement,
    modal_baseline: PreviewModalBaseline | null = null,
    observation_body_height?: number
): { max_width: number; max_height: number } {
    const { max_width, max_height } = get_media_preview_viewport_limits();
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
    dialog_el.style.width = `${baseline.dialog_width}px`;
    dialog_el.style.minWidth = `${baseline.dialog_width}px`;
    dialog_el.style.maxWidth = `${baseline.dialog_width}px`;
    dialog_el.style.minHeight = `${baseline.dialog_height}px`;

    const dialog_style = getComputedStyle(dialog_el);
    const padding_x = parse_css_px(dialog_style.paddingLeft) + parse_css_px(dialog_style.paddingRight);
    const content_width = Math.max(1, baseline.dialog_width - padding_x);
    container.style.width = `${content_width}px`;
    container.style.maxWidth = `${content_width}px`;
    container.style.boxSizing = 'border-box';
    container.dataset.previewLayoutLocked = 'true';

    const observation_block = container.querySelector('.audit-media-preview-observation');
    if (observation_block instanceof HTMLElement) {
        observation_block.style.width = `${content_width}px`;
        observation_block.style.maxWidth = `${content_width}px`;
        observation_block.style.boxSizing = 'border-box';
    }

    const preview_wrap = container.querySelector('.audit-media-preview-wrap');
    if (preview_wrap instanceof HTMLElement) {
        preview_wrap.style.width = `${content_width}px`;
        preview_wrap.style.maxWidth = `${content_width}px`;
        preview_wrap.style.boxSizing = 'border-box';
    }
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

    const dialog_style = getComputedStyle(dialog_el);
    const padding_x = parse_css_px(dialog_style.paddingLeft) + parse_css_px(dialog_style.paddingRight);

    baseline_ref.current = {
        dialog_width: img_width + padding_x,
        dialog_height: Math.round(dialog_rect.height)
    };
    apply_modal_baseline_lock(dialog_el, container, baseline_ref.current);
}

function shrink_preview_if_dialog_overflows(
    preview_img: HTMLImageElement,
    preview_wrap: HTMLElement,
    dialog_el: HTMLDialogElement
): void {
    const { max_height } = get_media_preview_viewport_limits();
    const dialog_height = dialog_el.getBoundingClientRect().height;
    if (dialog_height <= max_height + 1) return;

    const overflow = dialog_height - max_height;
    const img_rect = preview_img.getBoundingClientRect();
    if (img_rect.height <= 1) return;

    const ratio = Math.max(0.01, (img_rect.height - overflow) / img_rect.height);
    set_preview_image_size(preview_img, img_rect.width * ratio, img_rect.height * ratio);

    const wrap_max = parse_css_px(preview_wrap.style.maxHeight);
    if (wrap_max > 0) {
        preview_wrap.style.maxHeight = `${Math.max(1, wrap_max - overflow)}px`;
    }
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

function bind_preview_image_layout(
    preview_img: HTMLImageElement,
    container: HTMLElement,
    dialog_el: HTMLDialogElement | null | undefined
): ObservationLayoutChangeFn {
    const baseline_ref: { current: PreviewModalBaseline | null } = { current: null };

    const remember_modal_baseline = () => {
        if (!dialog_el) return;
        capture_preview_modal_baseline(dialog_el, container, preview_img, baseline_ref);
    };

    const fit_options = (extra: {
        sync_shrink?: boolean;
        observation_body_height?: number;
    } = {}) => ({
        sync_shrink: extra.sync_shrink ?? true,
        modal_baseline: baseline_ref.current,
        observation_body_height: extra.observation_body_height,
        capture_baseline: remember_modal_baseline
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
        fit_preview_image_in_viewport(preview_img, container, dialog_el, fit_options());
    };

    if (preview_img.complete && preview_img.naturalWidth > 0) {
        apply_instant();
    } else {
        preview_img.addEventListener('load', apply_instant, { once: true });
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

    container.classList.remove('modal-content--media-preview');
    container.style.width = '';
    container.style.maxWidth = '';
    container.style.boxSizing = '';
    delete container.dataset.previewLayoutLocked;
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
        trigger_element
    } = options;

    container.classList.add('modal-content--media-preview');
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

    refit_layout = bind_preview_image_layout(preview_img, container, dialog_el ?? null);

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
        }
    };
}

/**
 * Synkar bildförhandsvisningens layout efter storleksanimation i modalen.
 */
export function sync_audit_media_preview_layout(
    container: HTMLElement,
    dialog_el: HTMLDialogElement | null | undefined
): void {
    const preview_img = container.querySelector('.audit-media-preview-image');
    if (!(preview_img instanceof HTMLImageElement) || !dialog_el) return;

    fit_preview_image_in_viewport(preview_img, container, dialog_el, { sync_shrink: true });
    requestAnimationFrame(() => {
        fit_preview_image_in_viewport(preview_img, container, dialog_el, { sync_shrink: true });
    });
}
