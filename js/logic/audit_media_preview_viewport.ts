/**
 * @fileoverview Viewport-tak och storleksbegränsning för bildförhandsvisning i modal.
 */

import { MODAL_MAX_VIEWPORT_RATIO } from '../../shared/constants/modal_layout.js';

export type ViewportSize = {
    width: number;
    height: number;
};

/** Returnerar maximal modalstorlek i px (90 % av viewport). */
export function get_media_preview_viewport_limits(): ViewportSize {
    if (typeof window === 'undefined') {
        return { width: 1, height: 1 };
    }
    return {
        width: window.innerWidth * MODAL_MAX_VIEWPORT_RATIO,
        height: window.innerHeight * MODAL_MAX_VIEWPORT_RATIO
    };
}

/** Begränsar dialogmått till viewport-tak. */
export function clamp_dialog_size_to_viewport(size: ViewportSize): ViewportSize {
    const limits = get_media_preview_viewport_limits();
    return {
        width: Math.max(1, Math.min(Math.round(size.width), Math.round(limits.width))),
        height: Math.max(1, Math.min(Math.round(size.height), Math.round(limits.height)))
    };
}

function parse_css_px(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function set_preview_image_size(preview_img: HTMLImageElement, width: number, height: number): void {
    const safe_width = Math.max(1, Math.round(width));
    const safe_height = Math.max(1, Math.round(height));
    preview_img.style.width = `${safe_width}px`;
    preview_img.style.height = `${safe_height}px`;
}

/**
 * Krymper bilden iterativt tills dialogen ryms inom viewport-tak (bredd och höjd).
 */
export function ensure_preview_fits_viewport_limits(
    preview_img: HTMLImageElement,
    preview_wrap: HTMLElement,
    dialog_el: HTMLDialogElement,
    max_iterations = 8
): void {
    const { max_width, max_height } = get_media_preview_viewport_limits();

    for (let iteration = 0; iteration < max_iterations; iteration += 1) {
        const dialog_rect = dialog_el.getBoundingClientRect();
        const overflow_x = dialog_rect.width - max_width;
        const overflow_y = dialog_rect.height - max_height;
        if (overflow_x <= 1 && overflow_y <= 1) {
            return;
        }

        const img_rect = preview_img.getBoundingClientRect();
        if (img_rect.width <= 1 || img_rect.height <= 1) {
            return;
        }

        let next_width = img_rect.width;
        let next_height = img_rect.height;

        if (overflow_y > 1) {
            const ratio = Math.max(0.01, (img_rect.height - overflow_y) / img_rect.height);
            next_width = img_rect.width * ratio;
            next_height = img_rect.height * ratio;
        }

        if (overflow_x > 1 && next_width > 1) {
            const ratio = Math.max(0.01, (next_width - overflow_x) / next_width);
            next_width *= ratio;
            next_height *= ratio;
        }

        set_preview_image_size(preview_img, next_width, next_height);

        const wrap_max_height = parse_css_px(preview_wrap.style.maxHeight);
        if (wrap_max_height > 0 && overflow_y > 1) {
            preview_wrap.style.maxHeight = `${Math.max(1, wrap_max_height - overflow_y)}px`;
        }

        const wrap_max_width = parse_css_px(preview_wrap.style.maxWidth);
        if (wrap_max_width > 0 && overflow_x > 1) {
            preview_wrap.style.maxWidth = `${Math.max(1, wrap_max_width - overflow_x)}px`;
        }
    }
}
