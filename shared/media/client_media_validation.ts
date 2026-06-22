/**
 * @fileoverview Klientvalidering av mediefiler mot serverns tillåtna MIME-typer.
 */

import { ALLOWED_MEDIA_MIME_SET } from '../constants/media_upload_limits.js';

/** Filändelser som motsvarar tillåtna MIME-typer när file.type saknas. */
const ALLOWED_MEDIA_EXTENSIONS = Object.freeze([
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.heic',
    '.heif',
    '.bmp',
    '.mp4',
    '.webm'
] as const);

const ALLOWED_EXTENSION_SET = new Set<string>(ALLOWED_MEDIA_EXTENSIONS);

function file_extension_lower(name: string): string {
    const lower = String(name || '').toLowerCase();
    const dot = lower.lastIndexOf('.');
    if (dot < 0) return '';
    return lower.slice(dot);
}

/**
 * Kontrollerar om en fil är tillåten enligt serverns vitlista.
 */
export function is_allowed_client_media_file(file: File): boolean {
    const mime = (file.type || '').toLowerCase().trim();
    if (mime && ALLOWED_MEDIA_MIME_SET.has(mime)) {
        return true;
    }
    const ext = file_extension_lower(file.name);
    return ext.length > 0 && ALLOWED_EXTENSION_SET.has(ext);
}

/**
 * Bygger accept-attribut för filinput (explicita typer, inga dokument).
 */
export function build_media_file_input_accept_attribute(): string {
    return [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/heic',
        'image/heif',
        'image/bmp',
        'video/mp4',
        'video/webm',
        '.heic',
        '.heif'
    ].join(',');
}

/**
 * Visningsetikett för tillåtna filtyper i felmeddelanden.
 */
export function format_allowed_media_types_label(): string {
    return 'JPEG, PNG, GIF, WebP, HEIC, HEIF, BMP, MP4, WebM';
}
