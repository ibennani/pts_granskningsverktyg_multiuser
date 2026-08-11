/**
 * @fileoverview Zod-scheman för tekniska audit-snapshots (API och databas).
 */
import { z } from 'zod';

export const AuditSnapshotStatusSchema = z.enum([
    'queued',
    'capturing',
    'packaging',
    'ready',
    'failed',
    'cancelled',
    'superseded',
]);

export type AuditSnapshotStatus = z.infer<typeof AuditSnapshotStatusSchema>;

export const AuditSnapshotRowSchema = z.object({
    id: z.string().uuid(),
    audit_id: z.string().uuid(),
    sample_id: z.string().min(1),
    requested_url: z.string().min(1),
    final_url: z.string().nullable(),
    page_title: z.string().nullable(),
    screenshot_filename: z.string().nullable(),
    archive_filename: z.string().nullable(),
    status: AuditSnapshotStatusSchema,
    warning_count: z.coerce.number().int().nonnegative(),
    warnings_json: z.preprocess(
        (value) => {
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch {
                    return null;
                }
            }
            return value;
        },
        z.array(z.object({ code: z.string(), message: z.string() })).nullable().optional()
    ),
    error: z.string().nullable(),
    size_bytes: z.coerce.number().nullable(),
    visible_phase_completed_at: z.coerce.date().nullable(),
    superseded_at: z.coerce.date().nullable(),
    created_at: z.coerce.date(),
    started_at: z.coerce.date().nullable(),
    completed_at: z.coerce.date().nullable(),
    updated_at: z.coerce.date(),
});

export type AuditSnapshotRow = z.infer<typeof AuditSnapshotRowSchema>;

export const AuditSnapshotCaptureBodySchema = z.object({
    captureId: z.string().uuid(),
    sampleId: z.string().trim().min(1).max(128),
    url: z.string().trim().min(1).max(2048),
    filenameSuffix: z.string().trim().max(64).optional(),
    attachScreenshotToSample: z.boolean().optional(),
});

export type AuditSnapshotCaptureBody = z.infer<typeof AuditSnapshotCaptureBodySchema>;

export const AuditSnapshotTaskOutcomeSchema = z.enum(['success', 'failed', 'skipped']);

export type AuditSnapshotTaskOutcome = z.infer<typeof AuditSnapshotTaskOutcomeSchema>;

export const AuditSnapshotCaptureResponseSchema = z.object({
    captureId: z.string().uuid(),
    snapshotStatus: AuditSnapshotStatusSchema,
    pageTitle: z.object({
        outcome: AuditSnapshotTaskOutcomeSchema,
        value: z.string().optional(),
        error: z.string().optional(),
    }),
    screenshot: z.object({
        outcome: AuditSnapshotTaskOutcomeSchema,
        filename: z.string().optional(),
        size: z.number().optional(),
        mime: z.string().optional(),
        error: z.string().optional(),
    }),
});

export type AuditSnapshotCaptureResponse = z.infer<typeof AuditSnapshotCaptureResponseSchema>;

export const AuditSnapshotListItemSchema = z.object({
    sampleId: z.string(),
    sampleDescription: z.string().optional(),
    requestedUrl: z.string(),
    pageTitle: z.string().nullable(),
    currentReady: z
        .object({
            snapshotId: z.string().uuid(),
            capturedAt: z.string(),
            status: z.literal('ready'),
            warningCount: z.number().int(),
            sizeBytes: z.number().nullable(),
        })
        .nullable(),
    pendingAttempt: z
        .object({
            snapshotId: z.string().uuid(),
            status: AuditSnapshotStatusSchema,
            error: z.string().nullable(),
            warningCount: z.number().int(),
            warnings: z.array(z.object({ code: z.string(), message: z.string() })).optional(),
        })
        .nullable(),
});

export type AuditSnapshotListItem = z.infer<typeof AuditSnapshotListItemSchema>;
