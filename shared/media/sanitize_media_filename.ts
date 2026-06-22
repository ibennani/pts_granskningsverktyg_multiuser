/**
 * @fileoverview Sanering av filnamn för mediefiler och MIME-validering.
 */

import { ALLOWED_MEDIA_MIME_SET, IMAGE_MEDIA_MIME_PREFIX } from '../constants/media_upload_limits.js';

const MAX_FILENAME_LENGTH = 200;

/**
 * Återställer UTF-8-filnamn från multipart (multer läser ofta bytes som latin1).
 */
export function decode_multipart_original_filename(raw: string): string {
    if (typeof raw !== 'string' || !raw) return '';
    try {
        const decoded = Buffer.from(raw, 'latin1').toString('utf8');
        if (!decoded || decoded.includes('\uFFFD')) {
            return raw;
        }
        return decoded;
    } catch {
        return raw;
    }
}

/**
 * Sanerar ett filnamn till ett säkert basnamn (ingen sökväg).
 */
export function sanitize_media_filename(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    let name = raw.trim();
    if (!name) return null;

    name = name.replace(/\\/g, '/');
    const parts = name.split('/').filter(Boolean);
    name = parts.length > 0 ? parts[parts.length - 1]! : name;
    name = name.replace(/\.\./g, '');

    name = name.replace(/[\x00-\x1f\x7f]/g, '');
    name = name.replace(/[<>:"|?*]/g, '_');
    name = name.trim();
    if (!name || name === '.' || name === '..') return null;
    if (name.length > MAX_FILENAME_LENGTH) {
        const dot = name.lastIndexOf('.');
        if (dot > 0) {
            const ext = name.slice(dot);
            const base_max = MAX_FILENAME_LENGTH - ext.length;
            name = `${name.slice(0, Math.max(1, base_max))}${ext}`;
        } else {
            name = name.slice(0, MAX_FILENAME_LENGTH);
        }
    }
    return name;
}

/**
 * Sanerat filnamn för uppladdning (ersätter befintlig fil med samma namn).
 */
export function resolve_upload_media_filename(original_name: string): string {
    const decoded = decode_multipart_original_filename(original_name);
    const sanitized = sanitize_media_filename(decoded);
    return sanitized || 'fil';
}

export function is_allowed_media_mime(mime: unknown): boolean {
    if (typeof mime !== 'string' || !mime.trim()) return false;
    return ALLOWED_MEDIA_MIME_SET.has(mime.toLowerCase());
}

export function is_image_media_mime(mime: unknown): boolean {
    if (typeof mime !== 'string') return false;
    return mime.toLowerCase().startsWith(IMAGE_MEDIA_MIME_PREFIX);
}

export function is_image_filename(filename: unknown): boolean {
    if (typeof filename !== 'string') return false;
    const lower = filename.toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp'].some((ext) =>
        lower.endsWith(ext)
    );
}

export type MediaDisplayKind = 'previewable_image' | 'image' | 'video' | 'unknown';

/**
 * Returnerar visningstyp för en mediefil (miniatur, ikon eller okänd).
 */
export function get_media_display_kind(filename: unknown): MediaDisplayKind {
    if (typeof filename !== 'string') return 'unknown';
    const lower = filename.toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].some((ext) => lower.endsWith(ext))) {
        return 'previewable_image';
    }
    if (['.heic', '.heif', '.bmp'].some((ext) => lower.endsWith(ext))) {
        return 'image';
    }
    if (['.mp4', '.webm'].some((ext) => lower.endsWith(ext))) {
        return 'video';
    }
    return 'unknown';
}

/**
 * Bilder som kan visas i img/miniatyr i webbläsaren.
 */
export function is_previewable_image_filename(filename: unknown): boolean {
    return get_media_display_kind(filename) === 'previewable_image';
}

/**
 * Skapar unikt filnamn vid kollision (t.ex. "bild (2).png").
 */
export function resolve_unique_media_filename(
    desired: string,
    exists_fn: (name: string) => boolean
): string {
    const sanitized = sanitize_media_filename(desired);
    if (!sanitized) return 'fil';
    if (!exists_fn(sanitized)) return sanitized;

    const dot = sanitized.lastIndexOf('.');
    const base = dot > 0 ? sanitized.slice(0, dot) : sanitized;
    const ext = dot > 0 ? sanitized.slice(dot) : '';

    for (let i = 2; i < 1000; i += 1) {
        const candidate = `${base} (${i})${ext}`;
        if (!exists_fn(candidate)) return candidate;
    }
    return `${base}-${Date.now()}${ext}`;
}
