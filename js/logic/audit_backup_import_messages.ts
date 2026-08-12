/**
 * @fileoverview Hjälpfunktioner för importmeddelanden efter säkerhetskopia.
 */

import type { AuditBackupMediaRestoreResult } from './audit_backup_media_restore.js';

export function build_audit_import_success_messages(
    t: (key: string, params?: Record<string, unknown>) => string,
    media_result: AuditBackupMediaRestoreResult | null,
    zip_missing_media: string[] = []
): Array<{ message: string; type: string }> {
    const messages: Array<{ message: string; type: string }> = [
        { message: t('audit_audit_uploaded_success'), type: 'success' },
    ];

    if (media_result) {
        const total = media_result.uploaded_count + media_result.failed_count;
        if (total > 0) {
            messages.push({
                message: t('audit_backup_import_media_restored', {
                    uploaded: media_result.uploaded_count,
                    total,
                }),
                type: media_result.failed_count > 0 ? 'warning' : 'success',
            });
        }
    }

    if (zip_missing_media.length > 0) {
        messages.push({
            message: t('audit_backup_import_missing_in_archive', { count: zip_missing_media.length }),
            type: 'warning',
        });
    }

    return messages;
}
