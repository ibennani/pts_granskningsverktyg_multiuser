// @ts-nocheck
/**
 * @fileoverview CSV-export av brister (samma innehåll som tidigare i export_logic).
 */

import { format_local_date_for_filename } from '../utils/filename_utils.ts';
import { get_server_filename_datetime, sanitize_filename_segment } from '../utils/download_filename_utils.ts';
import {
    escape_for_csv,
    extractDeficiencyNumber,
    get_wcag_pour_export_values_for_requirement
} from './export_format_helpers.js';
import { get_export_requirement_result, get_t_internal, show_global_message_internal } from './export_bootstrap.js';

export async function export_to_csv(current_audit) {
    const t = get_t_internal();
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    const csv_content_array = [];

    const headers = [
        t('excel_col_deficiency_id'),
        t('excel_col_req_title'),
        t('excel_col_reference'),
        t('excel_col_sample_name'),
        t('excel_col_sample_url'),
        'Kravets syfte',
        t('excel_col_deficiency_type'),
        t('excel_col_observation'),
        t('excel_col_wcag_perceivable'),
        t('excel_col_wcag_operable'),
        t('excel_col_wcag_understandable'),
        t('excel_col_wcag_robust')
    ];
    csv_content_array.push(headers.join(';'));

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

                        const pour_vals = get_wcag_pour_export_values_for_requirement(req_definition, current_audit, t);
                        const row_values = [
                            escape_for_csv(extractDeficiencyNumber(pc_obj.deficiencyId)),
                            escape_for_csv(req_definition.title),
                            escape_for_csv(req_definition.standardReference?.text || ''),
                            escape_for_csv(sample.description),
                            escape_for_csv(sample.url),
                            escape_for_csv('Här kommer en ny text visas. Denna text är ännu inte klar.'),
                            escape_for_csv(''),
                            escape_for_csv(finalObservation),
                            escape_for_csv(pour_vals.wcagPerceivable),
                            escape_for_csv(pour_vals.wcagOperable),
                            escape_for_csv(pour_vals.wcagUnderstandable),
                            escape_for_csv(pour_vals.wcagRobust)
                        ];
                        csv_content_array.push(row_values.join(';'));
                    }
                });
            });
        });
    });

    const csv_string = csv_content_array.join('\n');
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv_string], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    const actor_name = sanitize_filename_segment(current_audit.auditMetadata.actorName || t('filename_fallback_actor'));
    const case_number = (current_audit.auditMetadata.caseNumber || '').trim();
    const sanitized_case_number = case_number ? case_number.replace(/[^a-z0-9åäöÅÄÖ-]/gi, '') : '';
    const last_updated_iso = current_audit?.updated_at || null;
    const server_dt = await get_server_filename_datetime(last_updated_iso);
    const fallback_now = server_dt ? null : await get_server_filename_datetime(null);
    const date_str = server_dt || fallback_now || format_local_date_for_filename(new Date(), '');

    let filename;
    if (sanitized_case_number) {
        filename = `${sanitized_case_number}_${actor_name}_${date_str}_brister_lista.csv`;
    } else {
        filename = `${actor_name}_${date_str}_brister_lista.csv`;
    }

    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    show_global_message_internal(t('audit_saved_as_file', { filename: filename }), 'success');
}
