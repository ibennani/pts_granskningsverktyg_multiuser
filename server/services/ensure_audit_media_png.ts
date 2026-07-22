/**
 * @fileoverview Säkerställer att bildfiler på servern lagras som PNG.
 */

import fs from 'fs/promises';
import {
    is_upload_image_file,
    is_upload_video_file,
    normalize_image_filename_to_png
} from '../../shared/media/image_png_upload.js';
import { resolve_unique_media_filename } from '../../shared/media/sanitize_media_filename.js';
import {
    list_audit_media_files,
    resolve_audit_media_file_path,
    type AuditMediaFileEntry
} from '../media/audit_media_storage.js';
import {
    convert_image_file_to_png,
    ImagePngConversionError
} from './convert_image_to_png.js';

export type AuditMediaFilenameMigration = {
    from: string;
    to: string;
};

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function file_extension_lower(name: string): string {
    const lower = String(name || '').toLowerCase();
    const dot = lower.lastIndexOf('.');
    if (dot < 0) return '';
    return lower.slice(dot);
}

async function read_is_png_file(file_path: string): Promise<boolean> {
    try {
        const handle = await fs.open(file_path, 'r');
        try {
            const header = Buffer.alloc(8);
            const { bytesRead } = await handle.read(header, 0, 8, 0);
            if (bytesRead < 8) return false;
            return header.equals(PNG_MAGIC);
        } finally {
            await handle.close();
        }
    } catch {
        return false;
    }
}

function is_audit_image_filename(filename: string): boolean {
    if (is_upload_video_file(null, filename)) return false;
    return is_upload_image_file(null, filename);
}

async function file_needs_png_migration(file_path: string, filename: string): Promise<boolean> {
    if (!is_audit_image_filename(filename)) return false;
    if (file_extension_lower(filename) !== '.png') return true;
    return !(await read_is_png_file(file_path));
}

async function migrate_single_file_to_png(
    audit_id: string,
    filename: string,
    existing_names: Set<string>
): Promise<AuditMediaFilenameMigration | null> {
    const file_path = resolve_audit_media_file_path(audit_id, filename);
    if (!(await file_needs_png_migration(file_path, filename))) {
        return null;
    }

    try {
        await convert_image_file_to_png(file_path);
    } catch (err) {
        if (err instanceof ImagePngConversionError) {
            console.error('[ensure_audit_media_png] conversion failed:', filename, err.message);
        }
        return null;
    }

    const png_name = normalize_image_filename_to_png(filename);
    if (png_name === filename) {
        return null;
    }

    const target_name = resolve_unique_media_filename(
        png_name,
        (name) => name !== filename && existing_names.has(name)
    );
    if (target_name === filename) {
        return null;
    }

    const target_path = resolve_audit_media_file_path(audit_id, target_name);
    await fs.rename(file_path, target_path);
    existing_names.delete(filename);
    existing_names.add(target_name);
    return { from: filename, to: target_name };
}

/**
 * Konverterar icke-PNG-bilder till PNG och returnerar ev. filnamnsbyten.
 */
export async function ensure_audit_media_files_png(
    audit_id: string
): Promise<{ files: AuditMediaFileEntry[]; migrations: AuditMediaFilenameMigration[] }> {
    const listed = await list_audit_media_files(audit_id);
    const existing_names = new Set(listed.map((entry) => entry.filename));
    const migrations: AuditMediaFilenameMigration[] = [];

    for (const entry of listed) {
        const migration = await migrate_single_file_to_png(audit_id, entry.filename, existing_names);
        if (migration) {
            migrations.push(migration);
        }
    }

    const files = await list_audit_media_files(audit_id);
    for (const file of files) {
        if (is_audit_image_filename(file.filename)) {
            file.mime = 'image/png';
        }
    }
    return { files, migrations };
}
