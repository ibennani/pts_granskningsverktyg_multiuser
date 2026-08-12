/**
 * @fileoverview Beräknar max höjd för skärmavbild (höjd:bredd högst 3:1).
 */

export const MAX_CAPTURE_HEIGHT_TO_WIDTH_RATIO = 3;

export const DEFAULT_FULL_DOCUMENT_MAX_HEIGHT_CSS = 50_000;

/**
 * Returnerar clip-höjd i CSS-pixlar: hela sidan om den är kort nog, annars capad till max_ratio × bredd.
 */
export function compute_screenshot_clip_height_css(
    scroll_height_css: number,
    viewport_width_css: number,
    max_ratio = MAX_CAPTURE_HEIGHT_TO_WIDTH_RATIO
): number {
    const safe_height = Math.max(1, Math.floor(scroll_height_css));
    const max_height = Math.floor(viewport_width_css * max_ratio);
    return Math.min(safe_height, max_height);
}

/**
 * Returnerar clip-höjd för hela dokumentet, med absolut maxhöjd som skydd mot extremt långa sidor.
 */
export function compute_full_document_screenshot_height_css(
    scroll_height_css: number,
    max_height_css = DEFAULT_FULL_DOCUMENT_MAX_HEIGHT_CSS
): number {
    const safe_height = Math.max(1, Math.floor(scroll_height_css));
    const safe_max = Math.max(1, Math.floor(max_height_css));
    return Math.min(safe_height, safe_max);
}
