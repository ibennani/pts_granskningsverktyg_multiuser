/**
 * @fileoverview Beräknar max höjd för skärmavbild (höjd:bredd högst 3:1).
 */

export const MAX_CAPTURE_HEIGHT_TO_WIDTH_RATIO = 3;

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
