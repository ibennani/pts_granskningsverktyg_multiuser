/**
 * @fileoverview Gemensam maxstorlek (50 MiB) för filer i klient, API och nedladdning.
 */

/** Max storlek per fil (50 MiB). */
export const FILE_MAX_BYTES = 50 * 1024 * 1024;

/** Max storlek för PDF bilaga 3 (20 MiB). */
export const SCREENSHOTS_APPENDIX_PDF_MAX_BYTES = 20 * 1024 * 1024;

/** Max storlek för zip med alla sidrapporter (100 MiB). */
export const SNAPSHOTS_DOWNLOAD_ALL_MAX_BYTES = 100 * 1024 * 1024;

/** Max storlek för uppladdad gransknings-säkerhetskopia (ZIP, 100 MiB). */
export const AUDIT_BACKUP_ZIP_MAX_BYTES = 100 * 1024 * 1024;

/**
 * Visningsetikett för max filstorlek i UI (t.ex. "50 MB").
 * @param {number} [bytes]
 */
export function format_file_max_size_label(bytes = FILE_MAX_BYTES) {
    const mib = bytes / (1024 * 1024);
    return `${mib} MB`;
}
