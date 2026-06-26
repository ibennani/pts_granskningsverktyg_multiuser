/**
 * @fileoverview PDF-export (krav): bygger HTML och anropar server-Puppeteer.
 */
import { consoleManager } from '../utils/console_manager.js';
import { get_t_internal, show_global_message_internal } from './export_bootstrap.js';
import {
    build_report_export_filename,
    build_deficiency_types_appendix_pdf_filename,
    build_screenshots_appendix_pdf_filename,
} from './export_report_filename.js';
import {
    build_report_body_sorted_by_requirements,
    build_report_body_sorted_by_samples,
    build_report_pdf_intro_html,
    build_report_pdf_html_document,
    type ExportReportHtmlT,
} from './export_report_html_criterias.js';
import { build_deficiency_types_appendix_pdf_document } from './export_report_html_deficiency_types.js';
import { build_screenshots_appendix_pdf_html_within_limit } from './export_screenshots_appendix_pdf_encode.js';
import { prepare_screenshots_appendix_media } from './export_screenshots_appendix_media.js';
import { api_post_pdf } from '../api/client.js';
import { trigger_browser_blob_download } from '../utils/download_filename_utils.js';
import {
    assert_pdf_export_html_within_limit,
} from './export_pdf_html_size_error.js';
import { throw_pdf_export_user_error } from './export_pdf_user_errors.js';

function handle_pdf_export_error(
    error: unknown,
    t: ExportReportHtmlT,
    message_key: 'export_screenshots_appendix_too_large' | 'export_pdf_html_too_large',
    log_label: string
): never {
    if (window.ConsoleManager?.warn) {
        window.ConsoleManager.warn(log_label, error);
    }
    throw_pdf_export_user_error(t, error, message_key);
}

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

        assert_pdf_export_html_within_limit(html_content, 'export_pdf_html_too_large');

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
        handle_pdf_export_error(error, t, 'export_pdf_html_too_large', 'Error exporting to PDF:');
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

        assert_pdf_export_html_within_limit(html_content, 'export_pdf_html_too_large');

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
        handle_pdf_export_error(error, t, 'export_pdf_html_too_large', 'Error exporting samples PDF:');
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
        assert_pdf_export_html_within_limit(html_content, 'export_pdf_html_too_large');
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
        handle_pdf_export_error(error, t, 'export_pdf_html_too_large', 'Error exporting deficiency types PDF:');
    }
}

export async function export_to_pdf_screenshots_appendix(
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

    consoleManager.log('[PDF Export] Starting export_to_pdf_screenshots_appendix');

    try {
        const { items, missing_filenames } = await prepare_screenshots_appendix_media(
            current_audit as Record<string, unknown> & { auditId?: string | null }
        );
        if (items.length === 0) {
            show_global_message_internal(t('export_screenshots_appendix_empty'), 'error');
            return;
        }

        const html_content = await build_screenshots_appendix_pdf_html_within_limit(
            current_audit,
            items,
            t
        );
        const pdf_blob = await api_post_pdf(`/audits/${encodeURIComponent(audit_id)}/export/pdf-requirements`, {
            htmlContent: html_content,
        });

        const filename = build_screenshots_appendix_pdf_filename(
            current_audit as { auditMetadata?: { caseNumber?: string; actorName?: string }; updated_at?: string | null },
            t
        );

        trigger_browser_blob_download(pdf_blob, filename);
        if (missing_filenames.length > 0) {
            show_global_message_internal(
                t('screenshots_appendix_missing_media_warning', {
                    count: String(missing_filenames.length),
                }),
                'success'
            );
        } else {
            show_global_message_internal(t('audit_saved_as_file', { filename }), 'success');
        }
    } catch (error: unknown) {
        handle_pdf_export_error(
            error,
            t,
            'export_screenshots_appendix_too_large',
            'Error exporting screenshots appendix PDF:'
        );
    }
}
