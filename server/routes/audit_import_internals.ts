/**
 * @fileoverview Importhjälp: konflikt-id och sammanfattning för 409-svar.
 */

import {
    select_audit_id_by_sample_id,
    select_audit_id_exists,
    fetch_audit_summary_for_import_conflict
} from '../repositories/audit_repository.js';
import {
    AuditConflictSummaryRowSchema,
    ImportConflictBodySchema,
    type ImportConflictBody
} from '../schemas/audit_db_rows.js';
import { is_valid_uuid } from '../schemas/common.js';
import { safe_parse_db_row } from '../utils/zod_boundary.js';

export { is_valid_uuid };

export async function find_import_conflict_audit_id(data: ImportConflictBody): Promise<string | null> {
    const parsed_body = ImportConflictBodySchema.safeParse(data);
    const body = parsed_body.success ? parsed_body.data : data;

    if (body.auditId && is_valid_uuid(body.auditId)) {
        const existingById = await select_audit_id_exists(body.auditId);
        if (existingById.rows.length > 0) {
            return body.auditId;
        }
    }
    const sample_ids = (body.samples || [])
        .map((s) => s?.id)
        .filter((id): id is string => Boolean(id) && is_valid_uuid(id));
    if (sample_ids.length > 0) {
        const first_sample_id = sample_ids[0];
        const existingBySample = await select_audit_id_by_sample_id(first_sample_id);
        if (existingBySample.rows.length > 0) {
            return existingBySample.rows[0].id as string;
        }
    }
    return null;
}

export async function build_existing_audit_summary_for_response(audit_id: string): Promise<Record<string, unknown> | null> {
    const result = await fetch_audit_summary_for_import_conflict(audit_id);
    if (result.rows.length === 0) {
        return null;
    }
    const row = safe_parse_db_row(AuditConflictSummaryRowSchema, result.rows[0]);
    if (!row) {
        return null;
    }
    const samples = row.samples;
    const sampleCount = Array.isArray(samples) ? samples.length : 0;
    const meta = row.metadata || {};
    return {
        version: row.version,
        updated_at: row.updated_at,
        status: row.status,
        sampleCount,
        lastUpdatedBy: row.last_updated_by || null,
        metadata: {
            caseNumber: (meta.caseNumber ?? '').toString(),
            actorName: (meta.actorName ?? '').toString()
        }
    };
}
