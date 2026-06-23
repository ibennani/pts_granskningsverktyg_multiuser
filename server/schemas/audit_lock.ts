/**
 * @fileoverview Zod-scheman för granskningslås (POST/heartbeat/release).
 */

import { z } from 'zod';

export const AuditLockBodySchema = z.object({
    part_key: z.string({ required_error: 'part_key krävs' }).min(1, 'part_key krävs'),
    client_lock_id: z.string({ required_error: 'client_lock_id krävs' }).min(1, 'client_lock_id krävs'),
    ttl_seconds: z.coerce.number().finite().optional().default(30)
});

export type AuditLockBody = z.infer<typeof AuditLockBodySchema>;

export const AuditLockHeartbeatBodySchema = z.object({
    client_lock_id: z.string({ required_error: 'client_lock_id krävs' }).min(1, 'client_lock_id krävs'),
    ttl_seconds: z.coerce.number().finite().optional().default(30)
});

export type AuditLockHeartbeatBody = z.infer<typeof AuditLockHeartbeatBodySchema>;

export const AuditLockReleaseInputSchema = z.object({
    client_lock_id: z.string({ required_error: 'client_lock_id krävs' }).min(1, 'client_lock_id krävs')
});

export type AuditLockReleaseInput = z.infer<typeof AuditLockReleaseInputSchema>;

export const AuditListStatusQuerySchema = z.object({
    status: z.preprocess(
        (val) => (Array.isArray(val) ? val[0] : val),
        z.string().optional()
    )
});

export type AuditListStatusQuery = z.infer<typeof AuditListStatusQuerySchema>;
