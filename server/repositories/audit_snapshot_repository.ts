/**
 * @fileoverview Databasåtkomst för audit_snapshots.
 */
import { query } from '../db.js';
import { parse_db_row } from '../utils/zod_boundary.js';
import {
    AuditSnapshotRowSchema,
    type AuditSnapshotRow,
    type AuditSnapshotStatus,
} from '../schemas/audit_snapshot.js';

export type { AuditSnapshotRow };

export type InsertAuditSnapshotParams = {
    id: string;
    audit_id: string;
    sample_id: string;
    requested_url: string;
};

export async function insert_audit_snapshot_row(
    params: InsertAuditSnapshotParams
): Promise<AuditSnapshotRow> {
    const result = await query(
        `INSERT INTO audit_snapshots (id, audit_id, sample_id, requested_url, status)
         VALUES ($1, $2, $3, $4, 'queued')
         RETURNING *`,
        [params.id, params.audit_id, params.sample_id, params.requested_url]
    );
    return parse_db_row(AuditSnapshotRowSchema, result.rows[0]);
}

export async function get_audit_snapshot_by_id(
    audit_id: string,
    snapshot_id: string
): Promise<AuditSnapshotRow | null> {
    const result = await query(
        'SELECT * FROM audit_snapshots WHERE audit_id = $1 AND id = $2',
        [audit_id, snapshot_id]
    );
    if (result.rows.length === 0) return null;
    return parse_db_row(AuditSnapshotRowSchema, result.rows[0]);
}

export async function list_audit_snapshots_for_audit(audit_id: string): Promise<AuditSnapshotRow[]> {
    const result = await query(
        `SELECT * FROM audit_snapshots WHERE audit_id = $1
         ORDER BY created_at DESC`,
        [audit_id]
    );
    return result.rows.map((row: unknown) => parse_db_row(AuditSnapshotRowSchema, row));
}

export async function update_audit_snapshot_status(
    snapshot_id: string,
    status: AuditSnapshotStatus,
    fields: Partial<{
        final_url: string | null;
        page_title: string | null;
        screenshot_filename: string | null;
        archive_filename: string | null;
        warning_count: number;
        error: string | null;
        size_bytes: number | null;
        visible_phase_completed_at: Date | null;
        superseded_at: Date | null;
        started_at: Date | null;
        completed_at: Date | null;
    }> = {}
): Promise<AuditSnapshotRow | null> {
    const sets: string[] = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
    const values: unknown[] = [snapshot_id, status];
    let i = 3;

    const add_field = (col: string, val: unknown) => {
        sets.push(`${col} = $${i++}`);
        values.push(val);
    };

    if (fields.final_url !== undefined) add_field('final_url', fields.final_url);
    if (fields.page_title !== undefined) add_field('page_title', fields.page_title);
    if (fields.screenshot_filename !== undefined) {
        add_field('screenshot_filename', fields.screenshot_filename);
    }
    if (fields.archive_filename !== undefined) add_field('archive_filename', fields.archive_filename);
    if (fields.warning_count !== undefined) add_field('warning_count', fields.warning_count);
    if (fields.error !== undefined) add_field('error', fields.error);
    if (fields.size_bytes !== undefined) add_field('size_bytes', fields.size_bytes);
    if (fields.visible_phase_completed_at !== undefined) {
        add_field('visible_phase_completed_at', fields.visible_phase_completed_at);
    }
    if (fields.superseded_at !== undefined) add_field('superseded_at', fields.superseded_at);
    if (fields.started_at !== undefined) add_field('started_at', fields.started_at);
    if (fields.completed_at !== undefined) add_field('completed_at', fields.completed_at);

    const result = await query(
        `UPDATE audit_snapshots SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
        values
    );
    if (result.rows.length === 0) return null;
    return parse_db_row(AuditSnapshotRowSchema, result.rows[0]);
}

export async function mark_previous_ready_superseded(
    audit_id: string,
    sample_id: string,
    except_capture_id: string
): Promise<void> {
    await query(
        `UPDATE audit_snapshots
         SET status = 'superseded', superseded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE audit_id = $1 AND sample_id = $2 AND status = 'ready' AND id <> $3`,
        [audit_id, sample_id, except_capture_id]
    );
}

export async function recover_stale_processing_snapshots(error_message: string): Promise<number> {
    const result = await query(
        `UPDATE audit_snapshots
         SET status = 'failed', error = $1, updated_at = CURRENT_TIMESTAMP,
             completed_at = CURRENT_TIMESTAMP
         WHERE status IN ('queued', 'capturing', 'packaging')
         RETURNING id, audit_id`,
        [error_message]
    );
    return result.rowCount ?? 0;
}

export async function delete_audit_snapshots_for_sample(
    audit_id: string,
    sample_id: string
): Promise<string[]> {
    const result = await query(
        `DELETE FROM audit_snapshots WHERE audit_id = $1 AND sample_id = $2 RETURNING id`,
        [audit_id, sample_id]
    );
    return result.rows.map((row: { id: string }) => String(row.id));
}

export async function list_orphan_snapshot_candidates(
    audit_id: string,
    valid_sample_ids: string[],
    older_than_hours: number
): Promise<AuditSnapshotRow[]> {
    if (valid_sample_ids.length === 0) {
        const result = await query(
            `SELECT * FROM audit_snapshots
             WHERE audit_id = $1
               AND status NOT IN ('capturing', 'packaging', 'queued')
               AND created_at < NOW() - ($2 || ' hours')::interval`,
            [audit_id, String(older_than_hours)]
        );
        return result.rows.map((row: unknown) => parse_db_row(AuditSnapshotRowSchema, row));
    }
    const result = await query(
        `SELECT * FROM audit_snapshots
         WHERE audit_id = $1
           AND sample_id <> ALL($2::text[])
           AND status NOT IN ('capturing', 'packaging', 'queued')
           AND created_at < NOW() - ($3 || ' hours')::interval`,
        [audit_id, valid_sample_ids, String(older_than_hours)]
    );
    return result.rows.map((row: unknown) => parse_db_row(AuditSnapshotRowSchema, row));
}
