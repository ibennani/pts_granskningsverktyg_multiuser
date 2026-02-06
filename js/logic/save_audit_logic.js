// js/logic/save_audit_logic.js
'use-strict';


function _generate_filename(audit_data, t_func) {
    const now = new Date();
    const time_str = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    const datetime_str = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${time_str}`;
    
    // Hämta prefix från språkfil, med en säker fallback
    const filename_prefix = t_func('filename_audit_prefix');

    let actor_name_part = t_func('filename_fallback_actor');

    if (audit_data?.auditMetadata?.actorName) {
        // --- NY, FÖRBÄTTRAD LOGIK FÖR FILNAMN ---
        const sanitized_name = audit_data.auditMetadata.actorName
            .normalize('NFD') // Steg 1: Bryt ner tecken (t.ex. 'å' -> 'a' + '°')
            .replace(/[\u0300-\u036f]/g, '') // Steg 2: Ta bort diakritiska tecken (accenterna)
            .toLowerCase() // Steg 3: Konvertera till gemener
            .replace(/\s+/g, '_') // Steg 4: Ersätt mellanslag med understreck
            .replace(/[^a-z0-9_.-]/g, ''); // Steg 5: Ta bort alla återstående ogiltiga tecken

        actor_name_part = sanitized_name || t_func('filename_fallback_actor');
    }
    
    return `${filename_prefix}_${actor_name_part}_${datetime_str}.json`;
}

export function save_audit_to_json_file(current_audit_data, t_func, show_notification_func) {
    if (!current_audit_data) {
        if (show_notification_func) show_notification_func(t_func('no_audit_data_to_save'), 'error');
        console.error("[SaveAuditLogic] No audit data provided to save.");
        return;
    }

    const filename = _generate_filename(current_audit_data, t_func);
    const data_str = JSON.stringify(current_audit_data, null, 2);
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
        console.warn("[SaveAuditLogic] Could not commit draft after save:", e);
    }

    if (show_notification_func) show_notification_func(t_func('audit_saved_as_file', { filename: filename }), 'success');
    console.log(`[SaveAuditLogic] Audit saved as ${filename}`);
}

console.log("[save_audit_logic.js] SaveAuditLogic loaded.");
