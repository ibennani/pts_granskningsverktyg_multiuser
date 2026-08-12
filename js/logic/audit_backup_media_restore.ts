/**
 * @fileoverview Laddar upp bifogad media efter granskningsimport från säkerhetskopia.
 */

import { upload_audit_media } from '../api/audit_media_api.js';
import { collect_attached_media_filenames } from './audit_attached_media_references.js';

export type AuditBackupMediaRestoreResult = {
    uploaded_count: number;
    skipped_count: number;
    failed_count: number;
};

function filter_media_for_upload(
    audit_json: Record<string, unknown>,
    media_files: Array<{ filename: string; blob: Blob }>
): Array<{ filename: string; blob: Blob }> {
    const referenced = collect_attached_media_filenames(audit_json);
    return media_files.filter((entry) => referenced.has(entry.filename));
}

/**
 * Laddar upp mediafiler som refereras i granskningen till angivet gransknings-id.
 */
export async function restore_audit_backup_media(
    audit_id: string,
    audit_json: Record<string, unknown>,
    media_files: Array<{ filename: string; blob: Blob }>
): Promise<AuditBackupMediaRestoreResult> {
    const to_upload = filter_media_for_upload(audit_json, media_files);
    let uploaded_count = 0;
    let failed_count = 0;

    for (const entry of to_upload) {
        try {
            const file = new File([entry.blob], entry.filename, { type: entry.blob.type || 'application/octet-stream' });
            await upload_audit_media(audit_id, file);
            uploaded_count += 1;
        } catch {
            failed_count += 1;
        }
    }

    const skipped_count = media_files.length - to_upload.length;
    return { uploaded_count, skipped_count, failed_count };
}
