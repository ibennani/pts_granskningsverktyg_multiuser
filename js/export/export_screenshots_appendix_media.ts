/**
 * @fileoverview Hämtning, dimensioner och skalning av bilder för bilaga 3 (Word/PDF).
 */

import { fetch_audit_media_bytes, list_audit_media } from '../api/audit_media_api.js';
import { build_audit_media_filename_migration_map, resolve_migrated_media_filename } from '../logic/audit_media_filename_migrations.js';
import { is_upload_video_file } from '../../shared/media/image_png_upload.js';
import { get_media_export_file_extension } from './export_media_filename.js';
import {
    collect_screenshots_appendix_entries,
    type ScreenshotsAppendixEntry,
} from './export_screenshots_appendix_collect.js';

/** Innehållsbredd A4 med 15 mm sidmarginaler (mm). */
export const SCREENSHOTS_APPENDIX_CONTENT_WIDTH_MM = 180;

/** Vertikal innehållshöjd A4 med 20 mm topp/botten (mm). */
export const SCREENSHOTS_APPENDIX_CONTENT_HEIGHT_MM = 257;

/** Reserverat utrymme för H2-rubrik per bildblock (mm). */
export const SCREENSHOTS_APPENDIX_H2_RESERVED_MM = 12;

const MM_PER_INCH = 25.4;
const PX_PER_INCH = 96;

export type ScreenshotsAppendixDisplaySize = {
    width_px: number;
    height_px: number;
    max_height_cm: number;
    /** True om bilden skalades ned (rubrik + bild fick inte plats i full storlek på en sida). */
    scaled_for_page_fit: boolean;
};

export type PreparedScreenshotsAppendixItem = {
    export_filename: string;
    original_filename: string;
    bytes: ArrayBuffer;
    mime_type: string;
    docx_image_type: 'png' | 'jpg' | 'gif' | 'bmp';
    display_width_px: number;
    display_height_px: number;
    max_height_cm: number;
    scaled_for_page_fit: boolean;
};

/** Samma som PreparedScreenshotsAppendixItem men med omkodad data-URI för PDF-HTML. */
export type PreparedScreenshotsAppendixPdfItem = PreparedScreenshotsAppendixItem & {
    pdf_data_uri: string;
};

export type PrepareScreenshotsAppendixMediaResult = {
    items: PreparedScreenshotsAppendixItem[];
    missing_filenames: string[];
};

function mm_to_px(mm: number): number {
    return Math.round((mm / MM_PER_INCH) * PX_PER_INCH);
}

/** Max bildhöjd (cm) så H2 + bild ryms på en och samma sida. */
export function get_screenshots_appendix_max_image_height_cm(): number {
    return (SCREENSHOTS_APPENDIX_CONTENT_HEIGHT_MM - SCREENSHOTS_APPENDIX_H2_RESERVED_MM) / 10;
}

/**
 * Full storlek som standard. Skalar endast ned om rubrik + bild i full storlek
 * skulle överskrida sidans bredd eller tillgänglig höjd (H2 + bild på en sida).
 */
export function compute_screenshots_appendix_display_size(
    native_width_px: number,
    native_height_px: number
): ScreenshotsAppendixDisplaySize {
    const max_width_px = mm_to_px(SCREENSHOTS_APPENDIX_CONTENT_WIDTH_MM);
    const max_image_height_mm =
        SCREENSHOTS_APPENDIX_CONTENT_HEIGHT_MM - SCREENSHOTS_APPENDIX_H2_RESERVED_MM;
    const max_height_px = mm_to_px(max_image_height_mm);
    const max_height_cm = max_image_height_mm / 10;

    if (native_width_px <= 0 || native_height_px <= 0) {
        return {
            width_px: max_width_px,
            height_px: max_height_px,
            max_height_cm,
            scaled_for_page_fit: true,
        };
    }

    const width_scale = max_width_px / native_width_px;
    const height_scale = max_height_px / native_height_px;
    const scale = Math.min(width_scale, height_scale, 1);
    const scaled_for_page_fit = scale < 1;

    return {
        width_px: Math.max(1, Math.round(native_width_px * scale)),
        height_px: Math.max(1, Math.round(native_height_px * scale)),
        max_height_cm,
        scaled_for_page_fit,
    };
}

function mime_type_for_audit_media(filename: string): string {
    if (is_upload_video_file(null, filename)) {
        const ext = get_media_export_file_extension(filename);
        if (ext === 'webm') return 'video/webm';
        if (ext === 'mp4') return 'video/mp4';
    }
    return 'image/png';
}

function docx_image_type_for_audit_media(filename: string): 'png' | 'jpg' | 'gif' | 'bmp' {
    if (is_upload_video_file(null, filename)) {
        const ext = get_media_export_file_extension(filename);
        if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
        if (ext === 'gif') return 'gif';
        if (ext === 'bmp') return 'bmp';
    }
    return 'png';
}

async function read_image_dimensions(bytes: ArrayBuffer, mime_type: string): Promise<{ width: number; height: number }> {
    const blob = new Blob([bytes], { type: mime_type });
    if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(blob);
        const dims = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return dims;
    }

    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
            URL.revokeObjectURL(url);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Kunde inte avkoda bild'));
        };
        img.src = url;
    });
}

async function fetch_cached_media_bytes(
    audit_id: string,
    original_filename: string,
    cache: Map<string, ArrayBuffer | null>
): Promise<ArrayBuffer | null> {
    if (cache.has(original_filename)) {
        return cache.get(original_filename) ?? null;
    }
    const bytes = await fetch_audit_media_bytes(audit_id, original_filename);
    cache.set(original_filename, bytes);
    return bytes;
}

async function prepare_single_screenshot_item(
    entry: ScreenshotsAppendixEntry,
    bytes: ArrayBuffer
): Promise<PreparedScreenshotsAppendixItem | null> {
    const mime_type = mime_type_for_audit_media(entry.original_filename);
    try {
        const dims = await read_image_dimensions(bytes, mime_type);
        const display = compute_screenshots_appendix_display_size(dims.width, dims.height);
        return {
            export_filename: entry.export_filename,
            original_filename: entry.original_filename,
            bytes,
            mime_type,
            docx_image_type: docx_image_type_for_audit_media(entry.original_filename),
            display_width_px: display.width_px,
            display_height_px: display.height_px,
            max_height_cm: display.max_height_cm,
            scaled_for_page_fit: display.scaled_for_page_fit,
        };
    } catch {
        return null;
    }
}

/** Konverterar ArrayBuffer till base64 för PDF HTML (fallback om JPEG-omkodning misslyckas). */
export function array_buffer_to_base64_data_uri(bytes: ArrayBuffer, mime_type: string): string {
    const uint8 = new Uint8Array(bytes);
    let binary = '';
    for (let i = 0; i < uint8.length; i += 1) {
        binary += String.fromCharCode(uint8[i]!);
    }
    return `data:${mime_type};base64,${btoa(binary)}`;
}

/**
 * Hämtar alla bilagans bilder med dimensioner och skalning för Word/PDF.
 */
export async function prepare_screenshots_appendix_media(
    audit: Record<string, unknown> & { auditId?: string | null }
): Promise<PrepareScreenshotsAppendixMediaResult> {
    const entries = await collect_screenshots_appendix_entries(audit);
    const audit_id = String(audit.auditId || '').trim();
    const items: PreparedScreenshotsAppendixItem[] = [];
    const missing_filenames: string[] = [];
    const bytes_cache = new Map<string, ArrayBuffer | null>();
    let migration_map = new Map<string, string>();

    if (!audit_id) {
        return { items, missing_filenames: entries.map((entry) => entry.original_filename) };
    }

    try {
        const list_result = await list_audit_media(audit_id);
        migration_map = build_audit_media_filename_migration_map(list_result.filename_migrations);
    } catch {
        migration_map = new Map();
    }

    for (const entry of entries) {
        const resolved_filename = resolve_migrated_media_filename(entry.original_filename, migration_map);
        const bytes = await fetch_cached_media_bytes(audit_id, resolved_filename, bytes_cache);
        if (!bytes) {
            if (!missing_filenames.includes(entry.original_filename)) {
                missing_filenames.push(entry.original_filename);
            }
            continue;
        }
        const prepared = await prepare_single_screenshot_item(entry, bytes);
        if (!prepared) {
            if (!missing_filenames.includes(entry.original_filename)) {
                missing_filenames.push(entry.original_filename);
            }
            continue;
        }
        items.push(prepared);
    }

    return { items, missing_filenames };
}
