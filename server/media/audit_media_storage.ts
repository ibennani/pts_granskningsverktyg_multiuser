/**
 * @fileoverview Fillagring för mediefiler per granskning på serverns filsystem.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    resolve_upload_media_filename,
    resolve_unique_media_filename,
    sanitize_media_filename
} from '../../shared/media/sanitize_media_filename.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type AuditMediaFileEntry = {
    filename: string;
    size: number;
    mime: string | null;
    uploadedAt: string | null;
};

export function get_audit_media_root_dir(): string {
    const base = process.env.GV_AUDIT_MEDIA_DIR || path.join(process.cwd(), 'audit-media');
    return path.resolve(base);
}

export function get_audit_media_dir(audit_id: string): string {
    const safe_id = String(audit_id || '').trim();
    if (!safe_id || safe_id.includes('..') || safe_id.includes('/') || safe_id.includes('\\')) {
        throw new Error('Ogiltigt gransknings-id');
    }
    return path.join(get_audit_media_root_dir(), safe_id);
}

export function resolve_audit_media_file_path(audit_id: string, filename: string): string {
    const sanitized = sanitize_media_filename(filename);
    if (!sanitized) {
        throw new Error('Ogiltigt filnamn');
    }
    const dir = get_audit_media_dir(audit_id);
    const full = path.resolve(dir, sanitized);
    if (!full.startsWith(dir + path.sep) && full !== dir) {
        throw new Error('Ogiltig sökväg');
    }
    return full;
}

export async function ensure_audit_media_dir(audit_id: string): Promise<string> {
    const dir = get_audit_media_dir(audit_id);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

export type PickUploadMediaFilenameResult = {
    filename: string;
    renamed_due_to_conflict: boolean;
    requested_filename: string;
};

/**
 * Filnamn vid uppladdning — unikt suffix vid kollision (t.ex. bild (2).png).
 */
export async function pick_upload_media_filename(
    audit_id: string,
    original_name: string
): Promise<PickUploadMediaFilenameResult> {
    await ensure_audit_media_dir(audit_id);
    const requested_filename = resolve_upload_media_filename(original_name);
    const existing = await list_audit_media_files(audit_id);
    const existing_set = new Set(existing.map((entry) => entry.filename));
    const filename = resolve_unique_media_filename(requested_filename, (name) => existing_set.has(name));
    return {
        filename,
        renamed_due_to_conflict: filename !== requested_filename,
        requested_filename
    };
}

export async function list_audit_media_files(audit_id: string): Promise<AuditMediaFileEntry[]> {
    const dir = get_audit_media_dir(audit_id);
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
            return [];
        }
        throw err;
    }

    const files: AuditMediaFileEntry[] = [];
    for (const entry of entries) {
        if (!entry.isFile()) continue;
        const full = path.join(dir, entry.name);
        const stat = await fs.stat(full);
        files.push({
            filename: entry.name,
            size: stat.size,
            mime: null,
            uploadedAt: stat.mtime.toISOString()
        });
    }
    files.sort((a, b) => a.filename.localeCompare(b.filename, 'sv'));
    return files;
}

export async function delete_audit_media_file(audit_id: string, filename: string): Promise<void> {
    const full = resolve_audit_media_file_path(audit_id, filename);
    await fs.unlink(full);
}
