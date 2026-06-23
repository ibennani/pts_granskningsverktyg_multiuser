/**
 * @fileoverview Zod-schema för POST /audits/import.
 */

import { z } from 'zod';
import { JsonValueSchema, UuidSchema } from './common.js';

export const AuditImportBodySchema = z
    .object({
        replaceExistingAuditId: z.union([UuidSchema, z.literal(''), z.null()]).optional(),
        auditId: z.string().optional(),
        ruleFileContent: JsonValueSchema.optional(),
        auditMetadata: JsonValueSchema.optional(),
        auditStatus: JsonValueSchema.optional(),
        samples: JsonValueSchema.optional(),
        archivedRequirementResults: JsonValueSchema.optional(),
        lastRulefileUpdateLog: JsonValueSchema.optional()
    })
    .passthrough();

export type AuditImportBody = z.infer<typeof AuditImportBodySchema>;

/** Validerar replaceExistingAuditId när fältet skickas med icke-tomt värde. */
export function validate_replace_existing_audit_id(value: unknown): string | null {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    const parsed = UuidSchema.safeParse(String(value));
    return parsed.success ? parsed.data : null;
}
