/**
 * Delad filnamnsgenerering för granskningsfiler.
 * Används av både klient (nedladdning) och server (backup).
 */

export function format_local_date_for_filename(date = new Date(), separator = '') {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return separator ? `${year}${separator}${month}${separator}${day}` : `${year}${month}${day}`;
}

export function format_local_datetime_for_filename(date = new Date(), date_separator = '', time_separator = '') {
    const date_part = format_local_date_for_filename(date, date_separator);
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    const time_part = time_separator ? `${hour}${time_separator}${minute}${time_separator}${second}` : `${hour}${minute}${second}`;
    return `${date_part}_${time_part}`;
}

export function generate_audit_filename(audit_data, t_func, options = {}) {
    const datetime_str = format_local_datetime_for_filename();

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
