/**
 * @fileoverview Hjälpfunktioner för att läsa tillåtna mediefiler från urklipp (paste-event och Clipboard API).
 */

import { ALLOWED_MEDIA_MIME_SET } from '../constants/media_upload_limits.js';
import { format_filename_datetime_from_iso } from '../datetime/filename_datetime.js';

const CLIPBOARD_FILENAME_PREFIX = 'urklipp';

const GENERIC_CLIPBOARD_FILENAMES = new Set([
    'image.png',
    'image.jpg',
    'image.jpeg',
    'image.gif',
    'image.webp',
    'image.bmp',
    'image.heic',
    'image.heif',
    'video.mp4',
    'video.webm',
    'clipboard.png',
    'clipboard.jpg',
    'clipboard.jpeg',
    'clipboard.gif',
    'clipboard.webp',
    'clipboard.mp4',
    'clipboard.webm'
]);

function mime_to_extension(mime: string): string {
    const normalized = mime.toLowerCase().trim();
    const map: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/heic': '.heic',
        'image/heif': '.heif',
        'image/bmp': '.bmp',
        'video/mp4': '.mp4',
        'video/webm': '.webm'
    };
    return map[normalized] || '.bin';
}

function is_generic_clipboard_filename(name: string): boolean {
    const trimmed = String(name || '').trim();
    if (!trimmed) return true;
    return GENERIC_CLIPBOARD_FILENAMES.has(trimmed.toLowerCase());
}

function is_allowed_clipboard_mime(mime: string): boolean {
    const normalized = String(mime || '').toLowerCase().trim();
    if (!normalized) return false;
    return ALLOWED_MEDIA_MIME_SET.has(normalized);
}

/**
 * Returnerar true om paste ska hanteras (inte i textfält eller contenteditable).
 */
export function should_handle_paste_event(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return true;
    if (target.closest('textarea, input[type="text"], input[type="search"], input[type="url"], [contenteditable="true"]')) {
        return false;
    }
    return true;
}

/**
 * Bygger filnamn för klistrad media utan riktigt namn.
 */
export function build_clipboard_paste_filename(mime?: string, iso?: string | null): string {
    const stamp = format_filename_datetime_from_iso(iso ?? null);
    const ext = mime_to_extension(mime || 'image/png');
    return `${CLIPBOARD_FILENAME_PREFIX}_${stamp}${ext}`;
}

/**
 * Säkerställer att filen har ett meningsfullt filnamn (ersätter generiska urklippsnamn).
 */
export function ensure_paste_filename(file: File): File {
    const name = String(file.name || '').trim();
    if (name && !is_generic_clipboard_filename(name)) {
        return file;
    }
    const fallback_mime = file.type || 'image/png';
    const next_name = build_clipboard_paste_filename(fallback_mime);
    return new File([file], next_name, { type: file.type || fallback_mime, lastModified: file.lastModified });
}

function read_file_items_from_data_transfer(
    items: DataTransferItemList | null | undefined,
    accept: (mime: string) => boolean
): File[] {
    if (!items) return [];
    const files: File[] = [];
    for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item || item.kind !== 'file') continue;
        const mime = String(item.type || '');
        if (!accept(mime)) continue;
        const file = item.getAsFile();
        if (!file) continue;
        files.push(ensure_paste_filename(file));
    }
    return files;
}

/**
 * Plockar ut tillåtna mediefiler från ett paste-event.
 */
export function extract_media_files_from_clipboard_event(event: ClipboardEvent): File[] {
    return read_file_items_from_data_transfer(event.clipboardData?.items, is_allowed_clipboard_mime);
}

/** @deprecated Använd extract_media_files_from_clipboard_event */
export const extract_image_files_from_clipboard_event = extract_media_files_from_clipboard_event;

/**
 * Returnerar true om urklippet innehåller filer som inte är tillåten media.
 */
export function clipboard_event_has_disallowed_files(event: ClipboardEvent): boolean {
    const items = event.clipboardData?.items;
    if (!items) return false;
    for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item || item.kind !== 'file') continue;
        const mime = String(item.type || '');
        if (!is_allowed_clipboard_mime(mime)) {
            return true;
        }
    }
    return false;
}

/** @deprecated Använd clipboard_event_has_disallowed_files */
export const clipboard_event_has_non_image_files = clipboard_event_has_disallowed_files;

/**
 * Plockar ut alla filer från paste-event (för felmeddelanden vid ogiltiga typer).
 */
export function extract_all_files_from_clipboard_event(event: ClipboardEvent): File[] {
    return read_file_items_from_data_transfer(event.clipboardData?.items, () => true);
}

/**
 * Returnerar true om urklippet har innehåll utan filer (t.ex. text eller HTML).
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

async function blob_to_paste_file(blob: Blob, mime: string, index: number): Promise<File | null> {
    if (!is_allowed_clipboard_mime(mime)) return null;
    const file = new File([blob], build_clipboard_paste_filename(mime), {
        type: mime,
        lastModified: Date.now()
    });
    if (index > 0) {
        const dot = file.name.lastIndexOf('.');
        const ext = dot >= 0 ? file.name.slice(dot) : mime_to_extension(mime);
        const base = dot >= 0 ? file.name.slice(0, dot) : file.name;
        return new File([blob], `${base}_${index + 1}${ext}`, { type: mime, lastModified: file.lastModified });
    }
    return ensure_paste_filename(file);
}

/**
 * Plockar ut tillåtna mediefiler från navigator.clipboard.read().
 */
export async function extract_media_files_from_navigator_clipboard(items: ClipboardItem[]): Promise<File[]> {
    const files: File[] = [];
    for (const item of items) {
        const media_types = item.types.filter(is_allowed_clipboard_mime);
        for (const mime of media_types) {
            const blob = await item.getType(mime);
            const file = await blob_to_paste_file(blob, mime, files.length);
            if (file) {
                files.push(file);
            }
        }
    }
    return files;
}

/** @deprecated Använd extract_media_files_from_navigator_clipboard */
export const extract_image_files_from_navigator_clipboard = extract_media_files_from_navigator_clipboard;

/**
 * Returnerar true om navigator.clipboard.read() kan användas (säker kontext + API).
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
