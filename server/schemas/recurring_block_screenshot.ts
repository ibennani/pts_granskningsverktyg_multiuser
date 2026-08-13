/**
 * @fileoverview Zod-schema för utklippt skärmdump av återkommande block.
 */
import { z } from 'zod';

export const RecurringBlockScreenshotBodySchema = z.object({
    captureId: z.string().uuid(),
    candidateType: z.string().min(1),
    structureFingerprint: z.string().min(1),
    rootIdentity: z.string().optional(),
    label: z.string().min(1).max(120),
});

export type RecurringBlockScreenshotBody = z.infer<typeof RecurringBlockScreenshotBodySchema>;

export const RecurringBlockScreenshotResponseSchema = z.object({
    filename: z.string().nullable(),
    skipped: z.boolean(),
    skipReason: z.string().nullable().optional(),
});

export type RecurringBlockScreenshotResponse = z.infer<typeof RecurringBlockScreenshotResponseSchema>;
