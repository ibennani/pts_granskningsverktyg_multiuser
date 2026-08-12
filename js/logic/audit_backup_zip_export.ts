/**
 * @fileoverview Bygger manifest och ZIP för gransknings-säkerhetskopia.
 */

import JSZip from 'jszip';
import { fetch_audit_media_bytes } from '../api/audit_media_api.js';
import { collect_attached_media_filenames } from './audit_attached_media_references.js';
import {
    AUDIT_BACKUP_JSON_ENTRY,
    AUDIT_BACKUP_MANIFEST_ENTRY,
    AUDIT_BACKUP_MEDIA_DIR,
} from '../../shared/audit_backup/audit_backup_constants.js';
import { audit_backup_download_filename } from '../../shared/audit_backup/audit_backup_filename.js';
import type {
    AuditBackupManifest,
    AuditBackupManifestMediaRef,
} from '../../shared/audit_backup/audit_backup_manifest_schema.js';

export { audit_backup_download_filename };

export type AuditBackupZipBuildResult = {
    blob: Blob;
    missing_media: string[];
};

function build_media_zip_path(filename: string): string {
    return `${AUDIT_BACKUP_MEDIA_DIR}/${filename}`;
}

function build_media_ref(filename: string): AuditBackupManifestMediaRef {
    return { filename, path: build_media_zip_path(filename) };
}

function resolve_audit_id(audit_data: Record<string, unknown>): string | null {
    const raw = audit_data.auditId ?? audit_data.audit_id;
    const trimmed = raw !== null && raw !== undefined ? String(raw).trim() : '';
    return trimmed || null;
}

async function fetch_referenced_media_bytes(
    audit_id: string | null,
    filenames: string[]
): Promise<{ included: AuditBackupManifestMediaRef[]; bytes_by_path: Map<string, ArrayBuffer>; missing: string[] }> {
    const included: AuditBackupManifestMediaRef[] = [];
    const bytes_by_path = new Map<string, ArrayBuffer>();
    const missing: string[] = [];

    if (!audit_id) {
        return { included, bytes_by_path, missing: [...filenames] };
    }

    for (const filename of filenames) {
        const ref = build_media_ref(filename);
        const bytes = await fetch_audit_media_bytes(audit_id, filename);
        if (!bytes) {
            missing.push(filename);
            continue;
        }
        included.push(ref);
        bytes_by_path.set(ref.path, bytes);
    }

    return { included, bytes_by_path, missing };
}

function build_manifest(
    referenced: string[],
    included: AuditBackupManifestMediaRef[],
    missing: string[]
): AuditBackupManifest {
    return {
        formatVersion: 1,
        createdAt: new Date().toISOString(),
        auditJsonEntry: AUDIT_BACKUP_JSON_ENTRY,
        mediaDir: AUDIT_BACKUP_MEDIA_DIR,
        referencedMedia: referenced.map(build_media_ref),
        includedMedia: included,
        missingMedia: missing,
    };
}

/**
 * Packar granskning (JSON-payload med exportIntegrity) till ZIP med manifest och media/.
 */
export async function build_audit_backup_zip(
    audit_payload: Record<string, unknown>
): Promise<AuditBackupZipBuildResult> {
    const referenced_set = collect_attached_media_filenames(audit_payload);
    const referenced = [...referenced_set].sort();
    const audit_id = resolve_audit_id(audit_payload);
    const { included, bytes_by_path, missing } = await fetch_referenced_media_bytes(audit_id, referenced);
    const manifest = build_manifest(referenced, included, missing);

    const zip = new JSZip();
    zip.file(AUDIT_BACKUP_MANIFEST_ENTRY, JSON.stringify(manifest, null, 2));
    zip.file(AUDIT_BACKUP_JSON_ENTRY, JSON.stringify(audit_payload, null, 2));
    for (const [entry_path, bytes] of bytes_by_path) {
        zip.file(entry_path, bytes);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    return { blob, missing_media: missing };
}
