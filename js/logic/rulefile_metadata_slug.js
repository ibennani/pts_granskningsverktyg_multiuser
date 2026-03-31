/**
 * Hjälpfunktioner för slug-generering vid regelfilsmetadata (innehållstyper, taxonomier m.m.).
 * @module js/logic/rulefile_metadata_slug
 */

/**
 * Normaliserar text till en URL-vänlig slug (gemener, diakriter bort, bindestreck).
 * @param {unknown} value
 * @returns {string}
 */
export function generate_slug(value) {
    if (!value) return '';
    return value.toString().trim().toLowerCase()
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Lägger till ett unikt id i mängden `slugSet`, baserat på önskat värde eller reserv.
 * @param {Set<string>} slugSet
 * @param {string} preferred
 * @param {string} fallback
 * @returns {string}
 */
export function ensure_unique_slug(slugSet, preferred, fallback) {
    let base = preferred || fallback || 'item';
    if (!base) base = 'item';
    let candidate = base;
    let counter = 1;
    while (!candidate || slugSet.has(candidate)) {
        candidate = `${base}-${counter++}`;
    }
    slugSet.add(candidate);
    return candidate;
}
