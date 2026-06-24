/**
 * @file Tolka och formatera datumtext enligt användarens språk (t.ex. sv-SE, en-GB, nb-NO).
 */

import { format_iso_to_local_date } from './date_format.js';

export type LocaleDateParseResult =
    | { ok: true; iso_date: string }
    | { ok: false; reason: 'empty' | 'invalid' };

const SEPARATOR_CLASS = '[/.\\-]';

function validate_ymd_to_iso(year: number, month: number, day: number): LocaleDateParseResult {
    if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
        return { ok: false, reason: 'invalid' };
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return { ok: false, reason: 'invalid' };
    }
    const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`;
    return { ok: true, iso_date: iso };
}

function parse_trailing_year_text(first: number, second: number, year: number, lang_code: string): LocaleDateParseResult {
    const normalized = (lang_code || '').toLowerCase();
    const month_before_day = normalized.startsWith('en-us');
    const day = month_before_day ? second : first;
    const month = month_before_day ? first : second;
    return validate_ymd_to_iso(year, month, day);
}

/** Exempeldatum formaterat enligt locale (för hjälptext). */
export function get_locale_date_format_example(lang_code = 'sv-SE'): string {
    return format_iso_to_local_date('2024-06-15T00:00:00.000Z', lang_code);
}

/** ISO → text enligt samma locale som visning i övriga vyn. */
export function format_iso_for_locale_date_input(iso_string: string, lang_code = 'sv-SE'): string {
    if (!iso_string) return '';
    return format_iso_to_local_date(iso_string, lang_code);
}

/** Tolka datumtext med punkt, bindestreck eller snedstreck. Tom sträng → empty. */
export function parse_locale_date_text_to_iso_date(text: string, lang_code = 'sv-SE'): LocaleDateParseResult {
    const trimmed = (text || '').trim();
    if (!trimmed) return { ok: false, reason: 'empty' };

    const ymd = trimmed.match(new RegExp(`^(\\d{4})${SEPARATOR_CLASS}(\\d{1,2})${SEPARATOR_CLASS}(\\d{1,2})$`));
    if (ymd) {
        return validate_ymd_to_iso(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
    }

    const dmy = trimmed.match(new RegExp(`^(\\d{1,2})${SEPARATOR_CLASS}(\\d{1,2})${SEPARATOR_CLASS}(\\d{4})$`));
    if (dmy) {
        return parse_trailing_year_text(Number(dmy[1]), Number(dmy[2]), Number(dmy[3]), lang_code);
    }

    return { ok: false, reason: 'invalid' };
}

/** Normalisera giltig inmatning till locale-format (t.ex. vid blur). */
export function normalize_locale_date_text_display(text: string, lang_code = 'sv-SE'): string {
    const parsed = parse_locale_date_text_to_iso_date(text, lang_code);
    if (!parsed.ok) return (text || '').trim();
    return format_iso_for_locale_date_input(parsed.iso_date, lang_code);
}
