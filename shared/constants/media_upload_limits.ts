/**
 * @fileoverview Gränser och tillåtna typer för uppladdning av mediefiler.
 */

import {
    FILE_MAX_BYTES,
    format_file_max_size_label,
} from './file_size_limits.js';

/** Max storlek per fil (25 MiB). */
export const MEDIA_MAX_UPLOAD_BYTES = FILE_MAX_BYTES;

/** Tillåtna MIME-typer för uppladdning. */
export const ALLOWED_MEDIA_MIME_TYPES = Object.freeze([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/bmp',
    'video/mp4',
    'video/webm'
] as const);

/** Set för snabb lookup. */
export const ALLOWED_MEDIA_MIME_SET = new Set<string>(ALLOWED_MEDIA_MIME_TYPES);

/** MIME-typer som kan visas som miniatyr i UI. */
export const IMAGE_MEDIA_MIME_PREFIX = 'image/';

/**
 * Visningsetikett för max filstorlek i UI (t.ex. "25 MB").
 */
export function format_media_max_upload_size_label(): string {
    return format_file_max_size_label();
}
