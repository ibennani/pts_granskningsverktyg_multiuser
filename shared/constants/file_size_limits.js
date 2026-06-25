/**
 * @fileoverview Gemensam maxstorlek (50 MiB) för filer i klient, API och nedladdning.
 */

/** Max storlek per fil (50 MiB). */
export const FILE_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Visningsetikett för max filstorlek i UI (t.ex. "50 MB").
 */
export function format_file_max_size_label() {
    const mib = FILE_MAX_BYTES / (1024 * 1024);
    return `${mib} MB`;
}
