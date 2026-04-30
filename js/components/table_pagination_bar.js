// js/components/table_pagination_bar.js
// Pagineringsrad under tabeller (föregående/nästa, status).

import { clamp_page_index, total_pages, visible_row_range_one_based } from '../logic/table_pagination_logic.js';

/**
 * Bygger tillgänglig pagineringsrad under en tabell.
 *
 * @param {*} create_el - Helpers.create_element
 * @param {Object} opts
 * @param {number} opts.current_page - Nollbaserat sidindex
 * @param {number} opts.total_rows - Antal rader efter sortering
 * @param {number|null} opts.page_size - null = alla rader (returnerar null)
 * @param {function(string, Object=): string} opts.t
 * @param {function(number): void} opts.on_page_change
 */
export function create_table_pagination_element(create_el, opts) {
    const { current_page, total_rows, page_size, t, on_page_change } = opts;
    if (page_size === null || page_size === undefined || total_rows <= 0) {
        return null;
    }

    const nav = create_el('nav', {
        class_name: 'table-pagination-nav',
        attributes: { 'aria-label': t('table_pagination_nav_aria') }
    });

    const clamped = clamp_page_index(current_page, total_rows, page_size);
    const { start, end } = visible_row_range_one_based(clamped, page_size, total_rows);
    const tp = total_pages(total_rows, page_size);

    const controls = create_el('div', { class_name: 'table-pagination-controls' });

    const status = create_el('p', {
        class_name: 'table-pagination-status',
        attributes: { 'aria-live': 'polite', 'aria-atomic': 'true' },
        text_content: t('table_pagination_status', { start, end, total: total_rows })
    });
    controls.appendChild(status);

    const btn_row = create_el('div', { class_name: 'table-pagination-buttons' });

    if (clamped > 0) {
        const prev = create_el('button', {
            class_name: ['button', 'button-default', 'table-pagination-btn'],
            text_content: t('table_pagination_prev'),
            attributes: { type: 'button' }
        });
        prev.addEventListener('click', () => {
            on_page_change(clamped - 1);
        });
        btn_row.appendChild(prev);
    }

    const page_info = create_el('span', {
        class_name: 'table-pagination-page-of',
        text_content: t('table_pagination_page_of', { current: clamped + 1, total_pages: tp })
    });
    btn_row.appendChild(page_info);

    if (clamped < tp - 1) {
        const next = create_el('button', {
            class_name: ['button', 'button-default', 'table-pagination-btn'],
            text_content: t('table_pagination_next'),
            attributes: { type: 'button' }
        });
        next.addEventListener('click', () => {
            on_page_change(clamped + 1);
        });
        btn_row.appendChild(next);
    }

    controls.appendChild(btn_row);
    nav.appendChild(controls);
    return nav;
}
