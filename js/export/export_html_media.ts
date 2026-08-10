/**
 * @fileoverview HTML-export: zip-paketering och samlad medielista med PTS-filnamn.
 */

import JSZip from 'jszip';
import { fetch_audit_media_bytes, fetch_audit_media_original_bytes, list_audit_media } from '../api/audit_media_api.js';
import {
    build_audit_media_filename_migration_map,
    resolve_migrated_media_filename
} from '../logic/audit_media_filename_migrations.js';
import { resolve_effective_sample_attached_filenames } from '../logic/sample_attached_media_normalize.js';
import { for_each_failed_export_pass_criterion } from './export_deficiency_traversal.js';
import type { ExportMediaFilenameContext } from './export_media_filename_context.js';
import {
    format_media_filenames_for_export,
    format_sample_media_filenames_for_export_or_raw,
    resolve_media_export_filenames,
    resolve_sample_media_export_filenames
} from './export_media_naming.js';

export const HTML_EXPORT_MEDIA_DIR = 'media';
export const IMAGES_ZIP_ORIGINALS_DIR = 'orginalbilder';
export const IMAGES_ZIP_CONVERTED_DIR = 'konverterade_bilder';

export type HtmlExportZipEntry = {
    original_filename: string;
    zip_path: string;
};

export type ImagesZipFolderEntry = {
    original_filename: string;
    converted_zip_path: string;
    original_zip_path?: string;
};

function normalize_attached_list(filenames: unknown): string[] {
    if (!Array.isArray(filenames)) {
        return [];
    }
    return filenames.map((name) => String(name || '').trim()).filter(Boolean);
}

function push_zip_entries(
    entries: HtmlExportZipEntry[],
    original_filenames: string[],
    export_names: string[]
): void {
    const count = Math.min(original_filenames.length, export_names.length);
    for (let i = 0; i < count; i += 1) {
        entries.push({
            original_filename: original_filenames[i]!,
            zip_path: `${HTML_EXPORT_MEDIA_DIR}/${export_names[i]!}`
        });
    }
}

/** Exportfilnamn för bristbilder (en per bifogad fil). */
export function get_deficiency_media_export_names(
    filenames: unknown,
    media_context: ExportMediaFilenameContext | null,
    deficiency_id: string | null | undefined
): string[] {
    const trimmed = normalize_attached_list(filenames);
    if (trimmed.length === 0) {
        return [];
    }
    if (media_context) {
        return resolve_media_export_filenames(trimmed, media_context, { deficiency_id });
    }
    return format_media_filenames_for_export(trimmed, null, { deficiency_id })
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

/** Exportfilnamn för granskningsdelsbilder (högst en). */
export function get_sample_media_export_names(
    filenames: unknown,
    media_context: ExportMediaFilenameContext | null,
    sample_id: string | null | undefined,
    samples: unknown[] | null | undefined
): string[] {
    const trimmed = normalize_attached_list(filenames);
    if (trimmed.length === 0) {
        return [];
    }
    if (media_context) {
        return resolve_sample_media_export_filenames(trimmed, media_context, { sample_id }, samples);
    }
    return format_sample_media_filenames_for_export_or_raw(trimmed, null, { sample_id }, samples)
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

function collect_deficiency_zip_entries(
    audit: unknown,
    media_context: ExportMediaFilenameContext | null,
    entries: HtmlExportZipEntry[]
): void {
    for_each_failed_export_pass_criterion(audit, ({ pc_obj }) => {
        const filenames = (pc_obj as { attachedMediaFilenames?: unknown }).attachedMediaFilenames;
        const export_names = get_deficiency_media_export_names(
            filenames,
            media_context,
            pc_obj.deficiencyId
        );
        push_zip_entries(entries, normalize_attached_list(filenames), export_names);
    });
}

function collect_sample_zip_entries(
    audit: unknown,
    media_context: ExportMediaFilenameContext | null,
    entries: HtmlExportZipEntry[]
): void {
    const audit_state = audit as { samples?: unknown[] };
    const samples = audit_state.samples || [];
    samples.forEach((sample) => {
        const s = sample as { id?: string; attachedMediaFilenames?: unknown };
        const filenames = resolve_effective_sample_attached_filenames(
            audit_state as Parameters<typeof resolve_effective_sample_attached_filenames>[0],
            s
        );
        const export_names = get_sample_media_export_names(
            filenames,
            media_context,
            s.id,
            samples
        );
        push_zip_entries(entries, filenames.slice(0, export_names.length), export_names);
    });
}

/**
 * Samlar alla zip-poster för HTML-export (brist + granskningsdel).
 */
export function collect_html_export_zip_entries(
    audit: unknown,
    media_context: ExportMediaFilenameContext | null
): HtmlExportZipEntry[] {
    const entries: HtmlExportZipEntry[] = [];
    collect_deficiency_zip_entries(audit, media_context, entries);
    collect_sample_zip_entries(audit, media_context, entries);
    return entries;
}

export type BuildHtmlExportZipInput = {
    html_document: string;
    html_filename: string;
    entries: HtmlExportZipEntry[];
    audit_id: string | null | undefined;
};

export type BuildHtmlExportZipResult = {
    blob: Blob;
    missing_filenames: string[];
};

async function fetch_unique_media_bytes(
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

async function add_media_entries_to_zip(
    zip: JSZip,
    entries: HtmlExportZipEntry[],
    audit_id: string | null | undefined
): Promise<string[]> {
    const missing_filenames: string[] = [];
    const trimmed_audit_id = String(audit_id || '').trim();
    const bytes_cache = new Map<string, ArrayBuffer | null>();
    let migration_map = new Map<string, string>();

    if (!trimmed_audit_id) {
        return missing_filenames;
    }

    try {
        const list_result = await list_audit_media(trimmed_audit_id);
        migration_map = build_audit_media_filename_migration_map(list_result.filename_migrations);
    } catch {
        migration_map = new Map();
    }

    for (const entry of entries) {
        const resolved_filename = resolve_migrated_media_filename(entry.original_filename, migration_map);
        const bytes = await fetch_unique_media_bytes(trimmed_audit_id, resolved_filename, bytes_cache);
        if (!bytes) {
            if (!missing_filenames.includes(entry.original_filename)) {
                missing_filenames.push(entry.original_filename);
            }
            continue;
        }
        zip.file(entry.zip_path, bytes);
    }

    return missing_filenames;
}

/** Tar bort media/-prefix så filer hamnar direkt i zip-roten. */
export function flatten_html_export_zip_entries(entries: HtmlExportZipEntry[]): HtmlExportZipEntry[] {
    const prefix = `${HTML_EXPORT_MEDIA_DIR}/`;
    return entries.map((entry) => ({
        original_filename: entry.original_filename,
        zip_path: entry.zip_path.startsWith(prefix) ? entry.zip_path.slice(prefix.length) : entry.zip_path
    }));
}

export type BuildMediaOnlyExportZipInput = {
    entries: HtmlExportZipEntry[];
    audit_id: string | null | undefined;
};

/**
 * Bygger zip med enbart mediefiler (platta sökvägar i zip-roten).
 */
export async function build_media_only_export_zip(
    input: BuildMediaOnlyExportZipInput
): Promise<BuildHtmlExportZipResult> {
    const zip = new JSZip();
    const missing_filenames = await add_media_entries_to_zip(zip, input.entries, input.audit_id);
    const blob = await zip.generateAsync({ type: 'blob' });
    return { blob, missing_filenames };
}

/**
 * Bygger zip-poster med orginalbilder/ och konverterade_bilder/ från HTML-exportposter.
 */
export function build_images_zip_folder_entries(
    flat_entries: HtmlExportZipEntry[],
    original_filenames_map: Record<string, string>,
    migration_map: Map<string, string>
): ImagesZipFolderEntry[] {
    return flat_entries.map((entry) => {
        const resolved_canonical = resolve_migrated_media_filename(entry.original_filename, migration_map);
        const stored_original = original_filenames_map[resolved_canonical];
        const folder_entry: ImagesZipFolderEntry = {
            original_filename: entry.original_filename,
            converted_zip_path: `${IMAGES_ZIP_CONVERTED_DIR}/${entry.zip_path}`
        };
        if (stored_original) {
            folder_entry.original_zip_path = `${IMAGES_ZIP_ORIGINALS_DIR}/${stored_original}`;
        }
        return folder_entry;
    });
}

async function add_images_folder_entries_to_zip(
    zip: JSZip,
    entries: ImagesZipFolderEntry[],
    audit_id: string | null | undefined
): Promise<string[]> {
    const missing_filenames: string[] = [];
    const trimmed_audit_id = String(audit_id || '').trim();
    if (!trimmed_audit_id) {
        return missing_filenames;
    }

    let migration_map = new Map<string, string>();
    try {
        const list_result = await list_audit_media(trimmed_audit_id);
        migration_map = build_audit_media_filename_migration_map(list_result.filename_migrations);
    } catch {
        migration_map = new Map();
    }

    const bytes_cache = new Map<string, ArrayBuffer | null>();

    for (const entry of entries) {
        const resolved_filename = resolve_migrated_media_filename(entry.original_filename, migration_map);
        const cache_key = `converted:${resolved_filename}`;
        if (!bytes_cache.has(cache_key)) {
            bytes_cache.set(cache_key, await fetch_audit_media_bytes(trimmed_audit_id, resolved_filename));
        }
        const converted_bytes = bytes_cache.get(cache_key);
        if (!converted_bytes) {
            if (!missing_filenames.includes(entry.original_filename)) {
                missing_filenames.push(entry.original_filename);
            }
            continue;
        }
        zip.file(entry.converted_zip_path, converted_bytes);

        if (!entry.original_zip_path) {
            continue;
        }

        const original_cache_key = `original:${entry.original_filename}`;
        if (!bytes_cache.has(original_cache_key)) {
            bytes_cache.set(
                original_cache_key,
                await fetch_audit_media_original_bytes(trimmed_audit_id, entry.original_filename)
            );
        }
        const original_bytes = bytes_cache.get(original_cache_key);
        if (original_bytes) {
            zip.file(entry.original_zip_path, original_bytes);
        }
    }

    return missing_filenames;
}

export type BuildImagesFolderExportZipInput = {
    entries: ImagesZipFolderEntry[];
    audit_id: string | null | undefined;
};

/**
 * Bygger zip med orginalbilder/ och konverterade_bilder/.
 */
export async function build_images_folder_export_zip(
    input: BuildImagesFolderExportZipInput
): Promise<BuildHtmlExportZipResult> {
    const zip = new JSZip();
    const missing_filenames = await add_images_folder_entries_to_zip(zip, input.entries, input.audit_id);
    const blob = await zip.generateAsync({ type: 'blob' });
    return { blob, missing_filenames };
}

/**
 * Bygger zip med HTML-fil och media-mapp.
 */
export async function build_html_export_zip(input: BuildHtmlExportZipInput): Promise<BuildHtmlExportZipResult> {
    const zip = new JSZip();
    zip.file(input.html_filename, input.html_document);
    const missing_filenames = await add_media_entries_to_zip(zip, input.entries, input.audit_id);
    const blob = await zip.generateAsync({ type: 'blob' });
    return { blob, missing_filenames };
}
