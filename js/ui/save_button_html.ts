/**
 * @fileoverview Gemensam HTML för spara-knappar: etikett och diskett-ikon dold för skärmlysare.
 */

import { escape_html } from '../utils/html_escape.js';
import { get_icon_svg as default_get_icon_svg } from './icons.js';

export type GetIconSvgFn = (name: string, colors?: string[], size?: number) => string;

/**
 * Bygger innehåll för en spara-knapp: text till vänster, diskett-ikon till höger (aria-hidden).
 */
export function build_save_button_html_content(
    label: string,
    get_icon_svg: GetIconSvgFn = default_get_icon_svg,
    icon_size = 16
): string {
    const icon = get_icon_svg('save', ['currentColor'], icon_size);
    return `<span>${escape_html(label)}</span><span aria-hidden="true">${icon}</span>`;
}
