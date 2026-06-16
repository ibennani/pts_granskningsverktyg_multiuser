/**
 * @file Läsverktyg för LLM-agenten (databas via befintliga repositories).
 */

import { query } from '../db.js';
import { fetch_audits_index_rows } from '../repositories/audit_repository.js';
import { fetch_rule_sets_list, fetch_rule_set_by_id } from '../repositories/rule_repository.js';
import { build_statistics_from_audit_rows } from '../audit_aggregated_statistics.js';
import { build_audit_list_payload } from './llm_tool_audit_list_compact.js';
import { build_audit_content_payload } from './llm_tool_audit_content.js';
import {
    compact_requirements_from_rule_content,
    resolve_rule_set_display_name
} from './llm_tool_rule_requirements.js';
import {
    count_requirements_in_rule_content,
    summarize_samples,
    trim_tool_json
} from './llm_tool_summaries.js';

async function resolve_audit_rule_set_name(row: Record<string, unknown>): Promise<string | null> {
    const from_embedded = resolve_rule_set_display_name(row.rule_file_content, null);
    if (from_embedded) return from_embedded;
    const rule_set_id = typeof row.rule_set_id === 'string' ? row.rule_set_id : '';
    if (!rule_set_id) return null;
    const rule_result = await fetch_rule_set_by_id(rule_set_id);
    if (!rule_result.rows.length) return null;
    const rule_row = rule_result.rows[0] as Record<string, unknown>;
    const content = rule_row.published_content ?? rule_row.content;
    return resolve_rule_set_display_name(content, rule_row.name as string);
}

async function fetch_audit_detail_row(audit_id: string): Promise<Record<string, unknown>> {
    const result = await query(
        `SELECT id, rule_set_id, status, metadata, samples, rule_file_content, version, last_updated_by,
            created_at, updated_at::text AS updated_at
         FROM audits WHERE id = $1`,
        [audit_id]
    );
    if (result.rows.length === 0) {
        throw new Error('Granskningen hittades inte.');
    }
    const row = result.rows[0] as Record<string, unknown>;
    row.rule_set_name = await resolve_audit_rule_set_name(row);
    return row;
}

export async function tool_list_audits(args: { status?: string }) {
    const status = typeof args.status === 'string' && args.status.trim() ? args.status.trim() : undefined;
    const result = await fetch_audits_index_rows(status);
    return trim_tool_json(build_audit_list_payload(result.rows as never));
}

export async function tool_get_audit(args: { audit_id?: string }) {
    const audit_id = typeof args.audit_id === 'string' ? args.audit_id.trim() : '';
    if (!audit_id) throw new Error('audit_id krävs.');
    const row = await fetch_audit_detail_row(audit_id);
    const metadata = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<
        string,
        unknown
    >;
    const meta_title = typeof metadata.title === 'string' ? metadata.title.trim() : '';
    return trim_tool_json({
        entity_type: 'audit',
        id: row.id,
        title: meta_title || row.rule_set_name || 'Namnlös granskning',
        rule_set_id: row.rule_set_id || null,
        rule_set_name: row.rule_set_name || null,
        status: row.status,
        version: row.version,
        metadata: row.metadata || {},
        last_updated_by: row.last_updated_by || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        samples: summarize_samples(row.samples)
    });
}

export async function tool_get_audit_content(args: {
    audit_id?: string;
    sample_id?: string;
    status_filter?: string;
}) {
    const audit_id = typeof args.audit_id === 'string' ? args.audit_id.trim() : '';
    if (!audit_id) throw new Error('audit_id krävs.');
    const row = await fetch_audit_detail_row(audit_id);
    const payload = build_audit_content_payload(row, {
        sample_id: typeof args.sample_id === 'string' ? args.sample_id : undefined,
        status_filter: typeof args.status_filter === 'string' ? args.status_filter : undefined
    });
    return trim_tool_json(payload);
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
    return trim_tool_json({ entity_type: 'rule_set_list', rule_sets: rows });
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
    const display_name = resolve_rule_set_display_name(content, row.name as string);
    return trim_tool_json({
        entity_type: 'rule_set',
        id: row.id,
        name: display_name || row.name,
        version: row.version,
        metadata,
        requirement_count: count_requirements_in_rule_content(content),
        requirements: compact_requirements_from_rule_content(content)
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
