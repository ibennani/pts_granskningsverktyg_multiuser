/**
 * @fileoverview Zod-schema för manifest i gransknings-säkerhetskopia.
 */

import { z } from 'zod';
import { AUDIT_BACKUP_FORMAT_VERSION } from './audit_backup_constants.js';

export const AuditBackupManifestMediaRefSchema = z.object({
    filename: z.string().min(1),
    path: z.string().min(1),
});

export const AuditBackupManifestSchema = z.object({
    formatVersion: z.literal(AUDIT_BACKUP_FORMAT_VERSION),
    createdAt: z.string().min(1),
    auditJsonEntry: z.string().min(1),
    mediaDir: z.string().min(1),
    referencedMedia: z.array(AuditBackupManifestMediaRefSchema),
    includedMedia: z.array(AuditBackupManifestMediaRefSchema),
    missingMedia: z.array(z.string()),
});

export type AuditBackupManifest = z.infer<typeof AuditBackupManifestSchema>;
export type AuditBackupManifestMediaRef = z.infer<typeof AuditBackupManifestMediaRefSchema>;
