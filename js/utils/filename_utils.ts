/**
 * Delad filnamnsgenerering för granskningsfiler.
 * Används av både klient (nedladdning) och server (backup).
 */

import { format_filename_date_for_download } from '../../shared/datetime/filename_datetime.js';
import { get_download_filename_datetime, get_download_filename_date } from './download_filename_utils.js';

/** @deprecated Använd get_download_filename_date från download_filename_utils.ts */
export function format_local_date_for_filename(date: Date = new Date(), separator = ''): string {
    return format_filename_date_for_download(date, separator);
}

/** @deprecated Använd get_download_filename_datetime från download_filename_utils.ts */
export function format_local_datetime_for_filename(
    date: Date = new Date(),
    date_separator = '',
    time_separator = ''
): string {
    if (date_separator || time_separator) {
        const date_part = get_download_filename_date(null, date_separator);
        const parts = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'Europe/Stockholm',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).formatToParts(date);
        const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
        const hour = get('hour');
        const minute = get('minute');
        const second = get('second');
        const time_part = time_separator
            ? `${hour}${time_separator}${minute}${time_separator}${second}`
            : `${hour}${minute}${second}`;
        return `${date_part}_${time_part}`;
    }
    return get_download_filename_datetime(null);
}

export type GenerateAuditFilenameOptions = {
    /**
     * Valfri suffix-nyckel (översättningsnyckel) för filnamnet,
     * används t.ex. för "backup" i uppdatera-regelfil-flödet.
     */
    backup_suffix_key?: string;
    /**
     * Om satt används exakt denna tidssträng i filnamnet.
     * Tänkt för servertid (så filnamnet matchar serverns klockslag),
     * med fallback till klientens lokala tid om den saknas.
     *
     * Format: YYYYMMDD_HHMMSS (samma som get_download_filename_datetime()).
     */
    datetime_str_override?: string;
};

type TranslationFunc = (key: string, params?: Record<string, unknown>) => string;

export function generate_audit_filename(
    audit_data: any,
    t_func: TranslationFunc,
    options: GenerateAuditFilenameOptions = {}
): string {
    const override = typeof options.datetime_str_override === 'string' ? options.datetime_str_override.trim() : '';
    const datetime_str = override || get_download_filename_datetime(null);

    const filename_prefix = t_func('filename_audit_prefix');
    let actor_name_part = t_func('filename_fallback_actor');

    if (audit_data?.auditMetadata?.actorName) {
        const sanitized_name = String(audit_data.auditMetadata.actorName)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_.-]/g, '');

        actor_name_part = sanitized_name || t_func('filename_fallback_actor');
    }

    const case_number = String(audit_data?.auditMetadata?.caseNumber || '').trim();
    const safe_case_number = case_number.replace(/[<>:"/\\|?*\x00-\x1F]/g, '');
    const case_number_prefix = safe_case_number ? `${safe_case_number}_` : '';

    let base_name = `${case_number_prefix}${filename_prefix}_${actor_name_part}_${datetime_str}`;

    if (options && typeof options.backup_suffix_key === 'string' && options.backup_suffix_key.trim() !== '') {
        let suffix_label = t_func(options.backup_suffix_key);
        if (!suffix_label || typeof suffix_label !== 'string') {
            suffix_label = 'backup';
        }
        const sanitized_suffix = String(suffix_label)
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

