/**
 * @fileoverview Delad rendering av numrerade bristtypslistor för Bilaga 1 (samma som export).
 */
import type { DeficiencyTypeText } from '../export/export_deficiency_types_collect.js';
import { escape_html_internal } from '../export/export_html_build_primitives.js';

export function build_deficiency_list_html(types: DeficiencyTypeText[]): string {
    if (types.length === 0) return '';
    let html = '<ol>';
    for (const entry of types) {
        const primary = escape_html_internal(entry.primary);
        const secondary = entry.secondary ? ` ${escape_html_internal(entry.secondary)}` : '';
        html += `<li><strong>${primary}</strong>${secondary}</li>`;
    }
    html += '</ol>';
    return html;
}

export type Appendix1DeficiencyListDomDeps = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
};

/**
 * Lägger till numrerad bristtypslista under en 3.x-sektion i visningsläge.
 */
export function append_deficiency_types_list_dom(
    deps: Appendix1DeficiencyListDomDeps,
    parent: HTMLElement,
    types: DeficiencyTypeText[]
): void {
    if (types.length === 0) return;

    const wrapper = deps.create_element('div', { class_name: 'appendix1-deficiency-list' });
    const list = deps.create_element('ol');
    for (const entry of types) {
        const item = deps.create_element('li');
        item.appendChild(deps.create_element('strong', { text_content: entry.primary }));
        if (entry.secondary) {
            item.appendChild(document.createTextNode(` ${entry.secondary}`));
        }
        list.appendChild(item);
    }
    wrapper.appendChild(list);
    parent.appendChild(wrapper);
}
