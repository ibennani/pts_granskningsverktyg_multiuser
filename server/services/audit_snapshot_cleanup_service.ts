/**
 * @fileoverview Raderar snapshots och fillagring kopplat till granskningsdelar.
 */
import {
    delete_audit_snapshots_for_sample,
    delete_audit_snapshot_by_id,
    list_audit_snapshot_ids_for_sample,
    list_orphan_snapshot_rows,
    get_audit_snapshot_by_id,
} from '../repositories/audit_snapshot_repository.js';
import {
    remove_snapshot_files_best_effort,
    cleanup_stale_temp_files_best_effort,
} from '../snapshots/audit_snapshot_storage.js';
import { broadcast } from '../ws.js';
import {
    cancel_snapshot_capture,
    is_snapshot_cancelled,
} from './audit_snapshot_job_service.js';

function broadcast_snapshots_purged(params: {
    auditId: string;
    sampleId: string;
    snapshotIds: string[];
}): void {
    for (const snapshot_id of params.snapshotIds) {
        broadcast({
            type: 'audit:snapshots_changed',
            auditId: params.auditId,
            snapshotId: snapshot_id,
            sampleId: params.sampleId,
            status: 'deleted',
        });
    }
}

async function remove_files_for_ids(audit_id: string, snapshot_ids: string[]): Promise<void> {
    for (const snapshot_id of snapshot_ids) {
        cancel_snapshot_capture(snapshot_id);
        await remove_snapshot_files_best_effort(audit_id, snapshot_id);
    }
    await cleanup_stale_temp_files_best_effort(audit_id);
}

export async function purge_audit_snapshots_for_sample(
    audit_id: string,
    sample_id: string
): Promise<number> {
    const snapshot_ids = await list_audit_snapshot_ids_for_sample(audit_id, sample_id);
    if (snapshot_ids.length === 0) return 0;
    await remove_files_for_ids(audit_id, snapshot_ids);
    const deleted_ids = await delete_audit_snapshots_for_sample(audit_id, sample_id);
    broadcast_snapshots_purged({ auditId: audit_id, sampleId: sample_id, snapshotIds: deleted_ids });
    return deleted_ids.length;
}

export async function purge_audit_snapshot_by_id(
    audit_id: string,
    snapshot_id: string
): Promise<boolean> {
    const row = await get_audit_snapshot_by_id(audit_id, snapshot_id);
    if (!row) return false;
    await remove_files_for_ids(audit_id, [snapshot_id]);
    const deleted = await delete_audit_snapshot_by_id(audit_id, snapshot_id);
    if (deleted) {
        broadcast_snapshots_purged({
            auditId: audit_id,
            sampleId: row.sample_id,
            snapshotIds: [snapshot_id],
        });
    }
    return deleted;
}

export async function purge_orphan_audit_snapshots(
    audit_id: string,
    valid_sample_ids: string[]
): Promise<number> {
    const orphans = await list_orphan_snapshot_rows(audit_id, valid_sample_ids);
    if (orphans.length === 0) return 0;

    const by_sample = new Map<string, string[]>();
    for (const row of orphans) {
        if (['queued', 'capturing', 'packaging'].includes(row.status) && !is_snapshot_cancelled(row.id)) {
            cancel_snapshot_capture(row.id);
        }
        const list = by_sample.get(row.sample_id) ?? [];
        list.push(row.id);
        by_sample.set(row.sample_id, list);
    }

    let total = 0;
    for (const [sample_id, snapshot_ids] of by_sample) {
        await remove_files_for_ids(audit_id, snapshot_ids);
        const deleted_ids = await delete_audit_snapshots_for_sample(audit_id, sample_id);
        total += deleted_ids.length;
        if (deleted_ids.length > 0) {
            broadcast_snapshots_purged({ auditId: audit_id, sampleId: sample_id, snapshotIds: deleted_ids });
        }
    }
    return total;
}
