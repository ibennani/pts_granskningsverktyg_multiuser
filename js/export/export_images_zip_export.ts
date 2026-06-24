/**
 * @fileoverview Export av alla granskningsbilder som platt zip-fil med PTS-filnamn.
 */

import { get_audit_export_filename_datetime_segment } from './export_report_filename.js';
import { sanitize_filename_segment, trigger_browser_blob_download } from '../utils/download_filename_utils.js';
import { consoleManager } from '../utils/console_manager.js';
import { get_t_internal, show_global_message_internal } from './export_bootstrap.js';
import { build_export_media_filename_context } from './export_media_filename_context.js';
import {
    build_media_only_export_zip,
    collect_html_export_zip_entries,
    flatten_html_export_zip_entries
} from './export_html_media.js';

async function build_images_zip_download_filename(
    audit: Record<string, unknown> & {
        auditMetadata?: Record<string, unknown>;
        updated_at?: string | null;
    },
    t: (key: string, opts?: Record<string, unknown>) => string
): Promise<string> {
    const am = audit.auditMetadata ?? {};
    const actor_label =
        am.actorName != null && String(am.actorName).trim() !== ''
            ? String(am.actorName)
            : t('filename_fallback_actor');
    const actor_name = sanitize_filename_segment(actor_label);
    const case_number = am.caseNumber != null ? String(am.caseNumber).trim() : '';
    const sanitized_case_number = case_number ? case_number.replace(/[^a-z0-9åäöÅÄÖ-]/gi, '') : '';
    const date_str = get_audit_export_filename_datetime_segment();
    const images_suffix = sanitize_filename_segment(t('images_export_zip_filename_suffix')) || 'bilder';

    if (sanitized_case_number) {
        return `${sanitized_case_number}_${actor_name}_${date_str}_${images_suffix}.zip`;
    }
    return `${actor_name}_${date_str}_${images_suffix}.zip`;
}

export async function export_to_images_zip(
    current_audit: Record<string, unknown> | null | undefined
): Promise<void> {
    consoleManager.log('[ExportLogic] export_to_images_zip called');
    const t = get_t_internal() as (key: string, opts?: Record<string, unknown>) => string;
    if (!current_audit) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[ExportLogic] No audit data provided');
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    try {
        const audit = current_audit as Record<string, unknown> & {
            auditId?: string;
            auditMetadata?: Record<string, unknown>;
            updated_at?: string | null;
        };
        const media_context = await build_export_media_filename_context(audit);
        const zip_entries = collect_html_export_zip_entries(audit, media_context);
        if (zip_entries.length === 0) {
            return;
        }

        const flat_entries = flatten_html_export_zip_entries(zip_entries);
        const { blob, missing_filenames } = await build_media_only_export_zip({
            entries: flat_entries,
            audit_id: audit.auditId
        });
        const zip_filename = await build_images_zip_download_filename(audit, t);

        trigger_browser_blob_download(blob, zip_filename);
        consoleManager.log('[ExportLogic] Images zip export completed:', zip_filename);

        if (missing_filenames.length > 0) {
            show_global_message_internal(
                t('images_export_missing_media_warning', {
                    filename: zip_filename,
                    count: String(missing_filenames.length)
                }),
                'success'
            );
        } else {
            show_global_message_internal(t('audit_saved_as_file', { filename: zip_filename }), 'success');
        }
    } catch (error: unknown) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[ExportLogic] Error exporting images zip:', error);
        const msg = error instanceof Error ? error.message : String(error);
        show_global_message_internal(t('error_exporting_images_zip') + ` ${msg}`, 'error');
    }
}
