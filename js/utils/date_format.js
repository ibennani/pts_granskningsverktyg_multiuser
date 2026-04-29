import { get_translation_t } from './translation_access.js';

/**
 * Tidsstämplar från servern (PostgreSQL TIMESTAMP) kommer utan tidszon.
 * Tolka dem som UTC så att toLocaleString() visar rätt lokal tid.
 */
function ensure_utc_for_parsing(iso_string) {
    if (typeof iso_string !== 'string') return iso_string;
    const s = iso_string.trim();
    if (!s) return s;
    if (/Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) return s;
    if (/\d{4}-\d{2}-\d{2}[T \t]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/i.test(s)) return s + 'Z';
    return s;
}

/**
 * @param {string} iso_string - ISO-datum/tid (ev. utan tidszon, tolkas som UTC).
 * @param {string} [lang_code='en-GB'] - Locale för formatering.
 * @param {{ showSeconds?: boolean }} [opts] - showSeconds: false för att inte visa sekunder (standard true).
 */
export function format_iso_to_local_datetime(iso_string, lang_code = 'en-GB', opts = {}) {
    if (!iso_string) return '';
    try {
        const to_parse = ensure_utc_for_parsing(iso_string);
        const date = new Date(to_parse);
        const t_func = get_translation_t();
        if (isNaN(date.getTime())) return t_func('invalid_date_format');

        const options = {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
            hour12: false
        };
        if (opts.showSeconds !== false) options.second = '2-digit';

        return date.toLocaleString(lang_code, options);

    } catch (e) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn("Error formatting date:", iso_string, e);
        const t_func = get_translation_t();
        return t_func('date_formatting_error');
    }
}

/**
 * Formaterar ISO-sträng till lokalt datum utan klockslag (för t.ex. start/sluttid i översikt och Excel).
 */
export function format_iso_to_local_date(iso_string, lang_code = 'en-GB') {
    if (!iso_string) return '';
    try {
        const to_parse = ensure_utc_for_parsing(iso_string);
        const date = new Date(to_parse);
        const t_func = get_translation_t();
        if (isNaN(date.getTime())) return t_func('invalid_date_format');

        return date.toLocaleDateString(lang_code, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch (e) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn("Error formatting date:", iso_string, e);
        const t_func = get_translation_t();
        return t_func('date_formatting_error');
    }
}

export function format_iso_to_relative_time(iso_string, lang_code = 'en-GB') {
    if (!iso_string) return '';
    const t = get_translation_t();

    try {
        const to_parse = ensure_utc_for_parsing(iso_string);
        const date = new Date(to_parse);
        if (isNaN(date.getTime())) return t('invalid_date_format');

        const now = new Date();
        const today_start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday_start = new Date(today_start);
        yesterday_start.setDate(yesterday_start.getDate() - 1);
        const day_before_yesterday_start = new Date(today_start);
        day_before_yesterday_start.setDate(day_before_yesterday_start.getDate() - 2);

        const timeString = date.toLocaleTimeString(lang_code, { hour: '2-digit', minute: '2-digit', hour12: false });

        if (date >= today_start) {
            return t('relative_time_today') + `, ${timeString}`;
        }
        if (date >= yesterday_start) {
            return t('relative_time_yesterday') + `, ${timeString}`;
        }
        if (date >= day_before_yesterday_start) {
            return t('relative_time_day_before_yesterday') + `, ${timeString}`;
        }

        const date_part = date.toLocaleDateString(lang_code, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        return t('relative_time_date_format', { date: date_part });

    } catch (e) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn("Error formatting relative date:", iso_string, e);
        return t('date_formatting_error');
    }
}

