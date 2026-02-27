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
     * @param {Array<{ headerLabel: string, getContent: (row: any) => string | HTMLElement }>} opts.columns
     * @param {Array<any>} opts.data
     * @param {string} opts.emptyMessage - Text när data är tom.
     * @param {string} opts.ariaLabel
     * @param {string} [opts.wrapperClassName] - T.ex. 'generic-table-wrapper'.
     * @param {string} [opts.tableClassName] - T.ex. 'generic-table generic-table--audit-list'.
     */
    render(opts) {
        const root_el = opts.root ?? this.root;
        if (!root_el || !this.Helpers?.create_element) return;

        const { columns, data, emptyMessage, ariaLabel } = opts;
        const wrapper_class = opts.wrapperClassName ?? 'generic-table-wrapper';
        const table_class = opts.tableClassName ?? 'generic-table';

        root_el.innerHTML = '';

        const wrapper = this.Helpers.create_element('div', { class_name: wrapper_class });
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
        columns.forEach((col) => {
            header_row.appendChild(this.Helpers.create_element('th', { text_content: col.headerLabel }));
        });
        thead.appendChild(header_row);
        table.appendChild(thead);

        const tbody = this.Helpers.create_element('tbody');
        if (!data || data.length === 0) {
            const empty_row = this.Helpers.create_element('tr');
            empty_row.appendChild(
                this.Helpers.create_element('td', {
                    text_content: emptyMessage,
                    attributes: { colspan: String(columns.length) }
                })
            );
            tbody.appendChild(empty_row);
        } else {
            data.forEach((row) => {
                const tr = this.Helpers.create_element('tr');
                columns.forEach((col) => {
                    const content = col.getContent(row);
                    const td = this.Helpers.create_element('td');
                    if (typeof content === 'string') {
                        td.textContent = content;
                    } else if (content && content instanceof HTMLElement) {
                        td.appendChild(content);
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        }
        table.appendChild(tbody);
        wrapper.appendChild(table);
        root_el.appendChild(wrapper);
    },

    destroy() {
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
    }
};
