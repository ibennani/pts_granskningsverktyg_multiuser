/**
 * @fileoverview Hjälpfunktioner för konvertering av uppladdade bilder till PNG.
 */

import {
    is_image_filename,
    is_image_media_mime
} from './sanitize_media_filename.js';

const VIDEO_EXTENSIONS = Object.freeze(['.mp4', '.webm'] as const);

const VIDEO_MIME_PREFIX = 'video/';

function file_extension_lower(name: string): string {
    const lower = String(name || '').toLowerCase();
    const dot = lower.lastIndexOf('.');
    if (dot < 0) return '';
    return lower.slice(dot);
}

/**
 * Kontrollerar om filen är en video (inte bild).
 */
export function is_upload_video_file(mime: unknown, filename: unknown): boolean {
    if (typeof mime === 'string' && mime.toLowerCase().startsWith(VIDEO_MIME_PREFIX)) {
        return true;
    }
    const ext = file_extension_lower(String(filename || ''));
    return VIDEO_EXTENSIONS.some((video_ext) => ext === video_ext);
}

/**
 * Kontrollerar om filen är en bild (ej video).
 */
export function is_upload_image_file(mime: unknown, filename: unknown): boolean {
    if (is_upload_video_file(mime, filename)) {
        return false;
    }
    if (is_image_media_mime(mime)) {
        return true;
    }
    return is_image_filename(filename);
}

/**
 * Returnerar true om bilden ska konverteras till PNG (ej redan PNG).
 */
export function should_convert_image_to_png(mime: unknown, filename: unknown): boolean {
    if (!is_upload_image_file(mime, filename)) {
        return false;
    }
    const normalized_mime = typeof mime === 'string' ? mime.toLowerCase().trim() : '';
    const ext = file_extension_lower(String(filename || ''));
    if (normalized_mime === 'image/png' && ext === '.png') {
        return false;
    }
    return true;
}

/**
 * Byter bildändelse till .png (videor och okända filer lämnas oförändrade).
 */
export function normalize_image_filename_to_png(filename: unknown): string {
    const raw = String(filename || '').trim();
    if (!raw || !is_image_filename(raw)) {
        return raw;
    }
    const dot = raw.lastIndexOf('.');
    if (dot <= 0) {
        return `${raw}.png`;
    }
    return `${raw.slice(0, dot)}.png`;
}
