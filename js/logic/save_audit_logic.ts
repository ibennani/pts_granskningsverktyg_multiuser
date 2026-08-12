// js/logic/save_audit_logic.ts

import { generate_audit_filename, type GenerateAuditFilenameOptions } from '../utils/filename_utils';
import { attach_export_integrity_to_audit_payload } from '../utils/export_integrity.js';
import { consoleManager } from '../utils/console_manager.js';
import { trigger_browser_blob_download, get_download_filename_datetime } from '../utils/download_filename_utils';
import {
    audit_backup_download_filename,
    build_audit_backup_zip,
} from './audit_backup_zip_export.js';

/** Endast för enhetstest — produktion anropar utan detta femte argument. */
export type SaveAuditToJsonFileDepsOverride = {
    generate_audit_filename?: typeof generate_audit_filename;
    attach_export_integrity_to_audit_payload?: typeof attach_export_integrity_to_audit_payload;
    build_audit_backup_zip?: typeof build_audit_backup_zip;
};

/** Startar nedladdning av säkerhetskopia (ZIP) i webbläsaren. */
function perform_client_backup_download(filename: string, blob: Blob): void {
    trigger_browser_blob_download(blob, filename);
}

export async function save_audit_to_json_file(
    current_audit_data: any,
    t_func: (key: string, params?: Record<string, unknown>) => string,
    show_notification_func?: ((message: string, type?: string) => void) | null,
    options?: GenerateAuditFilenameOptions,
    deps_override?: SaveAuditToJsonFileDepsOverride | null
): Promise<void> {
    const w = window as any;
    if (!current_audit_data) {
        if (show_notification_func) show_notification_func(t_func('no_audit_data_to_save'), 'error');
        if (w.ConsoleManager?.warn) w.ConsoleManager.warn('[SaveAuditLogic] No audit data provided to save.');
        return;
    }

    const updated_iso = current_audit_data?.updated_at ?? current_audit_data?.updatedAt ?? null;
    const filename_options: GenerateAuditFilenameOptions = {
        ...(options || {}),
        datetime_str_override: get_download_filename_datetime(updated_iso),
    };
    const gen_fn = deps_override?.generate_audit_filename ?? generate_audit_filename;
    const attach_fn = deps_override?.attach_export_integrity_to_audit_payload ?? attach_export_integrity_to_audit_payload;
    const zip_fn = deps_override?.build_audit_backup_zip ?? build_audit_backup_zip;

    const json_filename = gen_fn(current_audit_data, t_func, filename_options);
    const download_filename = audit_backup_download_filename(json_filename);

    let payload_for_file: unknown;
    try {
        payload_for_file = await attach_fn(current_audit_data);
    } catch (e) {
        if (show_notification_func) show_notification_func(t_func('error_internal'), 'error');
        if (w.ConsoleManager?.warn) w.ConsoleManager.warn('[SaveAuditLogic] exportIntegrity misslyckades:', e);
        return;
    }

    let zip_blob: Blob;
    let missing_media: string[] = [];
    try {
        const zip_result = await zip_fn(payload_for_file as Record<string, unknown>);
        zip_blob = zip_result.blob;
        missing_media = zip_result.missing_media;
    } catch (e) {
        if (show_notification_func) show_notification_func(t_func('error_internal'), 'error');
        if (w.ConsoleManager?.warn) w.ConsoleManager.warn('[SaveAuditLogic] ZIP-export misslyckades:', e);
        return;
    }

    perform_client_backup_download(download_filename, zip_blob);

    try {
        if (w.DraftManager?.commitCurrentDraft) {
            w.DraftManager.commitCurrentDraft();
        }
    } catch (e) {
        if (w.ConsoleManager?.warn) w.ConsoleManager.warn('[SaveAuditLogic] Could not commit draft after save:', e);
    }

    if (show_notification_func) {
        show_notification_func(t_func('audit_saved_as_file', { filename: download_filename }), 'success');
        if (missing_media.length > 0) {
            show_notification_func(
                t_func('audit_backup_export_missing_media', { count: missing_media.length }),
                'warning'
            );
        }
    }
    consoleManager.log(`[SaveAuditLogic] Audit saved as ${download_filename}`);
}

consoleManager.log('[save_audit_logic.ts] SaveAuditLogic loaded.');
