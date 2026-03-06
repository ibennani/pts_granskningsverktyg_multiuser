/**
 * Delad filnamnsgenerering för granskningsfiler.
 * Används av både klient (nedladdning) och server (backup).
 */

export function generate_audit_filename(audit_data, t_func, options = {}) {
    const now = new Date();
    const time_str = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    const datetime_str = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${time_str}`;

    const filename_prefix = t_func('filename_audit_prefix');
    let actor_name_part = t_func('filename_fallback_actor');

    if (audit_data?.auditMetadata?.actorName) {
        const sanitized_name = audit_data.auditMetadata.actorName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_.-]/g, '');

        actor_name_part = sanitized_name || t_func('filename_fallback_actor');
    }

    const case_number = (audit_data?.auditMetadata?.caseNumber || '').trim();
    const safe_case_number = case_number.replace(/[<>:"/\\|?*\x00-\x1F]/g, '');
    const case_number_prefix = safe_case_number ? `${safe_case_number}_` : '';

    let base_name = `${case_number_prefix}${filename_prefix}_${actor_name_part}_${datetime_str}`;

    if (options && typeof options.backup_suffix_key === 'string' && options.backup_suffix_key.trim() !== '') {
        let suffix_label = t_func(options.backup_suffix_key);
        if (!suffix_label || typeof suffix_label !== 'string') {
            suffix_label = 'backup';
        }
        const sanitized_suffix = suffix_label
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_.-]/g, '');
        if (sanitized_suffix) {
            base_name = `${base_name}_${sanitized_suffix}`;
        }
    }

    return `${base_name}.json`;
}
