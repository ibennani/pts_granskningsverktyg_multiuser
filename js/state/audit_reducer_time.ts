// @ts-nocheck
/**
 * @file Delad ISO UTC-tidsstämpel för audit-reducer och utbrutna handlare.
 */

export function get_current_iso_datetime_utc() {
    return new Date().toISOString();
}
