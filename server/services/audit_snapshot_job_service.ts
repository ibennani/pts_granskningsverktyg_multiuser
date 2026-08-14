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
import { save_png_buffer_to_audit_media } from '../media/save_audit_media_png_buffer.js';
import { load_content_type_groups_for_audit } from '../utils/audit_content_type_groups.js';
import type {
    AuditSnapshotCaptureBody,
    AuditSnapshotCaptureResponse,
} from '../schemas/audit_snapshot.js';
import { pick_fair_queue_job } from './snapshot_fair_queue_pick.js';
import { schedule_snapshot_capacity_broadcast } from './snapshot_capacity_broadcast.js';
import { build_snapshot_capture_queue_info } from './snapshot_capacity_service.js';
import { set_snapshot_queue_metric_readers } from './snapshot_job_queue_metrics.js';

type SnapshotCaptureRequester = {
    user_id?: string | null;
    user_name?: string | null;
};

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
const active_audit_ids = new Set<string>();
let last_served_audit_id: string | null = null;
let pump_running = false;

set_snapshot_queue_metric_readers({
    get_queue_length: () => queue.length,
    get_queue_position: (capture_id: string) => {
        const index = queue.findIndex((job) => job.captureId === capture_id);
        if (index < 0) return null;
        return index + 1;
    },
});

export function get_in_memory_queue_length(): number {
    return queue.length;
}

export function get_memory_queue_position(capture_id: string): number | null {
    const index = queue.findIndex((job) => job.captureId === capture_id);
    if (index < 0) return null;
    return index + 1;
}

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
    schedule_snapshot_capacity_broadcast();
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
    return save_png_buffer_to_audit_media(audit_id, png_buffer, page_title, filename_suffix);
}

async function attach_queue_info_to_response(
    capture_id: string,
    response: AuditSnapshotCaptureResponse
): Promise<AuditSnapshotCaptureResponse> {
    const queue_info = await build_snapshot_capture_queue_info(capture_id);
    return { ...response, queue: queue_info };
}

async function process_capture_job(job: PendingCapture): Promise<void> {
    active_audit_ids.add(job.audit_id);
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
                const response = await attach_queue_info_to_response(job.captureId, {
                    captureId: visible.captureId,
                    snapshotStatus: 'capturing',
                    pageTitle: visible.pageTitle,
                    screenshot: visible.screenshot,
                });
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
        active_audit_ids.delete(job.audit_id);
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
            const picked = pick_fair_queue_job({
                queue,
                active_audit_ids,
                last_served_audit_id,
            });
            last_served_audit_id = picked.last_served_audit_id;
            const job = picked.job;
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
        schedule_snapshot_capacity_broadcast();
        void pump_queue();
    });
}

export async function start_snapshot_capture(
    audit_id: string,
    body: AuditSnapshotCaptureBody,
    requester?: SnapshotCaptureRequester
): Promise<AuditSnapshotCaptureResponse> {
    await ensure_audit_snapshot_dir(audit_id);
    await insert_audit_snapshot_row({
        id: body.captureId,
        audit_id,
        sample_id: body.sampleId,
        requested_url: body.url,
        requested_by_user_id: requester?.user_id ?? null,
        requested_by_user_name: requester?.user_name ?? null,
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
        schedule_snapshot_capacity_broadcast();
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
