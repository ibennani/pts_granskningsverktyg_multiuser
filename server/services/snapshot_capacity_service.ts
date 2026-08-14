/**
 * @fileoverview Bygger global snapshot-kapacitet från databas och in-memory-kö.
 */
import { get_snapshot_browser_max_concurrency } from '../snapshots/audit_snapshot_config.js';
import { count_snapshot_processing_rows } from '../repositories/audit_snapshot_repository.js';
import type { SnapshotCapacity, SnapshotCaptureQueueInfo } from '../schemas/snapshot_capacity.js';
import {
    get_in_memory_queue_length,
    get_memory_queue_position,
} from './snapshot_job_queue_metrics.js';

export async function build_snapshot_capacity(): Promise<SnapshotCapacity> {
    const counts = await count_snapshot_processing_rows();
    const memory_queue_length = get_in_memory_queue_length();
    const active_count = counts.capturing_count + counts.packaging_count;

    return {
        max_browser_slots: get_snapshot_browser_max_concurrency(),
        active_count,
        capturing_count: counts.capturing_count,
        packaging_count: counts.packaging_count,
        queued_count: counts.queued_count,
        active_audit_count: counts.active_audit_count,
        active_user_count: counts.active_user_count,
        memory_queue_length,
        updated_at: new Date().toISOString(),
    };
}

export async function build_snapshot_capture_queue_info(
    capture_id: string | null | undefined
): Promise<SnapshotCaptureQueueInfo> {
    const capacity = await build_snapshot_capacity();
    const position =
        capture_id ? get_memory_queue_position(String(capture_id)) : null;

    return {
        position,
        active_count: capacity.active_count,
        queued_count: capacity.queued_count,
        active_user_count: capacity.active_user_count,
        max_browser_slots: capacity.max_browser_slots,
    };
}
