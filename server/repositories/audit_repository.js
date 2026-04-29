/**
 * @file Databasåtkomst för granskningar (audits) – listor och importhjälpfrågor.
 */

import { query } from '../db.js';
import { has_rule_sets_published_content_column } from './rule_sets_column.js';

export { has_rule_sets_published_content_column } from './rule_sets_column.js';

/**
 * @param {string|undefined} status
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function fetch_audits_index_rows(status) {
    const hasPublished = await has_rule_sets_published_content_column();
    let sql;
    if (hasPublished) {
        sql = `SELECT a.id, a.rule_set_id, a.rule_file_content, a.status, a.metadata, a.samples, a.version, a.last_updated_by, a.created_at, a.updated_at::text AS updated_at,
            COALESCE(
                NULLIF(TRIM(COALESCE(a.rule_file_content, COALESCE(r.published_content, r.content))->'metadata'->>'title'), ''),
                r.name
            ) as rule_set_name,
            COALESCE(a.rule_file_content, COALESCE(r.published_content, r.content)) as rule_content
            FROM audits a LEFT JOIN rule_sets r ON a.rule_set_id = r.id`;
    } else {
        sql = `SELECT a.id, a.rule_set_id, a.rule_file_content, a.status, a.metadata, a.samples, a.version, a.last_updated_by, a.created_at, a.updated_at::text AS updated_at,
            COALESCE(
                NULLIF(TRIM(COALESCE(a.rule_file_content, r.content)->'metadata'->>'title'), ''),
                r.name
            ) as rule_set_name,
            COALESCE(a.rule_file_content, r.content) as rule_content
            FROM audits a LEFT JOIN rule_sets r ON a.rule_set_id = r.id`;
    }
    const params = [];
    if (status) {
        params.push(status);
        sql += ' WHERE a.status = $1';
    }
    sql += ' ORDER BY a.updated_at DESC';
    return query(sql, params);
}

/**
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function fetch_statistics_audits_locked_archived() {
    return query(
        `SELECT status, metadata, samples, rule_file_content, created_at, updated_at
         FROM audits
         WHERE status IN ('locked', 'archived')
         ORDER BY updated_at DESC`
    );
}

/**
 * @param {string} audit_id
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function select_audit_id_exists(audit_id) {
    return query('SELECT id FROM audits WHERE id = $1', [audit_id]);
}

/**
 * @param {string} sample_id
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function select_audit_id_by_sample_id(sample_id) {
    return query(
        `SELECT a.id FROM audits a, jsonb_array_elements(COALESCE(a.samples, '[]'::jsonb)) AS s
         WHERE s->>'id' = $1 LIMIT 1`,
        [sample_id]
    );
}

/**
 * @param {string} audit_id
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function fetch_audit_summary_for_import_conflict(audit_id) {
    return query(
        `SELECT version, updated_at, status, metadata, samples, last_updated_by
         FROM audits WHERE id = $1`,
        [audit_id]
    );
}
