/**
 * @fileoverview Zod-schema för URL-skärmdump via audit media API.
 */
import { z } from 'zod';

export const AuditUrlScreenshotBodySchema = z.object({
    url: z.string().trim().min(1, 'URL krävs').max(2048, 'URL är för lång'),
    filenameSuffix: z
        .string()
        .trim()
        .min(1, 'Filnamnssuffix krävs')
        .max(64, 'Filnamnssuffix är för långt'),
});

export type AuditUrlScreenshotBody = z.infer<typeof AuditUrlScreenshotBodySchema>;
