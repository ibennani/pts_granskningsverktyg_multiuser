/**
 * @fileoverview Zod-schema för hämtning av sidtitel via audit media API.
 */
import { z } from 'zod';

export const AuditUrlPageTitleBodySchema = z.object({
    url: z.string().trim().min(1, 'URL krävs').max(2048, 'URL är för lång'),
});

export type AuditUrlPageTitleBody = z.infer<typeof AuditUrlPageTitleBodySchema>;
