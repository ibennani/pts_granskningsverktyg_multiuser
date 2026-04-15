// js/logic/save_audit_logic.ts

import { generate_audit_filename, type GenerateAuditFilenameOptions } from '../utils/filename_utils';
import { attach_export_integrity_to_audit_payload } from '../utils/export_integrity.js';
import { consoleManager } from '../utils/console_manager.js';

/** Endast för enhetstest — produktion anropar utan detta femte argument. */
export type SaveAuditToJsonFileDepsOverride = {
    generate_audit_filename?: typeof generate_audit_filename;
    attach_export_integrity_to_audit_payload?: typeof attach_export_integrity_to_audit_payload;
};

async function try_get_server_filename_datetime(): Promise<string | null> {
    try {
        const r = await fetch('/api/time/filename-datetime', { credentials: 'include' });
        if (!r.ok) return null;
        const data = await r.json();
        const v = data && typeof data.filename_datetime === 'string' ? data.filename_datetime.trim() : '';
        return v || null;
    } catch {
        return null;
    }
}

/** Startar nedladdning av JSON i webbläsaren (Blob + temporär länk). */
function perform_client_json_download(filename: string, payload_for_file: unknown): void {
    const data_str = JSON.stringify(payload_for_file, null, 2);
    const blob = new Blob([data_str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

    const server_dt = await try_get_server_filename_datetime();
    const filename_options: GenerateAuditFilenameOptions = { ...(options || {}) };
    if (server_dt) {
        filename_options.datetime_str_override = server_dt;
    }
    const gen_fn = deps_override?.generate_audit_filename ?? generate_audit_filename;
    const attach_fn = deps_override?.attach_export_integrity_to_audit_payload ?? attach_export_integrity_to_audit_payload;

    const filename = gen_fn(current_audit_data, t_func, filename_options);

    let payload_for_file: unknown;
    try {
        payload_for_file = await attach_fn(current_audit_data);
    } catch (e) {
        if (show_notification_func) show_notification_func(t_func('error_internal'), 'error');
        if (w.ConsoleManager?.warn) w.ConsoleManager.warn('[SaveAuditLogic] exportIntegrity misslyckades:', e);
        return;
    }

    perform_client_json_download(filename, payload_for_file);

    try {
        if (w.DraftManager?.commitCurrentDraft) {
            w.DraftManager.commitCurrentDraft();
        }
    } catch (e) {
        if (w.ConsoleManager?.warn) w.ConsoleManager.warn('[SaveAuditLogic] Could not commit draft after save:', e);
    }

    if (show_notification_func) show_notification_func(t_func('audit_saved_as_file', { filename }), 'success');
    consoleManager.log(`[SaveAuditLogic] Audit saved as ${filename}`);
}

consoleManager.log('[save_audit_logic.ts] SaveAuditLogic loaded.');
