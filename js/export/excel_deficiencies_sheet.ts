/**
 * @fileoverview Bygger bladet "Brister" som Excel-tabell i exporten.
 */

import { apply_excel_cell_alignment_top_left_wrap } from './export_format_helpers.js';
import { deficiency_row_to_flat_values, type DeficiencyRow } from './export_deficiency_rows.js';
import { sanitize_excel_table_name } from './excel_export_helpers.js';

type ColumnDef = { header: string; key: string; width: number };

type RowHyperlinkMeta = { reference_url?: string; sample_url?: string };

function collect_row_hyperlinks(row: DeficiencyRow): RowHyperlinkMeta {
    return {
        reference_url: row.reference?.hyperlink,
        sample_url: row.sampleUrl?.hyperlink
    };
}

function apply_deficiency_hyperlinks(
    sheet: {
        getRow: (n: number) => { getCell: (col: number) => { value: unknown; hyperlink?: string; font?: object } };
    },
    hyperlinks: RowHyperlinkMeta[],
    reference_col: number,
    sample_url_col: number
): void {
    hyperlinks.forEach((meta, index) => {
        const row_num = index + 2;
        const excel_row = sheet.getRow(row_num);
        if (meta.reference_url) {
            const cell = excel_row.getCell(reference_col);
            cell.value = { text: String(cell.value ?? ''), hyperlink: meta.reference_url };
            cell.font = { color: { argb: 'FF0000FF' }, underline: true, name: 'Aeonic' };
        }
        if (meta.sample_url) {
            const cell = excel_row.getCell(sample_url_col);
            cell.value = { text: String(cell.value ?? ''), hyperlink: meta.sample_url };
            cell.font = { color: { argb: 'FF0000FF' }, underline: true, name: 'Aeonic' };
        }
    });
}

function apply_deficiency_row_styling(
    sheet: { eachRow: (opts: { includeEmpty: boolean }, cb: (row: any, rowNumber: number) => void) => void },
    reference_col: number,
    sample_url_col: number
): void {
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= 1) {
            return;
        }
        const is_even = rowNumber % 2 === 0;
        row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: is_even ? 'FFF4F1EE' : 'FFFFFFFF' }
        };
        row.font = { color: { argb: 'FF000000' }, name: 'Aeonic' };
        const ref_cell = row.getCell(reference_col);
        if (ref_cell.hyperlink) {
            ref_cell.font = { color: { argb: 'FF0000FF' }, underline: true, name: 'Aeonic' };
        }
        const url_cell = row.getCell(sample_url_col);
        if (url_cell.hyperlink) {
            url_cell.font = { color: { argb: 'FF0000FF' }, underline: true, name: 'Aeonic' };
        }
    });
}

function apply_deficiency_header_styling(sheet: { getRow: (n: number) => { eachCell: Function } }): void {
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell: { fill?: object; font?: object }) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6E3282' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Aeonic' };
    });
}

function set_column_widths(sheet: { getColumn: (key: string | number) => { width: number } }, defs: ColumnDef[]): void {
    defs.forEach((def, index) => {
        sheet.getColumn(index + 1).width = def.width;
    });
}

function assert_unique_headers(headers: string[]): void {
    const seen = new Set<string>();
    for (const header of headers) {
        const trimmed = String(header || '').trim();
        if (!trimmed) {
            throw new Error('Excel-tabellrubrik saknas');
        }
        if (seen.has(trimmed)) {
            throw new Error(`Excel-tabellrubrik är inte unik: ${trimmed}`);
        }
        seen.add(trimmed);
    }
}

/**
 * Fyller bristbladet med en riktig Excel-tabell.
 */
export function populate_deficiencies_excel_sheet(
    sheet: {
        addTable: (opts: object) => void;
        getRow: (n: number) => { getCell: (col: number) => any; eachCell: Function };
        eachRow: (opts: { includeEmpty: boolean }, cb: (row: any, rowNumber: number) => void) => void;
        getColumn: (key: string | number) => { width: number };
        views: object[];
    },
    deficiencies_data: DeficiencyRow[],
    column_defs: ColumnDef[],
    table_display_name: string,
    id_header_len: number
): void {
    const column_keys = column_defs.map((def) => def.key);
    const headers = column_defs.map((def) => def.header);
    assert_unique_headers(headers);

    const table_rows = deficiencies_data.map((row) => deficiency_row_to_flat_values(row, column_keys));
    if (table_rows.length === 0) {
        table_rows.push(column_keys.map(() => ''));
    }

    const row_hyperlinks = deficiencies_data.map((row) => collect_row_hyperlinks(row));
    const reference_col = column_keys.indexOf('reference') + 1;
    const sample_url_col = column_keys.indexOf('sampleUrl') + 1;
    const table_name = sanitize_excel_table_name(table_display_name);

    sheet.addTable({
        name: table_name,
        displayName: table_name,
        ref: 'A1',
        headerRow: true,
        totalsRow: false,
        style: { theme: 'TableStyleLight1', showRowStripes: false },
        columns: headers.map((name) => ({ name, filterButton: true })),
        rows: table_rows
    });

    const max_id_len = deficiencies_data.reduce((max, row) => {
        const len = String(row.id ?? '').length;
        return len > max ? len : max;
    }, id_header_len);
    const id_col_index = column_keys.indexOf('id');
    if (id_col_index >= 0) {
        column_defs[id_col_index].width = Math.min(Math.max(max_id_len + 2, 8), 45);
    }

    set_column_widths(sheet, column_defs);
    apply_deficiency_hyperlinks(sheet, row_hyperlinks, reference_col, sample_url_col);
    apply_deficiency_row_styling(sheet, reference_col, sample_url_col);
    apply_deficiency_header_styling(sheet);
    apply_excel_cell_alignment_top_left_wrap(sheet);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
}
