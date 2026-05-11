/**
 * @fileoverview Importhjälp: konflikt-id och sammanfattning för 409-svar.
 */

import { query } from '../db.js';
import {
    select_audit_id_by_sample_id,
    select_audit_id_exists,
    fetch_audit_summary_for_import_conflict
} from '../repositories/audit_repository.js';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ImportBody = {
    auditId?: string;
    samples?: Array<{ id?: string }>;
};

export async function find_import_conflict_audit_id(data: ImportBody): Promise<string | null> {
    if (data.auditId && UUID_REGEX.test(data.auditId)) {
        const existingById = await select_audit_id_exists(data.auditId);
        if (existingById.rows.length > 0) {
            return data.auditId;
        }
    }
    const sample_ids = (data.samples || [])
        .map((s) => s?.id)
        .filter((id): id is string => Boolean(id) && UUID_REGEX.test(id as string));
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
    const row = result.rows[0] as {
        samples: unknown;
        metadata?: Record<string, unknown>;
        version: number;
        updated_at: string;
        status: string;
        last_updated_by?: string | null;
    };
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
