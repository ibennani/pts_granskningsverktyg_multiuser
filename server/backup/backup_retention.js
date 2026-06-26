/**
 * Gemensam retention-logik för säkerhetskopior.
 * Raderar poster äldre än retention_days men behåller alltid min_count nyaste.
 */

export const DEFAULT_MIN_BACKUPS = 5;

/**
 * Beräknar cutoff-tid i millisekunder från retention_days och referenstid.
 * @param {number} retention_days
 * @param {Date} now
 * @returns {number}
 */
export function compute_retention_cutoff_time(retention_days, now = new Date()) {
    const cutoff = new Date(now.getTime());
    cutoff.setDate(cutoff.getDate() - retention_days);
    return cutoff.getTime();
}

/**
 * Väljer vilka poster som får raderas enligt daggräns och minimiantal.
 * @param {Array<{ id: string, mtimeMs: number }>} entries
 * @param {{ retention_days: number, min_count?: number, now?: Date }} options
 * @returns {string[]} id för poster som ska raderas
 */
export function select_entries_for_retention_deletion(entries, options) {
    const { retention_days, min_count = DEFAULT_MIN_BACKUPS, now = new Date() } = options;
    if (!Array.isArray(entries) || entries.length === 0) return [];

    const cutoff_time = compute_retention_cutoff_time(retention_days, now);
    const sorted = [...entries].sort((a, b) => {
        if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
        return a.id.localeCompare(b.id);
    });

    const protected_ids = new Set(
        sorted.slice(0, Math.max(0, min_count)).map((entry) => entry.id)
    );

    return sorted
        .filter((entry) => !protected_ids.has(entry.id) && entry.mtimeMs < cutoff_time)
        .map((entry) => entry.id);
}
