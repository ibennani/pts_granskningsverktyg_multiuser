/**
 * @fileoverview Zod-schema för innehållstyp-detektering via URL.
 */
import { z } from 'zod';

const SelectorRuleSchema = z.object({
    id: z.string().trim().min(1).max(128),
    selector: z.string().trim().min(1).max(4096),
});

export const UrlContentTypeDetectionBodySchema = z.object({
    url: z.string().trim().min(1, 'URL krävs').max(2048, 'URL är för lång'),
    allowedContentTypeIds: z
        .array(z.string().trim().min(1).max(128))
        .min(1, 'Minst ett innehållstyp-ID krävs')
        .max(200, 'För många innehållstyp-ID:n'),
    selectorRules: z.array(SelectorRuleSchema).max(200, 'För många selectorregler').optional().default([]),
});

export type UrlContentTypeDetectionBody = z.infer<typeof UrlContentTypeDetectionBodySchema>;
