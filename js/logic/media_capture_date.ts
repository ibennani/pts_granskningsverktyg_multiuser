/**
 * @fileoverview Datum från bildmetadata (EXIF) med fallback till uppladdningsdatum.
 */

import exifr from 'exifr';
import { format_local_date_for_filename } from '../utils/filename_utils.js';
import { fetch_audit_media_blob_url, list_audit_media } from '../api/audit_media_api.js';
import {
    build_audit_media_filename_migration_map,
    resolve_migrated_media_filename
} from './audit_media_filename_migrations.js';

const DEFAULT_CONCURRENCY = 4;

type ExifDateFields = {
    DateTimeOriginal?: Date | string;
    CreateDate?: Date | string;
};

function format_capture_date_from_value(value: unknown, fallback: string): string {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return format_local_date_for_filename(value, '-');
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) {
            return format_local_date_for_filename(new Date(parsed), '-');
        }
    }
    return fallback;
}

function format_capture_date_from_uploaded_at(uploaded_at: unknown, export_fallback: string): string {
    if (typeof uploaded_at === 'string' && uploaded_at.trim()) {
        const parsed = Date.parse(uploaded_at);
        if (Number.isFinite(parsed)) {
            return format_local_date_for_filename(new Date(parsed), '-');
        }
    }
    return export_fallback;
}

async function read_exif_capture_date(blob: Blob, fallback: string): Promise<string> {
    try {
        const parsed = (await exifr.parse(blob, {
            pick: ['DateTimeOriginal', 'CreateDate']
        })) as ExifDateFields | null;
        if (!parsed) return fallback;
        return (
            format_capture_date_from_value(parsed.DateTimeOriginal, '') ||
            format_capture_date_from_value(parsed.CreateDate, '') ||
            fallback
        );
    } catch {
        return fallback;
    }
}

async function resolve_single_media_capture_date(
    audit_id: string,
    filename: string,
    uploaded_at: string | null | undefined,
    export_fallback: string
): Promise<string> {
    const upload_fallback = format_capture_date_from_uploaded_at(uploaded_at, export_fallback);
    const blob_url = await fetch_audit_media_blob_url(audit_id, filename);
    if (!blob_url) {
        return upload_fallback;
    }

    try {
        const response = await fetch(blob_url, { cache: 'no-store' });
        if (!response.ok) {
            return upload_fallback;
        }
        const blob = await response.blob();
        return await read_exif_capture_date(blob, upload_fallback);
    } catch {
        return upload_fallback;
    } finally {
        URL.revokeObjectURL(blob_url);
    }
}

async function map_with_concurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T) => Promise<R>
): Promise<R[]> {
    if (items.length === 0) return [];
    const results: R[] = new Array(items.length);
    let next_index = 0;

    async function worker(): Promise<void> {
        while (next_index < items.length) {
            const current = next_index;
            next_index += 1;
            results[current] = await mapper(items[current]!);
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
}

/**
 * Returnerar map filename → YYYY-MM-DD för export.
 */
export async function resolve_media_capture_dates(
    audit_id: string | null | undefined,
    filenames: string[],
    export_date: Date = new Date()
): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const unique = [...new Set(filenames.map((name) => String(name || '').trim()).filter(Boolean))];
    const export_fallback = format_local_date_for_filename(export_date, '-');

    unique.forEach((name) => {
        result.set(name, export_fallback);
    });

    const safe_audit_id = String(audit_id ?? '').trim();
    if (!safe_audit_id || unique.length === 0) {
        return result;
    }

    let uploaded_map = new Map<string, string | null>();
    let migration_map = new Map<string, string>();
    try {
        const list_result = await list_audit_media(safe_audit_id);
        uploaded_map = new Map(list_result.files.map((entry) => [entry.filename, entry.uploadedAt ?? null]));
        migration_map = build_audit_media_filename_migration_map(list_result.filename_migrations);
    } catch {
        return result;
    }

    await map_with_concurrency(unique, DEFAULT_CONCURRENCY, async (filename) => {
        const resolved_filename = resolve_migrated_media_filename(filename, migration_map);
        const capture_date = await resolve_single_media_capture_date(
            safe_audit_id,
            resolved_filename,
            uploaded_map.get(resolved_filename) ?? uploaded_map.get(filename),
            export_fallback
        );
        result.set(filename, capture_date);
    });

    return result;
}
