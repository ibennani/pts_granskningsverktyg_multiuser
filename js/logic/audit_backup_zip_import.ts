/**
 * @fileoverview Läser gransknings-säkerhetskopia (ZIP) och extraherar JSON + media.
 */

import JSZip from 'jszip';
import {
    AUDIT_BACKUP_JSON_ENTRY,
    AUDIT_BACKUP_MANIFEST_ENTRY,
    AUDIT_BACKUP_MEDIA_DIR,
} from '../../shared/audit_backup/audit_backup_constants.js';
import { AuditBackupManifestSchema } from '../../shared/audit_backup/audit_backup_manifest_schema.js';
import { is_safe_zip_entry_path } from '../../shared/audit_backup/audit_backup_zip_safety.js';

export type AuditBackupExtractedMedia = {
    filename: string;
    blob: Blob;
};

export type AuditBackupZipParseResult = {
    audit_json: unknown;
    media_files: AuditBackupExtractedMedia[];
    missing_media: string[];
    used_manifest: boolean;
};

function guess_mime_from_filename(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.webm')) return 'video/webm';
    return 'application/octet-stream';
}

async function read_manifest(zip: JSZip): Promise<{
    audit_json_entry: string;
    media_dir: string;
    missing_media: string[];
    used_manifest: boolean;
}> {
    const manifest_entry = zip.file(AUDIT_BACKUP_MANIFEST_ENTRY);
    if (!manifest_entry) {
        return {
            audit_json_entry: AUDIT_BACKUP_JSON_ENTRY,
            media_dir: AUDIT_BACKUP_MEDIA_DIR,
            missing_media: [],
            used_manifest: false,
        };
    }
    const raw = JSON.parse(await manifest_entry.async('string'));
    const parsed = AuditBackupManifestSchema.safeParse(raw);
    if (!parsed.success) {
        throw new Error('audit_backup_manifest_invalid');
    }
    return {
        audit_json_entry: parsed.data.auditJsonEntry,
        media_dir: parsed.data.mediaDir,
        missing_media: parsed.data.missingMedia,
        used_manifest: true,
    };
}

async function read_audit_json(zip: JSZip, entry_name: string): Promise<unknown> {
    const json_entry = zip.file(entry_name);
    if (!json_entry) {
        throw new Error('audit_backup_json_missing');
    }
    return JSON.parse(await json_entry.async('string'));
}

async function extract_media_files(zip: JSZip, media_dir: string): Promise<AuditBackupExtractedMedia[]> {
    const prefix = `${media_dir.replace(/\/+$/, '')}/`;
    const media_files: AuditBackupExtractedMedia[] = [];

    for (const [entry_path, entry] of Object.entries(zip.files)) {
        if (entry.dir || !entry_path.startsWith(prefix)) {
            continue;
        }
        if (!is_safe_zip_entry_path(entry_path)) {
            continue;
        }
        const rel = entry_path.slice(prefix.length);
        if (!rel || rel.includes('/')) {
            continue;
        }
        const blob = await entry.async('blob');
        media_files.push({
            filename: rel,
            blob: new Blob([blob], { type: guess_mime_from_filename(rel) }),
        });
    }

    return media_files;
}

/**
 * Packar upp ZIP-buffer till gransknings-JSON och mediefiler.
 */
export async function parse_audit_backup_zip(buffer: ArrayBuffer): Promise<AuditBackupZipParseResult> {
    const zip = await JSZip.loadAsync(buffer);
    const manifest_info = await read_manifest(zip);
    if (!is_safe_zip_entry_path(manifest_info.audit_json_entry)) {
        throw new Error('audit_backup_json_missing');
    }
    const audit_json = await read_audit_json(zip, manifest_info.audit_json_entry);
    const media_files = await extract_media_files(zip, manifest_info.media_dir);
    return {
        audit_json,
        media_files,
        missing_media: manifest_info.missing_media,
        used_manifest: manifest_info.used_manifest,
    };
}

export function is_probably_zip_file(file: File): boolean {
    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    return name.endsWith('.zip') || type === 'application/zip' || type === 'application/x-zip-compressed';
}
