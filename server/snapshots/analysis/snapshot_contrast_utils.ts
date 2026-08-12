/**
 * @fileoverview Kontrastberäkning för snapshot-analys.
 */

function parse_rgb(color: string): { r: number; g: number; b: number; a: number } | null {
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!m) return null;
    return {
        r: Number(m[1]),
        g: Number(m[2]),
        b: Number(m[3]),
        a: m[4] !== undefined ? Number(m[4]) : 1,
    };
}

function relative_luminance(r: number, g: number, b: number): number {
    const transform = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

export function contrast_ratio(fg: string, bg: string): number | null {
    const fg_rgb = parse_rgb(fg);
    const bg_rgb = parse_rgb(bg);
    if (!fg_rgb || !bg_rgb) return null;
    const fg_l = relative_luminance(fg_rgb.r, fg_rgb.g, fg_rgb.b);
    const bg_l = relative_luminance(bg_rgb.r, bg_rgb.g, bg_rgb.b);
    const lighter = Math.max(fg_l, bg_l);
    const darker = Math.min(fg_l, bg_l);
    return (lighter + 0.05) / (darker + 0.05);
}

export function is_large_text_candidate(font_size_px: number, font_weight: number): boolean {
    if (font_size_px >= 24) return true;
    if (font_size_px >= 18.66 && font_weight >= 700) return true;
    return false;
}

export function parse_font_size_px(font_size: string): number {
    const n = Number.parseFloat(font_size);
    return Number.isFinite(n) ? n : 16;
}

export function parse_font_weight(font_weight: string): number {
    const n = Number.parseInt(font_weight, 10);
    return Number.isFinite(n) ? n : 400;
}
