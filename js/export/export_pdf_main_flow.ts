/**
 * @fileoverview PDF-export (krav): bygger HTML och anropar server-Puppeteer.
 */
import { consoleManager } from '../utils/console_manager.js';
import { get_t_internal, show_global_message_internal } from './export_bootstrap.js';
import {
    build_report_export_filename,
    build_deficiency_types_appendix_pdf_filename,
} from './export_report_filename.js';
import {
    build_report_body_sorted_by_requirements,
    build_report_body_sorted_by_samples,
    build_report_pdf_intro_html,
    build_report_pdf_html_document,
    type ExportReportHtmlT,
} from './export_report_html_criterias.js';
import { build_deficiency_types_appendix_pdf_document } from './export_report_html_deficiency_types.js';
import { api_post_pdf } from '../api/client.js';
import { trigger_browser_blob_download } from '../utils/download_filename_utils.js';

export async function export_to_pdf_criterias(current_audit: Record<string, unknown> | null | undefined): Promise<void> {
    const t = get_t_internal() as ExportReportHtmlT;
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    const audit_id = current_audit.auditId;
    if (!audit_id || typeof audit_id !== 'string') {
        show_global_message_internal(t('error_exporting_pdf_no_server_id'), 'error');
        return;
    }

    consoleManager.log('[PDF Export] Starting export_to_pdf_criterias');

    try {
        const intro_html = build_report_pdf_intro_html();
        const body_html = intro_html + build_report_body_sorted_by_requirements(current_audit, t);
        const actor = String((current_audit.auditMetadata as { actorName?: string } | undefined)?.actorName || t('filename_fallback_actor'));
        const case_num = String((current_audit.auditMetadata as { caseNumber?: string } | undefined)?.caseNumber || '').trim();
        const doc_title = case_num ? `${case_num} ${actor}` : actor;
        const html_content = build_report_pdf_html_document({
            title: doc_title,
            lang: 'sv',
            body_html,
        });

        const pdf_blob = await api_post_pdf(`/audits/${encodeURIComponent(audit_id)}/export/pdf-requirements`, {
            htmlContent: html_content,
        });

        const filename = build_report_export_filename(
            current_audit as { auditMetadata?: { caseNumber?: string; actorName?: string }; updated_at?: string | null },
            true,
            'pdf',
            t
        );

        trigger_browser_blob_download(pdf_blob, filename);
        show_global_message_internal(t('audit_saved_as_file', { filename }), 'success');
    } catch (error: unknown) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('Error exporting to PDF:', error);
        const msg = error instanceof Error ? error.message : String(error);
        show_global_message_internal(`${t('error_exporting_pdf')} ${msg}`.trim(), 'error');
    }
}

export async function export_to_pdf_samples(current_audit: Record<string, unknown> | null | undefined): Promise<void> {
    const t = get_t_internal() as ExportReportHtmlT;
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    const audit_id = current_audit.auditId;
    if (!audit_id || typeof audit_id !== 'string') {
        show_global_message_internal(t('error_exporting_pdf_no_server_id'), 'error');
        return;
    }

    consoleManager.log('[PDF Export] Starting export_to_pdf_samples');

    try {
        const intro_html = build_report_pdf_intro_html();
        const body_html = intro_html + build_report_body_sorted_by_samples(current_audit, t);
        const actor = String((current_audit.auditMetadata as { actorName?: string } | undefined)?.actorName || t('filename_fallback_actor'));
        const case_num = String((current_audit.auditMetadata as { caseNumber?: string } | undefined)?.caseNumber || '').trim();
        const doc_title = case_num ? `${case_num} ${actor}` : actor;
        const html_content = build_report_pdf_html_document({
            title: doc_title,
            lang: 'sv',
            body_html,
        });

        const pdf_blob = await api_post_pdf(`/audits/${encodeURIComponent(audit_id)}/export/pdf-requirements`, {
            htmlContent: html_content,
        });

        const filename = build_report_export_filename(
            current_audit as { auditMetadata?: { caseNumber?: string; actorName?: string }; updated_at?: string | null },
            false,
            'pdf',
            t
        );

        trigger_browser_blob_download(pdf_blob, filename);
        show_global_message_internal(t('audit_saved_as_file', { filename }), 'success');
    } catch (error: unknown) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('Error exporting samples PDF:', error);
        const msg = error instanceof Error ? error.message : String(error);
        show_global_message_internal(`${t('error_exporting_pdf')} ${msg}`.trim(), 'error');
    }
}

export async function export_to_pdf_deficiency_types(
    current_audit: Record<string, unknown> | null | undefined
): Promise<void> {
    const t = get_t_internal() as ExportReportHtmlT;
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    const audit_id = current_audit.auditId;
    if (!audit_id || typeof audit_id !== 'string') {
        show_global_message_internal(t('error_exporting_pdf_no_server_id'), 'error');
        return;
    }

    consoleManager.log('[PDF Export] Starting export_to_pdf_deficiency_types');

    try {
        const html_content = build_deficiency_types_appendix_pdf_document(current_audit, t);
        const pdf_blob = await api_post_pdf(`/audits/${encodeURIComponent(audit_id)}/export/pdf-requirements`, {
            htmlContent: html_content,
        });

        const filename = build_deficiency_types_appendix_pdf_filename(
            current_audit as { auditMetadata?: { caseNumber?: string; actorName?: string }; updated_at?: string | null },
            t
        );

        trigger_browser_blob_download(pdf_blob, filename);
        show_global_message_internal(t('audit_saved_as_file', { filename }), 'success');
    } catch (error: unknown) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('Error exporting deficiency types PDF:', error);
        const msg = error instanceof Error ? error.message : String(error);
        show_global_message_internal(`${t('error_exporting_pdf')} ${msg}`.trim(), 'error');
    }
}
