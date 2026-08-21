/**
 * @fileoverview Zip-export av bilaga 1–3 (PDF sammanfattning, Excel-protokoll, PDF bilder).
 */
import JSZip from 'jszip';
import { consoleManager } from '../utils/console_manager.js';
import { trigger_browser_blob_download } from '../utils/download_filename_utils.js';
import { get_t_internal, show_global_message_internal, t_plain_internal } from './export_bootstrap.js';
import { build_excel_export_blob } from './export_excel.js';
import {
    build_deficiency_types_appendix_pdf_blob,
    build_screenshots_appendix_pdf_blob,
} from './export_pdf_main_flow.js';
import { build_all_appendices_zip_filename } from './export_report_filename.js';
import { has_screenshots_appendix_images } from './export_screenshots_appendix_collect.js';
import { finalize_export_catch } from './export_error_handling.js';

type AppendixZipEntry = {
    filename: string;
    blob: Blob;
};

async function collect_appendix_zip_entries(
    audit: Record<string, unknown>
): Promise<{ entries: AppendixZipEntry[]; missing_media_count: number }> {
    const entries: AppendixZipEntry[] = [];
    let missing_media_count = 0;

    const deficiency_blob = await build_deficiency_types_appendix_pdf_blob(audit);
    if (deficiency_blob) {
        entries.push(deficiency_blob);
    }

    const excel_blob = await build_excel_export_blob(audit);
    if (excel_blob) {
        entries.push(excel_blob);
    }

    if (has_screenshots_appendix_images(audit)) {
        const screenshots_blob = await build_screenshots_appendix_pdf_blob(audit);
        if (screenshots_blob) {
            entries.push({
                filename: screenshots_blob.filename,
                blob: screenshots_blob.blob,
            });
            missing_media_count = screenshots_blob.missing_filenames.length;
        }
    }

    return { entries, missing_media_count };
}

export async function export_audit_appendices_zip(
    current_audit: Record<string, unknown> | null | undefined
): Promise<void> {
    const t = get_t_internal() as (key: string, opts?: Record<string, unknown>) => string;
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    const audit_id = current_audit.auditId;
    if (!audit_id || typeof audit_id !== 'string') {
        show_global_message_internal(t('error_exporting_pdf_no_server_id'), 'error');
        return;
    }

    consoleManager.log('[ExportLogic] export_audit_appendices_zip called');

    try {
        show_global_message_internal(t('audit_actions_all_appendices_zip_preparing'), 'info');
        const { entries, missing_media_count } = await collect_appendix_zip_entries(current_audit);
        if (entries.length === 0) {
            show_global_message_internal(t('audit_actions_all_appendices_zip_empty'), 'error');
            return;
        }

        const zip = new JSZip();
        for (const entry of entries) {
            zip.file(entry.filename, entry.blob);
        }

        const zip_blob = await zip.generateAsync({ type: 'blob' });
        const zip_filename = build_all_appendices_zip_filename(
            current_audit as { auditMetadata?: { caseNumber?: string; actorName?: string } },
            t
        );

        trigger_browser_blob_download(zip_blob, zip_filename);
        consoleManager.log('[ExportLogic] Appendices zip export completed:', zip_filename);

        if (missing_media_count > 0) {
            show_global_message_internal(
                t_plain_internal('screenshots_appendix_missing_media_warning', {
                    count: String(missing_media_count),
                }),
                'success'
            );
        } else {
            show_global_message_internal(t_plain_internal('audit_saved_as_file', { filename: zip_filename }), 'success');
        }
    } catch (error: unknown) {
        finalize_export_catch(error, (err) => {
            if (window.ConsoleManager?.warn) {
                window.ConsoleManager.warn('[ExportLogic] Error exporting appendices zip:', err);
            }
            const msg = err instanceof Error ? err.message : String(err);
            show_global_message_internal(t('error_exporting_audit_appendices_zip') + ` ${msg}`, 'error');
        });
    }
}
