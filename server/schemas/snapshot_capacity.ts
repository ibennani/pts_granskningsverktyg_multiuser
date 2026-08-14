/**
 * @fileoverview Zod-scheman för global snapshot-kapacitet och köstatus.
 */
import { z } from 'zod';

export const SnapshotCapacitySchema = z.object({
    max_browser_slots: z.number().int().positive(),
    active_count: z.number().int().nonnegative(),
    capturing_count: z.number().int().nonnegative(),
    packaging_count: z.number().int().nonnegative(),
    queued_count: z.number().int().nonnegative(),
    active_audit_count: z.number().int().nonnegative(),
    active_user_count: z.number().int().nonnegative(),
    memory_queue_length: z.number().int().nonnegative(),
    updated_at: z.string(),
});

export type SnapshotCapacity = z.infer<typeof SnapshotCapacitySchema>;

export const SnapshotCaptureQueueInfoSchema = z.object({
    position: z.number().int().positive().nullable(),
    active_count: z.number().int().nonnegative(),
    queued_count: z.number().int().nonnegative(),
    active_user_count: z.number().int().nonnegative(),
    max_browser_slots: z.number().int().positive(),
});

export type SnapshotCaptureQueueInfo = z.infer<typeof SnapshotCaptureQueueInfoSchema>;
