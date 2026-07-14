/**
 * @fileoverview Validering av Word-filer (.docx) för import i klienten.
 */

export const WORD_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export const WORD_DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const WORD_DOCX_ACCEPT = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Kontrollerar om filen ser ut som en .docx-fil utifrån namn och MIME.
 */
export function is_word_docx_file(file: File): boolean {
    const name = String(file.name || '').trim().toLowerCase();
    const type = String(file.type || '').trim().toLowerCase();
    if (name.endsWith('.docx')) return true;
    if (type === WORD_DOCX_MIME) return true;
    if (type === 'application/zip' && name.endsWith('.docx')) return true;
    if (type === 'application/octet-stream' && name.endsWith('.docx')) return true;
    return false;
}

/**
 * Filtrerar till högst en giltig .docx-fil inom storleksgränsen.
 */
export function pick_single_word_docx_file(
    files: Iterable<File> | null | undefined,
    max_bytes: number = WORD_IMPORT_MAX_BYTES
): File | null {
    if (!files) return null;
    for (const file of files) {
        if (!is_word_docx_file(file)) continue;
        if (typeof max_bytes === 'number' && file.size > max_bytes) continue;
        if (!String(file.name || '').trim()) continue;
        return file;
    }
    return null;
}
