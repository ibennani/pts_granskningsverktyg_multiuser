/**
 * Exporterar regelfiler och NetOnNet från lokal DB till synk-katalog.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import {
    DEFAULT_LOCAL_DATABASE_URL,
    NETONNET_ACTOR_SQL_PATTERN,
    RULEFILE_TARGET_IDS,
} from './lib/rulefile_sync_targets.mjs';

function parse_json(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
        return JSON.parse(value);
    }
    return null;
}

function create_local_pool() {
    return new pg.Pool({
        connectionString: process.env.DATABASE_URL || DEFAULT_LOCAL_DATABASE_URL,
    });
}

async function export_rule_sets(pool, sync_dir) {
    const result = await pool.query(
        `SELECT id, name, content, published_content, version,
                created_at, updated_at, content_updated_at, production_base_id
         FROM rule_sets
         WHERE id = ANY($1::uuid[])
         ORDER BY id`,
        [RULEFILE_TARGET_IDS]
    );

    if (result.rows.length !== RULEFILE_TARGET_IDS.length) {
        const found = new Set(result.rows.map((row) => row.id));
        const missing = RULEFILE_TARGET_IDS.filter((id) => !found.has(id));
        throw new Error(`Saknade regelfiler i lokal DB: ${missing.join(', ')}`);
    }

    const payload = result.rows.map((row) => ({
        ...row,
        content: parse_json(row.content),
        published_content: row.published_content ? parse_json(row.published_content) : null,
    }));

    writeFileSync(join(sync_dir, 'rule_sets.json'), JSON.stringify(payload, null, 2), 'utf8');
    console.log(`[sync] Exporterade ${payload.length} regelfiler.`);
}

async function export_netonnet_audit(pool, sync_dir) {
    const result = await pool.query(
        `SELECT id, rule_set_id, rule_file_content, status, metadata, samples,
                version, last_updated_by, archived_requirement_results,
                last_rulefile_update_log, created_at, updated_at
         FROM audits
         WHERE metadata->>'actorName' ILIKE $1
         ORDER BY updated_at DESC
         LIMIT 1`,
        [NETONNET_ACTOR_SQL_PATTERN]
    );

    if (result.rows.length === 0) {
        throw new Error('Ingen NetOnNet-granskning hittades i lokal databas');
    }

    const row = result.rows[0];
    const payload = {
        ...row,
        rule_file_content: parse_json(row.rule_file_content),
        metadata: parse_json(row.metadata),
        samples: parse_json(row.samples),
        archived_requirement_results: row.archived_requirement_results
            ? parse_json(row.archived_requirement_results)
            : null,
        last_rulefile_update_log: row.last_rulefile_update_log
            ? parse_json(row.last_rulefile_update_log)
            : null,
    };

    writeFileSync(join(sync_dir, 'netonnet_audit.json'), JSON.stringify(payload, null, 2), 'utf8');
    writeFileSync(join(sync_dir, 'netonnet_audit_id.txt'), row.id, 'utf8');
    console.log(`[sync] Exporterade NetOnNet-granskning ${row.id}.`);
    return row.id;
}

export async function export_local_sync_payload(project_root, sync_dir) {
    mkdirSync(sync_dir, { recursive: true });
    const pool = create_local_pool();
    try {
        await export_rule_sets(pool, sync_dir);
        const audit_id = await export_netonnet_audit(pool, sync_dir);
        return { audit_id };
    } finally {
        await pool.end();
    }
}

export function resolve_sync_dir(project_root) {
    return join(project_root, '.tmp-test-server-sync');
}
