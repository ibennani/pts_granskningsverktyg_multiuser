// js/components/AuditListComponent.js
// Återanvändbar komponent för att visa listor med granskningar i tabellform.

import { GenericTableComponent } from './GenericTableComponent.js';
import { create_audit_table_columns } from '../utils/audit_table_columns.js';

export const AuditListComponent = {
    CSS_PATH: './css/components/generic_table_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;

        this._table = Object.create(GenericTableComponent);
        await this._table.init({ deps });
    },

    /**
     * Renderar en granskningstabell.
     *
     * @param {Object} opts
     * @param {HTMLElement} [opts.root] - Container för tabellen (om ej angiven används this.root).
     * @param {Array<any>} opts.audits - Lista med granskningar.
     * @param {string} opts.emptyMessage - Text när listan är tom.
     * @param {string} opts.ariaLabel - ARIA-label för tabellen.
     * @param {boolean} [opts.includeDelete=false] - Om raderingskolumn ska inkluderas.
     * @param {{ columnIndex: number, direction: 'asc'|'desc' }} [opts.sortState] - Aktuell sortering.
     * @param {function(number, 'asc'|'desc')} [opts.onSort] - Callback vid sorteringsändring.
     * @param {function(string|number)} opts.onOpenAudit - Callback när en granskning öppnas.
     * @param {function(string|number)} opts.onDownloadAudit - Callback när en granskning laddas ner.
     * @param {function(string|number)} [opts.onDeleteAudit] - Callback när en granskning raderas.
     * @param {function(string): string} [opts.get_status_label] - Funktion för att mappa status till text.
     */
    render(opts) {
        const root_el = opts.root ?? this.root;
        if (!root_el || !this.Helpers?.create_element || !this.Translation) return;

        const t = this.Translation.t.bind(this.Translation);

        const get_status_label =
            typeof opts.get_status_label === 'function'
                ? opts.get_status_label
                : (status) => status;

        const table_deps = {
            t,
            Helpers: this.Helpers,
            Translation: this.Translation,
            get_status_label
        };

        const handlers = {
            onOpenAudit: opts.onOpenAudit,
            onDownloadAudit: opts.onDownloadAudit,
            onDeleteAudit: opts.onDeleteAudit
        };

        const columns = create_audit_table_columns(
            table_deps,
            handlers,
            { includeDelete: opts.includeDelete === true }
        );

        this._table.render({
            root: root_el,
            columns,
            data: opts.audits || [],
            emptyMessage: opts.emptyMessage,
            ariaLabel: opts.ariaLabel,
            wrapperClassName: 'generic-table-wrapper',
            tableClassName: `generic-table generic-table--audit-list${opts.includeDelete === true ? ' generic-table--audit-list--with-delete' : ''}`,
            sortState: opts.sortState,
            onSort: opts.onSort,
            t
        });
    },

    destroy() {
        this._table?.destroy?.();
        this.root = null;
        this.deps = null;
        this.Helpers = null;
        this.Translation = null;
        this._table = null;
    }
};

