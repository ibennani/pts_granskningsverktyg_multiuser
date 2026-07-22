/**
 * @fileoverview Zod-schema för omdöpning av mediefiler via audit media API.
 */
import { z } from 'zod';

export const AuditMediaRenameBodySchema = z.object({
    newFilename: z
        .string()
        .trim()
        .min(1, 'Nytt filnamn krävs')
        .max(200, 'Filnamnet är för långt')
});

export const AuditMediaRenameFromBodySchema = AuditMediaRenameBodySchema.extend({
    fromFilename: z
        .string()
        .trim()
        .min(1, 'Nuvarande filnamn krävs')
        .max(200, 'Filnamnet är för långt')
});

export type AuditMediaRenameBody = z.infer<typeof AuditMediaRenameBodySchema>;
export type AuditMediaRenameFromBody = z.infer<typeof AuditMediaRenameFromBodySchema>;
