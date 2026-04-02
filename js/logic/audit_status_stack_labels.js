/**
 * Hjälpfunktioner för visning av kravstatusfördelning (staplad balk).
 * Procent visas aldrig som 0 %; inga negativa värden i beräkningen.
 */

/**
 * @param {number} count
 * @param {number} total
 * @param {function(number, string, object=): string} format_number_locally
 * @param {string} lang_code
 * @returns {string|null} Text som " (12,3 %)" eller null om procent inte ska visas
 */
export function format_nonzero_percent_suffix(count, total, format_number_locally, lang_code) {
    const safe_count = Math.max(0, Math.floor(Number(count)) || 0);
    const safe_total = Math.max(0, Math.floor(Number(total)) || 0);
    if (safe_count <= 0 || safe_total <= 0) {
        return null;
    }
    const pct_raw = (100 * safe_count) / safe_total;
    if (!(pct_raw > 0)) {
        return null;
    }
    if (typeof format_number_locally !== 'function') {
        return null;
    }
    const formatted = format_number_locally(pct_raw, lang_code, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });
    if (formatted === '---') {
        return null;
    }
    const num = parseFloat(String(formatted).replace(/\s/g, '').replace(',', '.'));
    if (Number.isNaN(num) || num <= 0) {
        return null;
    }
    return ` (${formatted} %)`;
}

/**
 * Procentsuffix för granskningsöversiktens fördelningslista: alltid ett värde när total > 0,
 * inklusive 0 st → « (0,0 %)».
 *
 * @param {number} count
 * @param {number} total
 * @param {function(number, string, object=): string} format_number_locally
 * @param {string} lang_code
 * @returns {string}
 */
export function format_overview_distribution_percent_suffix(count, total, format_number_locally, lang_code) {
    const safe_count = Math.max(0, Math.floor(Number(count)) || 0);
    const safe_total = Math.max(0, Math.floor(Number(total)) || 0);
    if (safe_total <= 0) {
        return '';
    }
    const pct_raw = (100 * safe_count) / safe_total;
    if (typeof format_number_locally !== 'function') {
        return '';
    }
    const formatted = format_number_locally(pct_raw, lang_code, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });
    if (formatted === '---') {
        return '';
    }
    return ` (${formatted} %)`;
}
