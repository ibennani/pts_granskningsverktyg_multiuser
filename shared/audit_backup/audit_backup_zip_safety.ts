/**
 * @fileoverview Säkerhetskontroll av sökvägar i ZIP-arkiv (zip-slip).
 */

/**
 * Returnerar true om sökvägen kan packas upp säkert (inga .. eller absoluta sökvägar).
 */
export function is_safe_zip_entry_path(entry_path: string): boolean {
    const normalized = entry_path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized === '.') {
        return false;
    }
    const parts = normalized.split('/');
    return !parts.some((part) => part === '..' || part === '');
}
