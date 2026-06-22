/**
 * @fileoverview Detaljtabell för expanderad grupp i grupperad granskningslista.
 */

import {
    sort_audits_within_group,
    type AuditListGroup,
    type AuditRowForGrouping
} from '../logic/audit_list_case_grouping.js';

export type DetailColumnDef = {
    headerLabel: string;
    getContent: (row: AuditRowForGrouping) => string | HTMLElement;
    isAction?: boolean;
};

type DetailTableContext = {
    Helpers: { create_element: (...args: unknown[]) => HTMLElement };
};

function append_detail_cell(
    Helpers: DetailTableContext['Helpers'],
    tr: HTMLElement,
    col: DetailColumnDef,
    row: AuditRowForGrouping
): void {
    const content = col.getContent(row);
    const td = Helpers.create_element('td', {});
    if (col.isAction) td.classList.add('generic-table-col-actions');
    if (typeof content === 'string') {
        td.textContent = content;
    } else if (content instanceof HTMLElement) {
        if (col.isAction && content.tagName === 'BUTTON') {
            const container = Helpers.create_element('div', { class_name: 'generic-table-action-cell' });
            container.appendChild(content);
            td.appendChild(container);
        } else {
            td.appendChild(content);
        }
    }
    tr.appendChild(td);
}

/** Bygger under-tabellen med granskningar i en expanderad grupp. */
export function build_group_detail_table(
    ctx: DetailTableContext,
    group: AuditListGroup,
    detail_columns: DetailColumnDef[],
    row_number_header: string
): HTMLElement {
    const { Helpers } = ctx;
    const table = Helpers.create_element('table', {
        class_name: 'generic-table generic-table--audit-list audit-group-detail-table'
    });
    const thead = Helpers.create_element('thead', {});
    const header_row = Helpers.create_element('tr', {});
    const row_number_th = Helpers.create_element('th', {
        attributes: { scope: 'col' },
        class_name: 'audit-group-detail-col-row-number',
        text_content: row_number_header
    });
    header_row.appendChild(row_number_th);
    for (const col of detail_columns) {
        const th = Helpers.create_element('th', {
            attributes: { scope: 'col' },
            text_content: col.headerLabel
        });
        header_row.appendChild(th);
    }
    thead.appendChild(header_row);
    table.appendChild(thead);

    const tbody = Helpers.create_element('tbody', {});
    const sorted_audits = sort_audits_within_group(group.audits);
    sorted_audits.forEach((audit, index) => {
        const tr = Helpers.create_element('tr', {});
        if (audit.id !== undefined && audit.id !== null) {
            tr.setAttribute('data-row-id', String(audit.id));
        }
        const row_number_td = Helpers.create_element('td', {
            class_name: 'audit-group-detail-col-row-number',
            text_content: String(index + 1)
        });
        tr.appendChild(row_number_td);
        for (const col of detail_columns) {
            append_detail_cell(Helpers, tr, col, audit);
        }
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
}
