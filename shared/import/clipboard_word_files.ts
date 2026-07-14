/**
 * @fileoverview Hjälpfunktioner för Word-filer (.docx) från urklipp.
 */
import {
    is_word_docx_file,
    WORD_DOCX_MIME,
} from './word_file_validation.js';
import { should_handle_paste_event } from '../media/clipboard_media_files.js';

export { should_handle_paste_event };

function read_word_files_from_data_transfer_items(
    items: DataTransferItemList | null | undefined
): File[] {
    if (!items) return [];
    const files: File[] = [];
    for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item || item.kind !== 'file') continue;
        const file = item.getAsFile();
        if (!file) continue;
        files.push(ensure_word_paste_filename(file));
    }
    return files;
}

/**
 * Säkerställer att klistrad fil har .docx i filnamnet när MIME indikerar Word.
 */
export function ensure_word_paste_filename(file: File): File {
    const name = String(file.name || '').trim();
    if (is_word_docx_file(file)) {
        if (name.toLowerCase().endsWith('.docx')) {
            return file;
        }
        const next_name = name ? `${name.replace(/\.[^.]+$/, '')}.docx` : 'urklipp.docx';
        return new File([file], next_name, {
            type: file.type || WORD_DOCX_MIME,
            lastModified: file.lastModified,
        });
    }
    return file;
}

/**
 * Plockar ut Word-filer från ett paste-event.
 */
export function extract_word_files_from_clipboard_event(event: ClipboardEvent): File[] {
    return read_word_files_from_data_transfer_items(event.clipboardData?.items).filter(is_word_docx_file);
}

/**
 * Plockar ut alla filer från paste-event (för felmeddelanden).
 */
export function extract_all_files_from_clipboard_event(event: ClipboardEvent): File[] {
    return read_word_files_from_data_transfer_items(event.clipboardData?.items);
}

/**
 * Returnerar true om urklippet innehåller filer som inte är Word.
 */
export function clipboard_event_has_non_word_files(event: ClipboardEvent): boolean {
    const items = event.clipboardData?.items;
    if (!items) return false;
    for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item || item.kind !== 'file') continue;
        const file = item.getAsFile();
        if (file && !is_word_docx_file(file)) {
            return true;
        }
    }
    return false;
}

/**
 * Returnerar true om urklippet har text/HTML men inga filer.
 */
export function clipboard_event_has_non_file_content(event: ClipboardEvent): boolean {
    const items = event.clipboardData?.items;
    if (!items) return false;
    for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item && item.kind === 'string') {
            return true;
        }
    }
    return false;
}

function is_word_clipboard_mime(mime: string): boolean {
    const normalized = String(mime || '').toLowerCase().trim();
    if (!normalized) return false;
    if (normalized === WORD_DOCX_MIME) return true;
    if (normalized === 'application/zip') return true;
    return false;
}

async function blob_to_word_file(blob: Blob, mime: string, index: number): Promise<File | null> {
    const type = mime || WORD_DOCX_MIME;
    const base_name = index > 0 ? `urklipp_${index + 1}.docx` : 'urklipp.docx';
    const file = new File([blob], base_name, { type, lastModified: Date.now() });
    if (!is_word_docx_file(file)) return null;
    return ensure_word_paste_filename(file);
}

/**
 * Plockar ut Word-filer från navigator.clipboard.read().
 */
export async function extract_word_files_from_navigator_clipboard(items: ClipboardItem[]): Promise<File[]> {
    const files: File[] = [];
    for (const item of items) {
        for (const mime of item.types) {
            if (!is_word_clipboard_mime(mime)) continue;
            const blob = await item.getType(mime);
            const file = await blob_to_word_file(blob, mime, files.length);
            if (file) {
                files.push(file);
            }
        }
    }
    return files;
}

/**
 * Returnerar true om navigator.clipboard.read() kan användas.
 */
export function can_use_navigator_clipboard_read(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return false;
    }
    if (!window.isSecureContext) {
        return false;
    }
    return typeof navigator.clipboard?.read === 'function';
}

/**
 * Läser filer från drag-event (files eller items).
 */
export function files_from_drag_event(event: DragEvent): File[] {
    const transfer = event.dataTransfer;
    if (!transfer) return [];
    if (transfer.files && transfer.files.length > 0) {
        return Array.from(transfer.files);
    }
    return read_word_files_from_data_transfer_items(transfer.items);
}
