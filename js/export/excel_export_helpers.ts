/**
 * @fileoverview Hjälpfunktioner för Excel-export: typsnitt, filnamn och metadata-rensning.
 */

import JSZip from 'jszip';
import { format_local_date_for_filename } from '../utils/filename_utils.js';

const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const AEONIC_FONT = 'Aeonic';

const MINIMAL_CORE_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>';

const MINIMAL_APP_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>';

type TExport = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Tar bort ogiltiga Windows-filnamnstecken men behåller mellanslag.
 */
export function sanitize_excel_download_filename_segment(segment: string): string {
    return String(segment || '')
        .trim()
        .replace(UNSAFE_FILENAME_CHARS, '')
        .trim();
}

/**
 * Bygger nedladdningsfilnamn: [diarienummer] [Aktör] [label] [YYYY-MM-DD].[extension]
 */
export function build_deficiency_export_filename(
    audit: { auditMetadata?: { caseNumber?: string; actorName?: string } },
    t: TExport,
    export_date: Date = new Date(),
    extension = 'xlsx'
): string {
    const case_number = sanitize_excel_download_filename_segment(audit?.auditMetadata?.caseNumber || '');
    const actor = sanitize_excel_download_filename_segment(
        audit?.auditMetadata?.actorName || t('filename_fallback_actor')
    );
    const label = t('excel_export_filename_label');
    const date_str = format_local_date_for_filename(export_date, '-');
    const parts: string[] = [];
    if (case_number) {
        parts.push(case_number);
    }
    parts.push(actor, label, date_str);
    const safe_extension = String(extension || 'xlsx').replace(/^\./, '');
    return `${parts.join(' ')}.${safe_extension}`;
}

/** Bygger nedladdningsfilnamn för Excel (.xlsx). */
export function build_excel_export_filename(
    audit: { auditMetadata?: { caseNumber?: string; actorName?: string } },
    t: TExport,
    export_date: Date = new Date()
): string {
    return build_deficiency_export_filename(audit, t, export_date, 'xlsx');
}

/**
 * Excel-internt tabellnamn: bokstäver utan siffror och mellanslag.
 */
export function sanitize_excel_table_name(display_label: string): string {
    const without_digits = String(display_label || '').replace(/[0-9]/g, '');
    const compact = without_digits.replace(/\s+/g, '');
    const letters_only = compact.replace(/[^a-zA-Z\u00C0-\u024F]/g, '');
    return letters_only || 'Granskningsrapport';
}

/** WCAG-export: skriv bara ja-värdet, lämna nej tomt. */
export function to_wcag_yes_only_value(cell_value: string, yes_label: string): string {
    return cell_value === yes_label ? yes_label : '';
}

/** Sätter typsnitt Aeonic i alla celler utan att ta bort övrig fontformatering. */
export function apply_aeonic_font_to_workbook(workbook: {
    eachSheet: (cb: (sheet: ExcelSheetLike) => void) => void;
}): void {
    workbook.eachSheet((sheet) => {
        sheet.eachRow({ includeEmpty: true }, (row) => {
            row.eachCell({ includeEmpty: true }, (cell) => {
                const prev = cell.font || {};
                cell.font = { ...prev, name: AEONIC_FONT };
            });
        });
    });
}

/** Rensar ExcelJS workbook-metadata innan filen skrivs. */
export function clear_workbook_metadata(workbook: Record<string, unknown>): void {
    workbook.creator = '';
    workbook.lastModifiedBy = '';
    workbook.company = '';
    workbook.manager = '';
    workbook.title = '';
    workbook.subject = '';
    workbook.keywords = '';
    workbook.description = '';
    workbook.category = '';
    delete workbook.created;
    delete workbook.modified;
}

/**
 * Tar bort dokumentmetadata från en färdig .xlsx-buffer (zip-postprocess).
 */
export async function strip_xlsx_document_metadata(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    const zip = await JSZip.loadAsync(buffer);
    zip.file('docProps/core.xml', MINIMAL_CORE_XML);
    zip.file('docProps/app.xml', MINIMAL_APP_XML);
    zip.remove('docProps/custom.xml');
    return zip.generateAsync({ type: 'arraybuffer' });
}

type ExcelCellLike = { font?: Record<string, unknown> };
type ExcelRowLike = {
    eachCell: (opts: { includeEmpty: boolean }, cb: (cell: ExcelCellLike) => void) => void;
};
type ExcelSheetLike = {
    eachRow: (opts: { includeEmpty: boolean }, cb: (row: ExcelRowLike) => void) => void;
};
