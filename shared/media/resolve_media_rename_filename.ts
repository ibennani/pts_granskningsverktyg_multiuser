/**
 * @fileoverview Validerar och löser målfilnamn vid omdöpning av mediefiler.
 */

import {
    is_allowed_media_mime,
    is_image_filename,
    resolve_unique_media_filename,
    sanitize_media_filename
} from './sanitize_media_filename.js';
import {
    is_upload_image_file,
    normalize_image_filename_to_png
} from './image_png_upload.js';

const EXTENSION_TO_MIME: Readonly<Record<string, string>> = Object.freeze({
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.bmp': 'image/bmp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm'
});

function file_extension_lower(filename: string): string {
    const lower = String(filename || '').toLowerCase();
    const dot = lower.lastIndexOf('.');
    if (dot < 0) {
        return '';
    }
    return lower.slice(dot);
}

/**
 * Gissar MIME-typ utifrån filändelse (för validering vid omdöpning).
 */
export function infer_media_mime_from_filename(filename: unknown): string | null {
    const ext = file_extension_lower(String(filename || ''));
    if (!ext) {
        return null;
    }
    return EXTENSION_TO_MIME[ext] ?? null;
}

/**
 * Förbereder användarens nya filnamn före validering.
 * Bilder utan .png på slutet får .png (ersätter annan bildändelse eller läggs till utan ändelse).
 */
export function prepare_media_rename_filename_input(
    current_filename: string,
    new_filename_raw: string
): string {
    const trimmed = String(new_filename_raw || '').trim();
    if (!trimmed || !is_image_filename(current_filename)) {
        return trimmed;
    }
    if (trimmed.toLowerCase().endsWith('.png')) {
        return trimmed;
    }
    if (is_image_filename(trimmed)) {
        return normalize_image_filename_to_png(trimmed);
    }
    return `${trimmed}.png`;
}

export type ResolveMediaRenameFilenameResult =
    | {
          ok: true;
          filename: string;
          requested_filename: string;
          renamed_due_to_conflict: boolean;
          unchanged: boolean;
      }
    | { ok: false; error: string };

/**
 * Validerar nytt filnamn och löser unikt namn vid krock (källfilen exkluderas).
 */
export function resolve_media_rename_filename(
    current_filename: string,
    new_filename_raw: string,
    existing_filenames: Set<string>
): ResolveMediaRenameFilenameResult {
    const current = sanitize_media_filename(current_filename);
    if (!current) {
        return { ok: false, error: 'Ogiltigt filnamn' };
    }

    const sanitized_new = sanitize_media_filename(new_filename_raw);
    if (!sanitized_new) {
        return { ok: false, error: 'Ogiltigt filnamn' };
    }

    const inferred_mime = infer_media_mime_from_filename(sanitized_new);
    if (!inferred_mime || !is_allowed_media_mime(inferred_mime)) {
        return { ok: false, error: 'Filtypen stöds inte' };
    }

    let requested_filename = sanitized_new;
    if (is_upload_image_file(inferred_mime, sanitized_new)) {
        requested_filename = normalize_image_filename_to_png(sanitized_new);
    }

    if (requested_filename === current) {
        return {
            ok: true,
            filename: current,
            requested_filename,
            renamed_due_to_conflict: false,
            unchanged: true
        };
    }

    const exists_fn = (name: string) => name !== current && existing_filenames.has(name);
    const filename = resolve_unique_media_filename(requested_filename, exists_fn);

    return {
        ok: true,
        filename,
        requested_filename,
        renamed_due_to_conflict: filename !== requested_filename,
        unchanged: false
    };
}
