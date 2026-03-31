// js/logic/save_audit_logic.js
'use-strict';

import { generate_audit_filename } from '../utils/filename_utils.js';
import { attach_export_integrity_to_audit_payload } from '../utils/export_integrity.js';
import { consoleManager } from '../utils/console_manager.js';

export async function save_audit_to_json_file(current_audit_data, t_func, show_notification_func, options) {
    if (!current_audit_data) {
        if (show_notification_func) show_notification_func(t_func('no_audit_data_to_save'), 'error');
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn("[SaveAuditLogic] No audit data provided to save.");
        return;
    }

    const filename = generate_audit_filename(current_audit_data, t_func, options || {});
    let payload_for_file;
    try {
        payload_for_file = await attach_export_integrity_to_audit_payload(current_audit_data);
    } catch (e) {
        if (show_notification_func) show_notification_func(t_func('error_internal'), 'error');
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[SaveAuditLogic] exportIntegrity misslyckades:', e);
        return;
    }
    const data_str = JSON.stringify(payload_for_file, null, 2);
    const blob = new Blob([data_str], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Rensa aktivt utkast efter lyckad manuell sparning
    try {
        if (window.DraftManager?.commitCurrentDraft) {
            window.DraftManager.commitCurrentDraft();
        }
    } catch (e) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn("[SaveAuditLogic] Could not commit draft after save:", e);
    }

    if (show_notification_func) show_notification_func(t_func('audit_saved_as_file', { filename: filename }), 'success');
    consoleManager.log(`[SaveAuditLogic] Audit saved as ${filename}`);
}

consoleManager.log("[save_audit_logic.js] SaveAuditLogic loaded.");
