/**
 * @fileoverview Enhetlig formatering av byggtid för visning i svensk tid (Europe/Stockholm).
 * Används vid produktionsbygge (Node) och i webbläsaren samma tidszon alltid gäller.
 */

export const BUILD_DISPLAY_TIMEZONE = 'Europe/Stockholm';

const date_parts = {
    timeZone: BUILD_DISPLAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
};

const time_parts_no_sec = {
    timeZone: BUILD_DISPLAY_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
};

const time_parts_with_sec = {
    ...time_parts_no_sec,
    second: '2-digit',
};

/**
 * Formaterar ett ögonblick till datum, tid och ISO-tidsstämpel för build-info.
 * @param {Date|string|number} date_input - Datum eller ISO-sträng
 * @param {{ include_seconds?: boolean }} [options]
 * @returns {{ timestamp: string, date: string, time: string }}
 */
export function format_build_info_object(date_input, options = {}) {
    const { include_seconds = false } = options;
    const d = date_input instanceof Date ? date_input : new Date(date_input);
    const date_formatter = new Intl.DateTimeFormat('sv-SE', date_parts);
    const time_formatter = new Intl.DateTimeFormat(
        'sv-SE',
        include_seconds ? time_parts_with_sec : time_parts_no_sec
    );
    return {
        timestamp: d.toISOString(),
        date: date_formatter.format(d),
        time: time_formatter.format(d),
    };
}
