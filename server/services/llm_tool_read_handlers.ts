/**
 * @file Läsverktyg för LLM-agenten (databas via befintliga repositories).
 */

import { query } from '../db.js';
import { fetch_audits_index_rows } from '../repositories/audit_repository.js';
import { fetch_rule_sets_list, fetch_rule_set_by_id } from '../repositories/rule_repository.js';
import { build_statistics_from_audit_rows } from '../audit_aggregated_statistics.js';
import { map_audit_index_row_to_list_item } from '../routes/audit_index_row_mapper.js';
import {
    count_requirements_in_rule_content,
    summarize_samples,
    trim_tool_json
} from './llm_tool_summaries.js';

export async function tool_list_audits(args: { status?: string }) {
    const status = typeof args.status === 'string' && args.status.trim() ? args.status.trim() : undefined;
    const result = await fetch_audits_index_rows(status);
    const rows = result.rows.map((row: unknown) => map_audit_index_row_to_list_item(row as never));
    return trim_tool_json({ audits: rows });
}

export async function tool_get_audit(args: { audit_id?: string }) {
    const audit_id = typeof args.audit_id === 'string' ? args.audit_id.trim() : '';
    if (!audit_id) throw new Error('audit_id krävs.');
    const result = await query(
        `SELECT id, rule_set_id, status, metadata, samples, version, last_updated_by, created_at, updated_at::text AS updated_at
         FROM audits WHERE id = $1`,
        [audit_id]
    );
    if (result.rows.length === 0) {
        throw new Error('Granskningen hittades inte.');
    }
    const row = result.rows[0] as Record<string, unknown>;
    return trim_tool_json({
        id: row.id,
        rule_set_id: row.rule_set_id,
        status: row.status,
        version: row.version,
        metadata: row.metadata || {},
        last_updated_by: row.last_updated_by || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        samples: summarize_samples(row.samples)
    });
}

export async function tool_list_rule_sets() {
    const result = await fetch_rule_sets_list();
    const rows = result.rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        name: row.name,
        version_display: row.version_display,
        is_published: row.is_published,
        has_draft: row.has_draft,
        updated_at: row.updated_at
    }));
    return trim_tool_json({ rule_sets: rows });
}

export async function tool_get_rule_set(args: { rule_set_id?: string }) {
    const rule_set_id = typeof args.rule_set_id === 'string' ? args.rule_set_id.trim() : '';
    if (!rule_set_id) throw new Error('rule_set_id krävs.');
    const result = await fetch_rule_set_by_id(rule_set_id);
    if (result.rows.length === 0) {
        throw new Error('Regelfilen hittades inte.');
    }
    const row = result.rows[0] as Record<string, unknown>;
    const content = row.published_content ?? row.content;
    const metadata =
        content && typeof content === 'object' && content !== null
            ? (content as Record<string, unknown>).metadata || {}
            : {};
    return trim_tool_json({
        id: row.id,
        name: row.name,
        version: row.version,
        metadata,
        requirement_count: count_requirements_in_rule_content(content)
    });
}

export async function tool_get_statistics() {
    const result = await query(
        `SELECT status, metadata, samples, rule_file_content, created_at, updated_at
         FROM audits WHERE status IN ('locked', 'archived') ORDER BY updated_at DESC`
    );
    const payload = build_statistics_from_audit_rows(result.rows);
    return trim_tool_json(payload);
}
