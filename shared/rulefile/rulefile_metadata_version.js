/**
 * @file Beräknar nästa versionssträng för regelfilers metadata.version.
 *
 * Format: YYYY.M.rN (t.ex. 2026.5.r3)
 * - Om current_version_string matchar formatet och har samma år+månad som reference_date: öka r med 1
 * - Annars: starta om på YYYY.M.r1 för reference_date
 */

/**
 * @param {unknown} current_version_string
 * @param {Date} reference_date
 * @returns {string}
 */
export function compute_next_rulefile_metadata_version(current_version_string, reference_date) {
    const today = reference_date instanceof Date ? reference_date : new Date();
    const current_year = today.getFullYear();
    const current_month = today.getMonth() + 1;

    const version_match =
        typeof current_version_string === 'string'
            ? current_version_string.match(/^(\d{4})\.(\d{1,2})\.r(\d+)$/)
            : null;

    if (version_match) {
        const [, version_year, version_month, release] = version_match;
        const version_year_number = parseInt(version_year, 10);
        const version_month_number = parseInt(version_month, 10);
        if (version_year_number === current_year && version_month_number === current_month) {
            return `${current_year}.${current_month}.r${parseInt(release, 10) + 1}`;
        }
    }

    return `${current_year}.${current_month}.r1`;
}

