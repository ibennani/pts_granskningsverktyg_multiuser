/**
 * @fileoverview Zod-scheman för PATCH /audits/:id och PATCH …/results/….
 */

import { z } from 'zod';
import { JsonValueSchema, RequiredFiniteNumberSchema } from './common.js';

const PATCH_SLICE_FIELDS = {
    metadata: JsonValueSchema.optional(),
    status: z.string().optional(),
    samples: JsonValueSchema.optional(),
    ruleFileContent: JsonValueSchema.optional(),
    archivedRequirementResults: JsonValueSchema.optional(),
    lastRulefileUpdateLog: JsonValueSchema.optional()
} as const;

export const AuditPatchBodySliceSchema = z.object(PATCH_SLICE_FIELDS);

export type AuditPatchBodySlice = z.infer<typeof AuditPatchBodySliceSchema>;

export const AuditPatchBodySchema = z
    .object({
        ...PATCH_SLICE_FIELDS,
        expectedVersion: RequiredFiniteNumberSchema
    })
    .superRefine((data, ctx) => {
        const has_update = (Object.keys(PATCH_SLICE_FIELDS) as (keyof typeof PATCH_SLICE_FIELDS)[]).some(
            (key) => data[key] !== undefined
        );
        if (!has_update) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Ingen data att uppdatera',
                path: []
            });
        }
    });

export type AuditPatchBody = z.infer<typeof AuditPatchBodySchema>;

export const AuditRequirementPatchBodySchema = z.object({
    version: z.coerce.number().finite().optional(),
    result: JsonValueSchema.optional()
});

export type AuditRequirementPatchBody = z.infer<typeof AuditRequirementPatchBodySchema>;
