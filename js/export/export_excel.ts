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
import { trigger_browser_blob_download } from '../utils/download_filename_utils.js';
import { finalize_export_catch } from './export_error_handling.js';
import { get_t_internal, show_global_message_internal } from './export_bootstrap.js';
import { prepare_deficiencies_for_export } from './export_deficiency_rows.js';
import { populate_deficiencies_excel_sheet } from './excel_deficiencies_sheet.js';
import {
    apply_aeonic_font_to_workbook,
    build_excel_export_filename,
    clear_workbook_metadata,
    strip_xlsx_document_metadata
} from './excel_export_helpers.js';
import { build_export_media_filename_context } from './export_media_naming.js';
import { resolve_appendix2_excel_labels } from '../logic/appendix2_excel_template.js';

type ExcelAudit = {
    auditMetadata: {
        caseNumber?: string;
        actorName?: string;
        actorLink?: string;
        auditorName?: string;
    };
    ruleFileContent?: unknown;
};

export async function build_excel_export_blob(
    current_audit: unknown
): Promise<{ blob: Blob; filename: string } | null> {
    const t = get_t_internal() as (key: string, opts?: Record<string, unknown>) => string;
    if (!current_audit) {
        return null;
    }

    if (!ExcelJS) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('ExcelJS library is not loaded.');
        return null;
    }

    const workbook = new ExcelJS.Workbook();
    const lang_code = get_current_language_code_from_registry();
    const audit = current_audit as ExcelAudit;

    const { general_info_labels, sheet_names } = resolve_appendix2_excel_labels(audit.ruleFileContent as never);

    const generalSheet = workbook.addWorksheet(sheet_names.general_info);

    const display_times = get_effective_display_times_for_audit(current_audit);
    const last_updated_ts = get_audit_last_updated_iso_for_export(current_audit);
    const general_info_data = [
        [general_info_labels.case_number, strip_markdown_for_excel(String(audit.auditMetadata.caseNumber || ''))],
        [general_info_labels.actor_name, strip_markdown_for_excel(String(audit.auditMetadata.actorName || ''))],
        [general_info_labels.actor_link, strip_markdown_for_excel(String(audit.auditMetadata.actorLink || ''))],
        [general_info_labels.auditor_name, strip_markdown_for_excel(String(audit.auditMetadata.auditorName || ''))],
        [general_info_labels.start_time, display_times.startTime ? Helpers.format_iso_to_local_date(display_times.startTime, lang_code) : ''],
        [
            general_info_labels.audit_last_updated,
            last_updated_ts ? Helpers.format_iso_to_local_date(last_updated_ts, lang_code) : '',
        ],
    ];

    generalSheet.addRows(general_info_data);
    generalSheet.getColumn(1).width = 30;
    generalSheet.getColumn(2).width = 70;
    apply_excel_cell_alignment_top_left_wrap(generalSheet);

    const deficienciesSheet = workbook.addWorksheet(sheet_names.deficiencies);
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
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const filename = build_excel_export_filename(audit, t, export_date);
    return { blob, filename };
}

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
        show_global_message_internal(t('excel_export_preparing_media_references'), 'info');
        const result = await build_excel_export_blob(current_audit);
        if (!result) {
            show_global_message_internal(t('error_exporting_excel'), 'error');
            return;
        }
        trigger_browser_blob_download(result.blob, result.filename);
        show_global_message_internal(t('audit_saved_as_file', { filename: result.filename }), 'success');
    } catch (error: unknown) {
        finalize_export_catch(error, (err) => {
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn('Error exporting to Excel with ExcelJS:', err);
            const msg = err instanceof Error ? err.message : String(err);
            show_global_message_internal(t('error_exporting_excel') + ` ${msg}`, 'error');
        });
    }
}
