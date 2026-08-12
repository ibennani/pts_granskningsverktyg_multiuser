/**
 * @fileoverview Importerar granskning och återställer ev. media från säkerhetskopia.
 */

import { import_audit } from '../api/client.js';
import {
    restore_audit_backup_media,
    type AuditBackupMediaRestoreResult,
} from './audit_backup_media_restore.js';

export type ImportAuditWithMediaOptions = {
    replace_existing_audit_id?: string;
};

export type ImportAuditWithMediaResult = {
    audit_id: string | null;
    media_result: AuditBackupMediaRestoreResult | null;
};

/**
 * Importerar granskning via API och laddar upp bifogad media om ZIP innehöll filer.
 */
export async function import_audit_with_optional_media(
    audit_json: Record<string, unknown>,
    media_files: Array<{ filename: string; blob: Blob }>,
    options: ImportAuditWithMediaOptions = {}
): Promise<ImportAuditWithMediaResult> {
    const import_options = options.replace_existing_audit_id
        ? { replace_existing_audit_id: options.replace_existing_audit_id }
        : {};
    const result = (await import_audit(audit_json, import_options)) as Record<string, unknown>;
    const audit_id_raw = result?.auditId ?? result?.audit_id;
    const audit_id = audit_id_raw !== null && audit_id_raw !== undefined ? String(audit_id_raw) : null;

    if (!audit_id || media_files.length === 0) {
        return { audit_id, media_result: null };
    }

    const media_result = await restore_audit_backup_media(audit_id, audit_json, media_files);
    return { audit_id, media_result };
}
