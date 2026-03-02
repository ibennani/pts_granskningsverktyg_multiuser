// js/components/GenericTableComponent.js
// Generell tabellkomponent för återanvändning i flera vyer. Tar kolumndefinitioner och data.

export const GenericTableComponent = {
    CSS_PATH: './css/components/generic_table_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.Helpers = deps.Helpers;

        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH, 'GenericTableComponent', {
                timeout: 5000,
                maxRetries: 2
            }).catch(() => {});
        }
    },

    /**
     * @param {Object} opts
     * @param {HTMLElement} [opts.root] - Om angiven används denna istället för this.root (för flera tabeller från samma vy).
     * @param {Array<{ headerLabel: string, getContent: (row: any) => string | HTMLElement, getSortValue?: (row: any) => string | number, isAction?: boolean }>} opts.columns
     * @param {Array<any>} opts.data
     * @param {string} opts.emptyMessage - Text när data är tom.
     * @param {string} opts.ariaLabel
     * @param {string} [opts.wrapperClassName] - T.ex. 'generic-table-wrapper'.
     * @param {string} [opts.tableClassName] - T.ex. 'generic-table generic-table--audit-list'.
     * @param {{ columnIndex: number, direction: 'asc'|'desc' }} [opts.sortState] - Aktiv sortering.
     * @param {function(number, 'asc'|'desc')} [opts.onSort] - Anropas vid klick på rubrik (columnIndex, direction). Krävs för sorterbara rubriker.
     * @param {function(string): string} [opts.t] - Översättningsfunktion för sorteringsknappar (aria-label).
     */
    render(opts) {
        const root_el = opts.root ?? this.root;
        if (!root_el || !this.Helpers?.create_element) return;

        const { columns, data, emptyMessage, ariaLabel, sortState, onSort } = opts;
        const t = opts.t || (() => '');
        const wrapper_class = opts.wrapperClassName ?? 'generic-table-wrapper';
        const table_class = opts.tableClassName ?? 'generic-table';

        root_el.innerHTML = '';

        let data_to_render = data && data.length > 0 ? [...data] : [];
        const active_sort_col = sortState && columns[sortState.columnIndex];
        const get_sort_value = active_sort_col?.getSortValue;
        if (get_sort_value && data_to_render.length > 0 && typeof sortState.direction === 'string') {
            const dir = sortState.direction === 'desc' ? -1 : 1;
            data_to_render.sort((a, b) => {
                const va = get_sort_value(a);
                const vb = get_sort_value(b);
                const a_empty = va === '' || va === null || va === undefined;
                const b_empty = vb === '' || vb === null || vb === undefined;
                if (a_empty && b_empty) return 0;
                if (a_empty) return 1;
                if (b_empty) return -1;
                if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
                const sa = String(va);
                const sb = String(vb);
                return sa.localeCompare(sb, undefined, { numeric: true }) * dir;
            });
        }

        const wrapper = this.Helpers.create_element('div', { class_name: wrapper_class });
        const live_region = this.Helpers.create_element('div', {
            class_name: 'visually-hidden',
            attributes: { 'aria-live': 'polite', 'aria-atomic': 'true' }
        });
        wrapper.appendChild(live_region);
        const table = this.Helpers.create_element('table', {
            class_name: table_class,
            attributes: { 'aria-label': ariaLabel }
        });
        const caption = this.Helpers.create_element('caption', {
            class_name: 'visually-hidden',
            text_content: ariaLabel
        });
        table.appendChild(caption);

        const thead = this.Helpers.create_element('thead');
        const header_row = this.Helpers.create_element('tr');
        columns.forEach((col, col_index) => {
            const is_sortable = typeof col.getSortValue === 'function' && typeof onSort === 'function';
            const is_active = sortState && sortState.columnIndex === col_index;
            const direction = is_active ? sortState.direction : 'asc';

            const th_attrs = { 'scope': 'col' };
            if (is_sortable) {
                th_attrs['aria-sort'] = is_active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none';
            }
            const th = this.Helpers.create_element('th', {
                attributes: th_attrs
            });

            if (is_sortable) {
                const btn = this.Helpers.create_element('button', {
                    type: 'button',
                    class_name: 'generic-table-header-sort-btn',
                    text_content: col.headerLabel,
                    attributes: {
                        'aria-label': is_active
                            ? t('generic_table_sort_aria_active', { label: col.headerLabel, direction: direction === 'asc' ? t('generic_table_sort_asc') : t('generic_table_sort_desc') })
                            : t('generic_table_sort_aria', { label: col.headerLabel })
                    }
                });
                btn.addEventListener('click', () => {
                    const next_dir = is_active && direction === 'asc' ? 'desc' : 'asc';
                    this._pendingSortFocusIndex = col_index;
                    onSort(col_index, next_dir);
                });
                th.appendChild(btn);
            } else {
                th.textContent = col.headerLabel;
            }
            header_row.appendChild(th);
        });
        thead.appendChild(header_row);
        table.appendChild(thead);

        const tbody = this.Helpers.create_element('tbody');
        if (data_to_render.length === 0) {
            const empty_row = this.Helpers.create_element('tr');
            empty_row.appendChild(
                this.Helpers.create_element('td', {
                    text_content: emptyMessage,
                    attributes: { colspan: String(columns.length) }
                })
            );
            tbody.appendChild(empty_row);
        } else {
            data_to_render.forEach((row) => {
                const tr = this.Helpers.create_element('tr');
                columns.forEach((col) => {
                    const content = col.getContent(row);
                    const td = this.Helpers.create_element('td');
                    const is_action = col && col.isAction === true;
                    if (is_action) {
                        td.classList.add('generic-table-col-actions');
                    }
                    if (typeof content === 'string') {
                        td.textContent = content;
                    } else if (content && content instanceof HTMLElement) {
                        if (is_action) {
                            const is_cell_container = content.classList && content.classList.contains('generic-table-action-cell');
                            if (is_cell_container) {
                                td.appendChild(content);
                            } else if (content.tagName === 'BUTTON') {
                                const container = this.Helpers.create_element('div', { class_name: 'generic-table-action-cell' });
                                container.appendChild(content);
                                td.appendChild(container);
                            } else {
                                content.classList.add('generic-table-action-cell');
                                td.appendChild(content);
                            }
                        } else {
                            td.appendChild(content);
                        }
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        }
        table.appendChild(tbody);
        wrapper.appendChild(table);
        root_el.appendChild(wrapper);

        if (typeof this._pendingSortFocusIndex === 'number') {
            const focus_index = this._pendingSortFocusIndex;
            this._pendingSortFocusIndex = undefined;
            if (focus_index >= 0 && sortState && columns[sortState.columnIndex]) {
                const sort_label = columns[sortState.columnIndex].headerLabel;
                const sort_dir_text = sortState.direction === 'asc' ? t('generic_table_sort_asc') : t('generic_table_sort_desc');
                const announcement = t('generic_table_sort_announced', { label: sort_label, direction: sort_dir_text });
                live_region.textContent = announcement;
                const clear_after_ms = 800;
                setTimeout(() => {
                    live_region.textContent = '';
                }, clear_after_ms);
                const apply_focus = () => {
                    const header_buttons = wrapper.querySelectorAll('thead .generic-table-header-sort-btn');
                    const target = header_buttons[focus_index];
                    if (target && typeof target.focus === 'function') {
                        try {
                            target.focus({ preventScroll: true });
                        } catch {
                            target.focus();
                        }
                    }
                };
                if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                    window.requestAnimationFrame(apply_focus);
                } else {
                    apply_focus();
                }
            }
        }
    },

    destroy() {
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
    }
};
