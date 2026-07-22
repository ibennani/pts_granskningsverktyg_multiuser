/**
 * @fileoverview Visningsformat för bristtyper: del 1 som fetstil via markdown, del 2 i samma stycke.
 */
import { escape_html } from '../utils/html_escape.js';

/** Bygger markdown där del 1 blir fetstil och del 2 följer i samma stycke. */
export function build_deficiency_type_display_markdown(primary: string, secondary: string): string {
    const parts: string[] = [];
    if (primary) {
        parts.push(`**${primary}**`);
    }
    if (secondary) {
        parts.push(secondary);
    }
    return parts.join(' ');
}

/** Renderar bristtyp till säker HTML för ett stycke (utan yttre p-tag). */
export function render_deficiency_type_paragraph_html(primary: string, secondary: string): string {
    const parts: string[] = [];
    if (primary) {
        parts.push(`<strong>${escape_html(primary)}</strong>`);
    }
    if (secondary) {
        parts.push(escape_html(secondary));
    }
    return parts.join(' ');
}
