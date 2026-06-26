/**
 * @fileoverview Filnamnsdatum/tid i svensk tidszon (Europe/Stockholm).
 * Används av server-API och klientfallback när samma tidszon ska gälla oavsett
 * processens system-TZ (t.ex. UTC i produktion).
 */

/** Tidszon för filnamn i nedladdningar och backup — svensk lokal tid. */
export const FILENAME_DISPLAY_TIMEZONE = 'Europe/Stockholm';

function to_date(input) {
    if (input instanceof Date) return input;
    return new Date(input);
}

/**
 * Tolka ISO-liknande tidsstämpel från DB/API.
 * Saknas tidszon antas UTC (lägger till Z), så svensk tid blir korrekt i filnamn.
 * @param {string|null|undefined} iso
 * @returns {Date|null}
 */
export function parse_iso_to_date(iso) {
    let s = String(iso || '').trim();
    if (!s) return null;
    const has_timezone = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(s);
    if (!has_timezone && s.includes('T')) {
        s = `${s}Z`;
    } else if (!has_timezone && !s.includes('T') && s.length > 10) {
        s = `${s.replace(' ', 'T')}Z`;
    }
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

/**
 * Filnamnsvänlig datum+tid från valfri ISO-tid, eller \"nu\" om iso saknas.
 * @param {string|null|undefined} [iso]
 * @returns {string}
 */
export function format_filename_datetime_from_iso(iso) {
    const d = parse_iso_to_date(iso) ?? new Date();
    return format_filename_datetime_for_download(d);
}

function part_value(parts, type) {
    return parts.find((p) => p.type === type)?.value ?? '00';
}

function datetime_parts(date_input) {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: FILENAME_DISPLAY_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(to_date(date_input));
}

/**
 * Filnamnsvänlig datum+tid: YYYYMMDD_HHMMSS i Europe/Stockholm.
 * @param {Date|string|number} date_input
 * @returns {string}
 */
export function format_filename_datetime_for_download(date_input) {
    const parts = datetime_parts(date_input);
    const y = part_value(parts, 'year');
    const m = part_value(parts, 'month');
    const day = part_value(parts, 'day');
    const hh = part_value(parts, 'hour');
    const mm = part_value(parts, 'minute');
    const ss = part_value(parts, 'second');
    return `${y}${m}${day}_${hh}${mm}${ss}`;
}

/**
 * Filnamnsvänligt datum med valfritt separator-tecken (t.ex. `-` → YYYY-MM-DD).
 * @param {Date|string|number} date_input
 * @param {string} [separator='']
 * @returns {string}
 */
export function format_filename_date_for_download(date_input, separator = '') {
    const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: FILENAME_DISPLAY_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(to_date(date_input));
    const y = part_value(parts, 'year');
    const m = part_value(parts, 'month');
    const day = part_value(parts, 'day');
    return separator ? `${y}${separator}${m}${separator}${day}` : `${y}${m}${day}`;
}

/**
 * Beräknar offset-sträng (+HH:MM) för Europe/Stockholm vid given tidpunkt.
 * @param {Date|string|number} date_input
 * @returns {string}
 */
function stockholm_offset_string(date_input) {
    const d = to_date(date_input);
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: FILENAME_DISPLAY_TIMEZONE,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).formatToParts(d);
    const get = (type) => parseInt(part_value(parts, type), 10);
    const as_utc_ms = Date.UTC(
        get('year'),
        get('month') - 1,
        get('day'),
        get('hour'),
        get('minute'),
        get('second')
    );
    const offset_minutes = Math.round((as_utc_ms - d.getTime()) / 60000);
    const sign = offset_minutes >= 0 ? '+' : '-';
    const abs = Math.abs(offset_minutes);
    const off_h = String(Math.floor(abs / 60)).padStart(2, '0');
    const off_m = String(abs % 60).padStart(2, '0');
    return `${sign}${off_h}:${off_m}`;
}

/**
 * ISO-liknande sträng i Europe/Stockholm med offset, t.ex. 2026-04-15T13:45:12+02:00
 * @param {Date|string|number} date_input
 * @returns {string}
 */
export function format_local_iso_with_display_timezone_offset(date_input) {
    const parts = datetime_parts(date_input);
    const y = part_value(parts, 'year');
    const m = part_value(parts, 'month');
    const day = part_value(parts, 'day');
    const hh = part_value(parts, 'hour');
    const mm = part_value(parts, 'minute');
    const ss = part_value(parts, 'second');
    const offset = stockholm_offset_string(date_input);
    return `${y}-${m}-${day}T${hh}:${mm}:${ss}${offset}`;
}

/**
 * Sista millisekunden på angiven kalenderdag i Europe/Stockholm, som UTC ISO.
 * @param {string|null|undefined} iso_date ISO med kalenderdatum (t.ex. 2024-06-15T00:00:00.000Z)
 * @returns {string}
 */
export function get_end_of_stockholm_calendar_day_iso(iso_date) {
    const ymd = String(iso_date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
        return String(iso_date || '');
    }
    const probe = parse_iso_to_date(`${ymd}T12:00:00.000Z`) ?? new Date();
    let offset = stockholm_offset_string(probe);
    for (let i = 0; i < 3; i++) {
        const local_end = `${ymd}T23:59:59.999${offset}`;
        const end_date = parse_iso_to_date(local_end);
        if (!end_date) {
            break;
        }
        const refined = stockholm_offset_string(end_date);
        if (refined === offset) {
            return end_date.toISOString();
        }
        offset = refined;
    }
    const fallback = parse_iso_to_date(`${ymd}T23:59:59.999${offset}`);
    return fallback ? fallback.toISOString() : `${ymd}T23:59:59.999Z`;
}
