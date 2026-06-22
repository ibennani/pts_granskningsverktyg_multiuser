/**
 * @fileoverview Excel-export av granskning (samma innehåll som tidigare i export_logic).
 */

import ExcelJS from 'exceljs/dist/exceljs.min.js';
import * as Helpers from '../utils/helpers.js';
import { get_current_language_code_from_registry } from '../utils/translation_access.js';
import {
    apply_excel_cell_alignment_top_left_wrap,
    get_audit_last_updated_iso_for_export,
    get_effective_display_times_for_audit,
    strip_markdown_for_excel
} from './export_format_helpers.js';
import { get_t_internal, show_global_message_internal } from './export_bootstrap.js';
import { prepare_deficiencies_for_export } from './export_deficiency_rows.js';
import { populate_deficiencies_excel_sheet } from './excel_deficiencies_sheet.js';
import {
    apply_aeonic_font_to_workbook,
    build_excel_export_filename,
    clear_workbook_metadata,
    strip_xlsx_document_metadata
} from './excel_export_helpers.js';
import { build_export_media_filename_context } from './export_media_filename_context.js';

export async function export_to_excel(current_audit: unknown) {
    const t = get_t_internal() as (key: string, opts?: Record<string, unknown>) => string;
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    if (!ExcelJS) {
        show_global_message_internal(t('excel_library_not_loaded'), 'error');
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('ExcelJS library is not loaded.');
        return;
    }

    try {
        const workbook = new ExcelJS.Workbook();
        const lang_code = get_current_language_code_from_registry();
        const audit = current_audit as {
            auditMetadata: {
                caseNumber?: string;
                actorName?: string;
                actorLink?: string;
                auditorName?: string;
            };
        };

        const generalSheet = workbook.addWorksheet(t('excel_sheet_general_info'));

        const display_times = get_effective_display_times_for_audit(current_audit);
        const last_updated_ts = get_audit_last_updated_iso_for_export(current_audit);
        const general_info_data = [
            [t('case_number'), strip_markdown_for_excel(String(audit.auditMetadata.caseNumber || ''))],
            [t('actor_name'), strip_markdown_for_excel(String(audit.auditMetadata.actorName || ''))],
            [t('excel_general_service_link'), strip_markdown_for_excel(String(audit.auditMetadata.actorLink || ''))],
            [t('auditor_name'), strip_markdown_for_excel(String(audit.auditMetadata.auditorName || ''))],
            [t('start_time'), display_times.startTime ? Helpers.format_iso_to_local_date(display_times.startTime, lang_code) : ''],
            [
                t('audit_last_updated'),
                last_updated_ts ? Helpers.format_iso_to_local_date(last_updated_ts, lang_code) : ''
            ]
        ];

        generalSheet.addRows(general_info_data);
        generalSheet.getColumn(1).width = 30;
        generalSheet.getColumn(2).width = 70;
        apply_excel_cell_alignment_top_left_wrap(generalSheet);

        const deficienciesSheet = workbook.addWorksheet(t('excel_sheet_deficiencies'));
        show_global_message_internal(t('excel_export_preparing_media_references'), 'info');
        const export_date = new Date();
        const media_context = await build_export_media_filename_context(current_audit, export_date);
        const { deficiencies_data, column_defs } = await prepare_deficiencies_for_export(
            current_audit,
            t,
            media_context
        );

        populate_deficiencies_excel_sheet(
            deficienciesSheet,
            deficiencies_data,
            column_defs,
            t('excel_sheet_audit_report'),
            t('excel_col_deficiency_id').length
        );

        apply_aeonic_font_to_workbook(workbook);
        clear_workbook_metadata(workbook);

        const raw_buffer = await workbook.xlsx.writeBuffer();
        const clean_buffer = await strip_xlsx_document_metadata(raw_buffer as ArrayBuffer);
        const blob = new Blob([clean_buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const filename = build_excel_export_filename(audit, t, export_date);

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        show_global_message_internal(t('audit_saved_as_file', { filename: filename }), 'success');
    } catch (error: unknown) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('Error exporting to Excel with ExcelJS:', error);
        const msg = error instanceof Error ? error.message : String(error);
        show_global_message_internal(t('error_exporting_excel') + ` ${msg}`, 'error');
    }
}
