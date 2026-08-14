/**
 * @fileoverview Zod-scheman för granskningsrader från PostgreSQL.
 */

import { z } from 'zod';
import { JsonValueSchema, MetadataRecordSchema } from './common.js';

export const AuditRowSchema = z.object({
    id: z.string(),
    rule_set_id: z.string().nullable().optional(),
    rule_file_content: JsonValueSchema.optional(),
    status: z.string().optional(),
    metadata: z.union([MetadataRecordSchema, z.string()]).optional(),
    samples: z.union([z.array(JsonValueSchema), z.string(), JsonValueSchema]).optional(),
    version: z.coerce.number().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    archived_requirement_results: JsonValueSchema.optional(),
    last_rulefile_update_log: JsonValueSchema.optional(),
    last_updated_by: z.string().nullable().optional()
});

export type AuditRow = z.infer<typeof AuditRowSchema>;

export const AuditIndexRowSchema = z.object({
    id: z.string(),
    rule_set_id: z.string().nullable().optional(),
    status: z.string().optional(),
    metadata: z.union([MetadataRecordSchema, z.string()]).optional(),
    version: z.coerce.number().optional(),
    rule_set_name: z.string().optional(),
    last_updated_by: z.string().nullable().optional(),
    responsible_user_id: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    samples: JsonValueSchema.optional(),
    rule_content: JsonValueSchema.optional()
});

export type AuditIndexRow = z.infer<typeof AuditIndexRowSchema>;

export const AuditVersionRowSchema = z.object({
    version: z.coerce.number(),
    updated_at: z.string()
});

export type AuditVersionRow = z.infer<typeof AuditVersionRowSchema>;

export const AuditRowMeaningfulSourceSchema = z.object({
    metadata: JsonValueSchema,
    status: JsonValueSchema,
    samples: JsonValueSchema,
    rule_file_content: JsonValueSchema,
    archived_requirement_results: JsonValueSchema,
    last_rulefile_update_log: JsonValueSchema
});

export type AuditRowMeaningfulSource = z.infer<typeof AuditRowMeaningfulSourceSchema>;

export const ImportConflictBodySchema = z.object({
    auditId: z.string().optional(),
    samples: z.array(z.object({ id: z.string().optional() }).passthrough()).optional()
});

export type ImportConflictBody = z.infer<typeof ImportConflictBodySchema>;

export const AuditConflictSummaryRowSchema = z.object({
    samples: JsonValueSchema,
    metadata: MetadataRecordSchema.optional(),
    version: z.coerce.number(),
    updated_at: z.string(),
    status: z.string(),
    last_updated_by: z.string().nullable().optional()
});

export type AuditConflictSummaryRow = z.infer<typeof AuditConflictSummaryRowSchema>;

export const RuleSetRowSchema = z.object({
    published_content: JsonValueSchema.optional(),
    content: JsonValueSchema.optional()
});

export type RuleSetRow = z.infer<typeof RuleSetRowSchema>;
