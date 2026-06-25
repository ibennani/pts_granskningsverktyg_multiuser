/**
 * @fileoverview Zod-schema för innehållstyp-detektering via URL.
 */
import { z } from 'zod';

export const UrlContentTypeDetectionBodySchema = z.object({
    url: z.string().trim().min(1, 'URL krävs').max(2048, 'URL är för lång'),
    allowedContentTypeIds: z
        .array(z.string().trim().min(1).max(128))
        .min(1, 'Minst ett innehållstyp-ID krävs')
        .max(200, 'För många innehållstyp-ID:n'),
});

export type UrlContentTypeDetectionBody = z.infer<typeof UrlContentTypeDetectionBodySchema>;
