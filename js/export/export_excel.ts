/**
 * @fileoverview Excel-export av granskning (samma innehåll som tidigare i export_logic).
 */

import ExcelJS from 'exceljs/dist/exceljs.min.js';
import * as Helpers from '../utils/helpers.js';
import { get_current_language_code_from_registry } from '../utils/translation_access.js';
import {
    apply_excel_cell_alignment_top_left_wrap,
    extractDeficiencyNumber,
    get_effective_display_times_for_audit,
    get_wcag_pour_export_values_for_requirement,
    strip_markdown_for_excel
} from './export_format_helpers.js';
import { get_export_requirement_result, get_t_internal, show_global_message_internal } from './export_bootstrap.js';
import { for_each_failed_in_requirement_result } from './export_deficiency_traversal.js';
import { find_check_def_by_storage_id, find_pass_criterion_def_by_storage_id } from '../logic/entity_id_match.js';
import { populate_deficiencies_excel_sheet } from './excel_deficiencies_sheet.js';
import {
    apply_aeonic_font_to_workbook,
    build_excel_export_filename,
    clear_workbook_metadata,
    strip_xlsx_document_metadata,
    to_wcag_yes_only_value
} from './excel_export_helpers.js';

export async function export_to_excel(current_audit: any) {
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

        const generalSheet = workbook.addWorksheet(t('excel_sheet_general_info'));

        const display_times = get_effective_display_times_for_audit(current_audit);
        const last_updated_ts = current_audit?.updated_at || null;
        const general_info_data = [
            [t('case_number'), strip_markdown_for_excel(String(current_audit.auditMetadata.caseNumber || ''))],
            [t('actor_name'), strip_markdown_for_excel(String(current_audit.auditMetadata.actorName || ''))],
            [t('excel_general_service_link'), strip_markdown_for_excel(String(current_audit.auditMetadata.actorLink || ''))],
            [t('auditor_name'), strip_markdown_for_excel(String(current_audit.auditMetadata.auditorName || ''))],
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
        const deficiencies_data = build_deficiencies_data(current_audit, t);
        const include_comment_column = deficiencies_data.some(
            (d) => d.comment && String(d.comment).trim().length > 0
        );

        const column_defs = build_deficiency_column_defs(t, include_comment_column);
        if (!include_comment_column) {
            deficiencies_data.forEach((row) => {
                delete row.comment;
            });
        }

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
        const filename = build_excel_export_filename(current_audit, t, new Date());

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

function build_deficiency_column_defs(t: (key: string) => string, include_comment_column: boolean) {
    const wcag_column_defs = [
        { header: t('excel_col_wcag_perceivable'), key: 'wcagPerceivable', width: 14 },
        { header: t('excel_col_wcag_operable'), key: 'wcagOperable', width: 14 },
        { header: t('excel_col_wcag_understandable'), key: 'wcagUnderstandable', width: 14 },
        { header: t('excel_col_wcag_robust'), key: 'wcagRobust', width: 12 }
    ];
    const column_defs_before_comment = [
        { header: t('excel_col_deficiency_id'), key: 'id', width: 12 },
        { header: t('excel_col_req_title'), key: 'reqTitle', width: 45 },
        { header: t('excel_col_reference'), key: 'reference', width: 40 },
        { header: t('excel_col_sample_name'), key: 'sampleName', width: 30 },
        { header: t('excel_col_sample_url'), key: 'sampleUrl', width: 40 },
        { header: t('excel_col_deficiency_type'), key: 'deficiencyType', width: 24 },
        { header: t('excel_col_observation'), key: 'observation', width: 70 }
    ];
    return [
        ...column_defs_before_comment,
        ...(include_comment_column ? [{ header: t('excel_col_comment'), key: 'comment', width: 70 }] : []),
        ...wcag_column_defs
    ];
}

function build_deficiencies_data(current_audit: any, t: (key: string) => string) {
    const deficiencies_data: any[] = [];
    const yes_label = t('yes');
    const requirements_for_export = current_audit.ruleFileContent?.requirements || {};
    (current_audit.samples || []).forEach((sample: any) => {
        const all_reqs = Object.values(requirements_for_export);
        all_reqs.forEach((req_definition: any) => {
            const result = get_export_requirement_result(requirements_for_export, sample, req_definition);
            if (!result) return;
            for_each_failed_in_requirement_result(result, ({ check_id, pc_id, pc_obj }) => {
                const check_def = find_check_def_by_storage_id(req_definition.checks as any[], check_id);
                const pc_def = find_pass_criterion_def_by_storage_id(check_def?.passCriteria, pc_id) as {
                    failureStatementTemplate?: string;
                    requirement?: string;
                } | undefined;
                const templateObservation = pc_def?.failureStatementTemplate || '';
                const userObservation = pc_obj.observationDetail || '';
                const passCriterionText = pc_def?.requirement || '';

                let finalObservation = userObservation;
                if (!userObservation.trim() || userObservation.trim() === templateObservation.trim()) {
                    finalObservation = passCriterionText;
                }
                finalObservation = strip_markdown_for_excel(finalObservation);

                const ref_text_raw = req_definition.standardReference?.text || '';
                const reference_obj: { text: string; hyperlink?: string } = {
                    text: strip_markdown_for_excel(ref_text_raw)
                };
                if (req_definition.standardReference?.url) {
                    reference_obj.hyperlink = Helpers.add_protocol_if_missing(req_definition.standardReference.url);
                }

                const url_obj = sample.url
                    ? {
                          text: strip_markdown_for_excel(String(sample.url)),
                          hyperlink: Helpers.add_protocol_if_missing(sample.url)
                      }
                    : null;

                const pour_vals = get_wcag_pour_export_values_for_requirement(req_definition, current_audit, t);
                const comment_text = strip_markdown_for_excel((result.commentToAuditor || '').trim());
                deficiencies_data.push({
                    id: extractDeficiencyNumber(pc_obj.deficiencyId),
                    reqTitle: strip_markdown_for_excel(String(req_definition.title || '')),
                    reference: reference_obj,
                    sampleName: strip_markdown_for_excel(String(sample.description || '')),
                    sampleUrl: url_obj,
                    deficiencyType: '',
                    observation: finalObservation,
                    comment: comment_text,
                    wcagPerceivable: to_wcag_yes_only_value(pour_vals.wcagPerceivable, yes_label),
                    wcagOperable: to_wcag_yes_only_value(pour_vals.wcagOperable, yes_label),
                    wcagUnderstandable: to_wcag_yes_only_value(pour_vals.wcagUnderstandable, yes_label),
                    wcagRobust: to_wcag_yes_only_value(pour_vals.wcagRobust, yes_label)
                });
            });
        });
    });

    deficiencies_data.sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));
    return deficiencies_data;
}
