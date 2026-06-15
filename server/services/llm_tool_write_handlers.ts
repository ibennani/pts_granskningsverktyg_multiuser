/**
 * @file Skrivverktyg för LLM-agenten – uppdaterar granskningar via samma databaslogik som API.
 */

import { query } from '../db.js';
import { has_meaningful_audit_patch_change } from '../logic/audit_meaningful_change.js';

function parse_json_value<T>(value: unknown): T | null {
    if (value == null) return null;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }
    return value as T;
}

type SampleShape = {
    id?: string;
    requirementResults?: Record<string, Record<string, unknown>>;
};

async function fetch_audit_row(audit_id: string) {
    const result = await query(
        `SELECT id, metadata, status, samples, version, last_updated_by FROM audits WHERE id = $1`,
        [audit_id]
    );
    if (result.rows.length === 0) {
        throw new Error('Granskningen hittades inte.');
    }
    return result.rows[0] as Record<string, unknown>;
}

async function apply_audit_samples_patch(
    audit_id: string,
    samples: unknown,
    user_name: string | null
): Promise<Record<string, unknown>> {
    const existing = await fetch_audit_row(audit_id);
    const expect_version = Number(existing.version);
    const bump_updated_at = has_meaningful_audit_patch_change(
        {
            metadata: existing.metadata,
            status: existing.status,
            samples: existing.samples,
            rule_file_content: null,
            archived_requirement_results: null,
            last_rulefile_update_log: null
        },
        { samples }
    );
    const updated_at_sql = bump_updated_at ? 'CURRENT_TIMESTAMP' : 'updated_at';
    const result = await query(
        `UPDATE audits
         SET samples = $1, version = version + 1, last_updated_by = $2, updated_at = ${updated_at_sql}
         WHERE id = $3 AND version = $4
         RETURNING id, version, updated_at::text AS updated_at`,
        [JSON.stringify(samples), user_name, audit_id, expect_version]
    );
    if (result.rows.length === 0) {
        throw new Error('Versionskonflikt – ladda om granskningen och försök igen.');
    }
    return result.rows[0] as Record<string, unknown>;
}

export async function tool_update_audit_metadata(
    args: { audit_id?: string; metadata?: Record<string, unknown> },
    user_name: string | null
) {
    const audit_id = typeof args.audit_id === 'string' ? args.audit_id.trim() : '';
    const patch = args.metadata && typeof args.metadata === 'object' ? args.metadata : null;
    if (!audit_id || !patch) {
        throw new Error('audit_id och metadata krävs.');
    }
    const existing = await fetch_audit_row(audit_id);
    const current_meta = parse_json_value<Record<string, unknown>>(existing.metadata) || {};
    const merged = { ...current_meta, ...patch };
    const expect_version = Number(existing.version);
    const result = await query(
        `UPDATE audits
         SET metadata = $1, version = version + 1, last_updated_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND version = $4
         RETURNING id, version, metadata, updated_at::text AS updated_at`,
        [JSON.stringify(merged), user_name, audit_id, expect_version]
    );
    if (result.rows.length === 0) {
        throw new Error('Versionskonflikt – ladda om granskningen och försök igen.');
    }
    return JSON.stringify({ ok: true, audit: result.rows[0] });
}

export async function tool_update_requirement_result(
    args: {
        audit_id?: string;
        sample_id?: string;
        requirement_id?: string;
        status?: string;
        observation?: string;
    },
    user_name: string | null
) {
    const audit_id = typeof args.audit_id === 'string' ? args.audit_id.trim() : '';
    const sample_id = typeof args.sample_id === 'string' ? args.sample_id.trim() : '';
    const requirement_id = typeof args.requirement_id === 'string' ? args.requirement_id.trim() : '';
    if (!audit_id || !sample_id || !requirement_id) {
        throw new Error('audit_id, sample_id och requirement_id krävs.');
    }
    const existing = await fetch_audit_row(audit_id);
    const samples = parse_json_value<SampleShape[]>(existing.samples) || [];
    const sample_index = samples.findIndex((s) => String(s.id) === sample_id);
    if (sample_index < 0) {
        throw new Error('Stickprovet hittades inte i granskningen.');
    }
    const sample = samples[sample_index];
    const results = { ...(sample.requirementResults || {}) };
    const current = { ...(results[requirement_id] || {}) };
    if (typeof args.status === 'string' && args.status.trim()) {
        current.status = args.status.trim();
        current.lastStatusUpdate = new Date().toISOString();
    }
    if (typeof args.observation === 'string') {
        current.observation = args.observation;
    }
    results[requirement_id] = current;
    samples[sample_index] = { ...sample, requirementResults: results };
    const saved = await apply_audit_samples_patch(audit_id, samples, user_name);
    return JSON.stringify({
        ok: true,
        audit_id,
        sample_id,
        requirement_id,
        version: saved.version
    });
}
