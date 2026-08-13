/**
 * @fileoverview Jobbkö och livscykel för tekniska snapshots.
 */
import fs from 'fs/promises';
import path from 'path';
import { broadcast } from '../ws.js';
import { Semaphore } from '../snapshots/semaphore.js';
import {
    get_snapshot_browser_max_concurrency,
    get_snapshot_package_max_concurrency,
} from '../snapshots/audit_snapshot_config.js';
import { acquire_snapshot_host_slot } from '../snapshots/snapshot_host_throttle.js';
import {
    insert_audit_snapshot_row,
    update_audit_snapshot_status,
    mark_previous_ready_superseded,
    recover_stale_processing_snapshots,
    get_audit_snapshot_by_id,
} from '../repositories/audit_snapshot_repository.js';
import {
    ensure_audit_snapshot_dir,
    remove_snapshot_files_best_effort,
    cleanup_stale_temp_files_best_effort,
} from '../snapshots/audit_snapshot_storage.js';
import {
    run_snapshot_capture_job,
    type VisibleCaptureResult,
} from './page_snapshot_capture_service.js';
import { ensure_audit_media_dir, pick_upload_media_filename } from '../media/audit_media_storage.js';
import { save_audit_media_original } from '../media/audit_media_originals.js';
import { build_sample_screenshot_filename } from '../utils/sample_screenshot_filename.js';
import { load_content_type_groups_for_audit } from '../utils/audit_content_type_groups.js';
import type {
    AuditSnapshotCaptureBody,
    AuditSnapshotCaptureResponse,
} from '../schemas/audit_snapshot.js';

type PendingCapture = AuditSnapshotCaptureBody & {
    audit_id: string;
    resolve_visible: (value: AuditSnapshotCaptureResponse) => void;
    reject_visible: (err: Error) => void;
};

const browser_semaphore = new Semaphore(get_snapshot_browser_max_concurrency());
const package_semaphore = new Semaphore(get_snapshot_package_max_concurrency());

const cancelled_ids = new Set<string>();
const active_extended_jobs = new Set<string>();
const queue: PendingCapture[] = [];
let pump_running = false;

function broadcast_snapshot_changed(params: {
    auditId: string;
    snapshotId: string;
    sampleId: string;
    status: string;
}): void {
    broadcast({
        type: 'audit:snapshots_changed',
        auditId: params.auditId,
        snapshotId: params.snapshotId,
        sampleId: params.sampleId,
        status: params.status,
    });
}

export function should_yield_extended_capture(): boolean {
    return queue.length > 0 && browser_semaphore.active_count >= get_snapshot_browser_max_concurrency();
}

export function cancel_snapshot_capture(capture_id: string): void {
    cancelled_ids.add(capture_id);
}

export function is_snapshot_cancelled(capture_id: string): boolean {
    return cancelled_ids.has(capture_id);
}

async function save_png_to_audit_media(
    audit_id: string,
    png_buffer: Buffer,
    page_title: string,
    filename_suffix?: string
): Promise<{ filename: string | null; skipped: boolean }> {
    const requested_filename = build_sample_screenshot_filename(page_title, filename_suffix ?? '');
    const pick = await pick_upload_media_filename(audit_id, requested_filename);
    const dir = await ensure_audit_media_dir(audit_id);
    const full_path = path.join(dir, pick.filename);
    await fs.writeFile(full_path, png_buffer);
    await save_audit_media_original(audit_id, pick.filename, full_path, pick.filename);
    return { filename: pick.filename, skipped: false };
}

async function process_capture_job(job: PendingCapture): Promise<void> {
    const host_slot = await acquire_snapshot_host_slot(job.url);
    await browser_semaphore.acquire();
    await update_audit_snapshot_status(job.captureId, 'capturing', {
        started_at: new Date(),
    });
    broadcast_snapshot_changed({
        auditId: job.audit_id,
        snapshotId: job.captureId,
        sampleId: job.sampleId,
        status: 'capturing',
    });

    let visible_resolved = false;

    try {
        const content_type_groups = await load_content_type_groups_for_audit(job.audit_id);
        const archive = await run_snapshot_capture_job({
            audit_id: job.audit_id,
            capture_id: job.captureId,
            url: job.url,
            attach_screenshot_to_sample: job.attachScreenshotToSample !== false,
            content_type_groups,
            save_screenshot_to_media: (png, title) =>
                save_png_to_audit_media(job.audit_id, png, title, job.filenameSuffix),
            is_cancelled: () => is_snapshot_cancelled(job.captureId),
            should_yield_extended: () => should_yield_extended_capture(),
            on_visible_complete: async (visible: VisibleCaptureResult) => {
                if (is_snapshot_cancelled(job.captureId)) {
                    throw new Error('Capture cancelled');
                }
                await update_audit_snapshot_status(job.captureId, 'capturing', {
                    page_title: visible.page_title,
                    final_url: visible.final_url,
                    screenshot_filename: visible.screenshot.filename ?? null,
                    visible_phase_completed_at: new Date(),
                });
                const response: AuditSnapshotCaptureResponse = {
                    captureId: visible.captureId,
                    snapshotStatus: 'capturing',
                    pageTitle: visible.pageTitle,
                    screenshot: visible.screenshot,
                };
                job.resolve_visible(response);
                visible_resolved = true;
                active_extended_jobs.add(job.captureId);
            },
            on_packaging_start: async () => {
                active_extended_jobs.delete(job.captureId);
                await package_semaphore.acquire();
                try {
                    await update_audit_snapshot_status(job.captureId, 'packaging');
                    broadcast_snapshot_changed({
                        auditId: job.audit_id,
                        snapshotId: job.captureId,
                        sampleId: job.sampleId,
                        status: 'packaging',
                    });
                } finally {
                    package_semaphore.release();
                }
            },
        });

        cancelled_ids.delete(job.captureId);
        await mark_previous_ready_superseded(job.audit_id, job.sampleId, job.captureId);
        await update_audit_snapshot_status(job.captureId, 'ready', {
            completed_at: new Date(),
            archive_filename: `${job.captureId}.zip`,
            size_bytes: archive.size_bytes,
            warning_count: archive.warning_count,
            warnings_json: archive.warnings,
        });
        broadcast_snapshot_changed({
            auditId: job.audit_id,
            snapshotId: job.captureId,
            sampleId: job.sampleId,
            status: 'ready',
        });
    } catch (err) {
        active_extended_jobs.delete(job.captureId);
        const message = err instanceof Error ? err.message : String(err);
        const is_cancelled = message.includes('cancelled') || is_snapshot_cancelled(job.captureId);
        await remove_snapshot_files_best_effort(job.audit_id, job.captureId);
        await update_audit_snapshot_status(job.captureId, is_cancelled ? 'cancelled' : 'failed', {
            error: is_cancelled ? null : message,
            completed_at: new Date(),
        });
        broadcast_snapshot_changed({
            auditId: job.audit_id,
            snapshotId: job.captureId,
            sampleId: job.sampleId,
            status: is_cancelled ? 'cancelled' : 'failed',
        });
        if (!visible_resolved) {
            job.reject_visible(err instanceof Error ? err : new Error(message));
        }
        cancelled_ids.delete(job.captureId);
    } finally {
        browser_semaphore.release();
        host_slot.release();
        void pump_queue();
    }
}

async function pump_queue(): Promise<void> {
    if (pump_running) return;
    pump_running = true;
    try {
        while (queue.length > 0 && browser_semaphore.active_count < get_snapshot_browser_max_concurrency()) {
            const job = queue.shift();
            if (!job) break;
            void process_capture_job(job);
        }
    } finally {
        pump_running = false;
    }
}

export function enqueue_snapshot_capture(
    audit_id: string,
    body: AuditSnapshotCaptureBody
): Promise<AuditSnapshotCaptureResponse> {
    return new Promise((resolve_visible, reject_visible) => {
        queue.push({
            ...body,
            audit_id,
            resolve_visible,
            reject_visible,
        });
        void pump_queue();
    });
}

export async function start_snapshot_capture(
    audit_id: string,
    body: AuditSnapshotCaptureBody
): Promise<AuditSnapshotCaptureResponse> {
    await ensure_audit_snapshot_dir(audit_id);
    await insert_audit_snapshot_row({
        id: body.captureId,
        audit_id,
        sample_id: body.sampleId,
        requested_url: body.url,
    });
    broadcast_snapshot_changed({
        auditId: audit_id,
        snapshotId: body.captureId,
        sampleId: body.sampleId,
        status: 'queued',
    });
    return enqueue_snapshot_capture(audit_id, body);
}

export async function initialize_snapshot_job_service(): Promise<void> {
    const count = await recover_stale_processing_snapshots(
        'Snapshot capture was interrupted by server restart.'
    );
    if (count > 0) {
        console.info(`[audit_snapshot] Marked ${count} stale jobs as failed after restart.`);
    }
}

export async function delete_snapshot_job(
    audit_id: string,
    capture_id: string
): Promise<boolean> {
    cancel_snapshot_capture(capture_id);
    const row = await get_audit_snapshot_by_id(audit_id, capture_id);
    if (!row) return false;
    if (row.status === 'ready' || row.status === 'superseded') {
        return false;
    }
    await remove_snapshot_files_best_effort(audit_id, capture_id);
    await cleanup_stale_temp_files_best_effort(audit_id);
    await update_audit_snapshot_status(capture_id, 'cancelled', { completed_at: new Date() });
    broadcast_snapshot_changed({
        auditId: audit_id,
        snapshotId: capture_id,
        sampleId: row.sample_id,
        status: 'cancelled',
    });
    return true;
}
