/**
 * Versionsjämförelse för regelfiler (format: år.månad.rX, t.ex. 2026.2.r27).
 * @param {string} version_str - Versionssträng
 * @returns {[number, number, number]} [år, månad, r]
 */
export function parse_version_for_compare(version_str) {
    if (!version_str || typeof version_str !== 'string') return [0, 0, 0];
    const m = version_str.trim().match(/^(\d{4})\.(\d{1,2})\.r(\d+)$/i);
    if (!m) return [0, 0, 0];
    return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

/**
 * Returnerar true om a är större än b.
 * @param {string} a_str - Versionssträng a
 * @param {string} b_str - Versionssträng b
 * @returns {boolean}
 */
export function version_greater_than(a_str, b_str) {
    const a = parse_version_for_compare(a_str);
    const b = parse_version_for_compare(b_str);
    if (a[0] !== b[0]) return a[0] > b[0];
    if (a[1] !== b[1]) return a[1] > b[1];
    return a[2] > b[2];
}
