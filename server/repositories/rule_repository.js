/**
 * @file Databasåtkomst för regelfiler (rule_sets) – listning och enstaka rader.
 */

import { query } from '../db.js';
import { has_rule_sets_published_content_column } from './rule_sets_column.js';

export { has_rule_sets_published_content_column } from './rule_sets_column.js';

/**
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function fetch_rule_sets_list() {
    const hasPublished = await has_rule_sets_published_content_column();
    const sql = hasPublished
        ? `SELECT id,
                published_content IS NOT NULL AS is_published,
                (production_base_id IS NOT NULL OR published_content IS NULL) AS list_as_arbetskopia,
                COALESCE(
                    NULLIF(TRIM(COALESCE(published_content, content)->'metadata'->>'title'), ''),
                    name
                ) AS name,
                NULLIF(TRIM(COALESCE(published_content, content)->'metadata'->>'version'), '') AS version_display,
                COALESCE(published_content, content)->'metadata'->>'version' AS metadata_version,
                COALESCE(
                    NULLIF(TRIM(COALESCE(published_content, content)->'metadata'->'monitoringType'->>'text'), ''),
                    NULLIF(TRIM(COALESCE(published_content, content)->'metadata'->'monitoringType'->>'label'), '')
                ) AS monitoring_type_text,
                (published_content IS NOT NULL AND content::text <> published_content::text) AS has_draft,
                CASE
                    WHEN published_content IS NOT NULL AND content::text <> published_content::text
                    THEN content->'metadata'->>'version'
                    ELSE NULL
                END AS draft_version,
                version, created_at::text AS created_at, updated_at::text AS updated_at,
                content_updated_at::text AS content_updated_at,
                production_base_id
           FROM rule_sets
           ORDER BY updated_at DESC`
        : `SELECT id,
                false AS is_published,
                true AS list_as_arbetskopia,
                COALESCE(NULLIF(TRIM(content->'metadata'->>'title'), ''), name) AS name,
                NULLIF(TRIM(content->'metadata'->>'version'), '') AS version_display,
                content->'metadata'->>'version' AS metadata_version,
                COALESCE(
                    NULLIF(TRIM(content->'metadata'->'monitoringType'->>'text'), ''),
                    NULLIF(TRIM(content->'metadata'->'monitoringType'->>'label'), '')
                ) AS monitoring_type_text,
                false AS has_draft,
                NULL AS draft_version,
                version, created_at::text AS created_at, updated_at::text AS updated_at,
                content_updated_at::text AS content_updated_at,
                production_base_id
           FROM rule_sets
           ORDER BY updated_at DESC`;
    return query(sql);
}

/**
 * @param {string} id
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function fetch_rule_set_version_row(id) {
    return query('SELECT version, updated_at FROM rule_sets WHERE id = $1', [id]);
}

/**
 * @param {string} id
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function fetch_rule_set_by_id(id) {
    return query('SELECT * FROM rule_sets WHERE id = $1', [id]);
}

/**
 * @param {string} id
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function fetch_rule_set_for_export(id) {
    const hasPublished = await has_rule_sets_published_content_column();
    const sql = hasPublished
        ? `SELECT id,
                  name,
                  COALESCE(published_content, content) AS content,
                  version,
                  updated_at::text AS updated_at,
                  content_updated_at::text AS content_updated_at,
                  (published_content IS NOT NULL) AS is_published
             FROM rule_sets
            WHERE id = $1`
        : `SELECT id,
                  name,
                  content,
                  version,
                  updated_at::text AS updated_at,
                  content_updated_at::text AS content_updated_at,
                  false AS is_published
             FROM rule_sets
            WHERE id = $1`;
    return query(sql, [id]);
}

/**
 * @param {string} contentJson
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function fetch_rule_set_by_content_json(contentJson) {
    return query(
        'SELECT * FROM rule_sets WHERE content = $1::jsonb LIMIT 1',
        [contentJson]
    );
}

/**
 * @param {string} rule_set_id
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function fetch_active_audits_count_for_rule(rule_set_id) {
    return query(
        `SELECT COUNT(*) AS count FROM audits
         WHERE rule_set_id = $1 AND status IN ('not_started', 'in_progress')`,
        [rule_set_id]
    );
}

/**
 * @param {string} production_base_id
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function clear_production_base_id_refs(production_base_id) {
    return query(
        'UPDATE rule_sets SET production_base_id = NULL WHERE production_base_id = $1',
        [production_base_id]
    );
}
