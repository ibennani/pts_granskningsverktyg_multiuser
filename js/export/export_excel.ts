// @ts-nocheck
/**
 * @fileoverview Excel-export av granskning (samma innehåll som tidigare i export_logic).
 */

import ExcelJS from 'exceljs/dist/exceljs.min.js';
import * as Helpers from '../utils/helpers.js';
import { format_local_date_for_filename } from '../utils/filename_utils.ts';
import { get_server_filename_datetime, sanitize_filename_segment } from '../utils/download_filename_utils.ts';
import { get_current_language_code_from_registry } from '../utils/translation_access.js';
import {
    apply_excel_cell_alignment_top_left_wrap,
    extractDeficiencyNumber,
    get_effective_display_times_for_audit,
    get_wcag_pour_export_values_for_requirement,
    strip_markdown_for_excel
} from './export_format_helpers.js';
import { get_export_requirement_result, get_t_internal, show_global_message_internal } from './export_bootstrap.js';

export async function export_to_excel(current_audit) {
    const t = get_t_internal();
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
        workbook.creator = 'PTS Granskningsverktyg';
        workbook.created = new Date();

        const generalSheet = workbook.addWorksheet(t('excel_sheet_general_info'));

        const lang_code = get_current_language_code_from_registry();

        const display_times = get_effective_display_times_for_audit(current_audit);
        const last_updated_ts = current_audit?.updated_at || null;
        const general_info_data = [
            [t('case_number'), strip_markdown_for_excel(String(current_audit.auditMetadata.caseNumber || ''))],
            [t('actor_name'), strip_markdown_for_excel(String(current_audit.auditMetadata.actorName || ''))],
            [t('excel_general_service_link'), strip_markdown_for_excel(String(current_audit.auditMetadata.actorLink || ''))],
            [t('auditor_name'), strip_markdown_for_excel(String(current_audit.auditMetadata.auditorName || ''))],
            [t('start_time'), display_times.startTime ? Helpers.format_iso_to_local_date(display_times.startTime, lang_code) : ''],
            [t('audit_last_updated'), last_updated_ts ? Helpers.format_iso_to_local_datetime(last_updated_ts, lang_code, { showSeconds: false }) : '']
        ];

        generalSheet.addRows(general_info_data);
        generalSheet.getColumn(1).width = 30;
        generalSheet.getColumn(2).width = 70;
        apply_excel_cell_alignment_top_left_wrap(generalSheet);

        const deficienciesSheet = workbook.addWorksheet(t('excel_sheet_deficiencies'));

        const deficiencies_data = [];
        const requirements_for_export = current_audit.ruleFileContent?.requirements || {};
        (current_audit.samples || []).forEach((sample) => {
            const all_reqs = Object.values(requirements_for_export);
            all_reqs.forEach((req_definition) => {
                const result = get_export_requirement_result(requirements_for_export, sample, req_definition);
                if (!result || !result.checkResults) return;
                Object.keys(result.checkResults).forEach((check_id) => {
                    const check_res = result.checkResults[check_id];
                    if (!check_res || !check_res.passCriteria) return;
                    Object.keys(check_res.passCriteria).forEach((pc_id) => {
                        const pc_obj = check_res.passCriteria[pc_id];
                        if (pc_obj && pc_obj.status === 'failed' && pc_obj.deficiencyId) {
                            const pc_def = req_definition.checks?.find((c) => c.id === check_id)?.passCriteria?.find((p) => p.id === pc_id);
                            const templateObservation = pc_def?.failureStatementTemplate || '';
                            const userObservation = pc_obj.observationDetail || '';
                            const passCriterionText = pc_def?.requirement || '';

                            let finalObservation = userObservation;
                            if (!userObservation.trim() || userObservation.trim() === templateObservation.trim()) {
                                finalObservation = passCriterionText;
                            }
                            finalObservation = strip_markdown_for_excel(finalObservation);

                            const ref_text_raw = req_definition.standardReference?.text || '';
                            const reference_obj = { text: strip_markdown_for_excel(ref_text_raw) };
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
                                wcagPerceivable: pour_vals.wcagPerceivable,
                                wcagOperable: pour_vals.wcagOperable,
                                wcagUnderstandable: pour_vals.wcagUnderstandable,
                                wcagRobust: pour_vals.wcagRobust
                            });
                        }
                    });
                });
            });
        });

        deficiencies_data.sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));

        const include_comment_column = deficiencies_data.some((d) => d.comment && String(d.comment).trim().length > 0);
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
        deficienciesSheet.columns = [
            ...column_defs_before_comment,
            ...(include_comment_column ? [{ header: t('excel_col_comment'), key: 'comment', width: 70 }] : []),
            ...wcag_column_defs
        ];
        if (!include_comment_column) {
            deficiencies_data.forEach((row) => {
                delete row.comment;
            });
        }

        deficienciesSheet.addRows(deficiencies_data);

        const id_header_len = t('excel_col_deficiency_id').length;
        const max_id_cell_len = deficiencies_data.reduce((max, row) => {
            const len = String(row.id ?? '').length;
            return len > max ? len : max;
        }, id_header_len);
        const id_column_width = Math.min(Math.max(max_id_cell_len + 2, 8), 45);
        deficienciesSheet.getColumn('id').width = id_column_width;

        deficienciesSheet.eachRow({ includeEmpty: false }, function (row, rowNumber) {
            if (rowNumber > 1) {
                const isEvenRow = rowNumber % 2 === 0;
                row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEvenRow ? 'FFF4F1EE' : 'FFFFFFFF' } };
                row.font = { color: { argb: 'FF000000' } };

                const referenceCell = row.getCell('reference');
                if (referenceCell.hyperlink) {
                    referenceCell.font = { color: { argb: 'FF0000FF' }, underline: true };
                }
                const sampleUrlCell = row.getCell('sampleUrl');
                if (sampleUrlCell.hyperlink) {
                    sampleUrlCell.font = { color: { argb: 'FF0000FF' }, underline: true };
                }
            }
        });

        apply_excel_cell_alignment_top_left_wrap(deficienciesSheet);
        deficienciesSheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6E3282' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        });

        deficienciesSheet.autoFilter = { from: 'A1', to: { row: 1, column: deficienciesSheet.columns.length } };
        deficienciesSheet.views = [{ state: 'frozen', ySplit: 1 }];

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        const actor_name = sanitize_filename_segment(current_audit.auditMetadata.actorName || t('filename_fallback_actor'));
        const case_number = (current_audit.auditMetadata.caseNumber || '').trim();
        const sanitized_case_number = case_number ? case_number.replace(/[^a-z0-9åäöÅÄÖ-]/gi, '') : '';
        const last_updated_iso = current_audit?.updated_at || null;
        const server_dt = await get_server_filename_datetime(last_updated_iso);
        const fallback_now = server_dt ? null : await get_server_filename_datetime(null);
        const date_str = server_dt || fallback_now || format_local_date_for_filename(new Date(), '');

        let filename;
        if (sanitized_case_number) {
            filename = `${sanitized_case_number}_${actor_name}_${date_str}_brister_lista.xlsx`;
        } else {
            filename = `${actor_name}_${date_str}_brister_lista.xlsx`;
        }

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        show_global_message_internal(t('audit_saved_as_file', { filename: filename }), 'success');
    } catch (error) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('Error exporting to Excel with ExcelJS:', error);
        show_global_message_internal(t('error_exporting_excel') + ` ${error.message}`, 'error');
    }
}
