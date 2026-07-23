/**
 * Importerar selektiv synk-payload till testserverns databas (anropas på servern).
 *
 * Kör: node scripts/import-test-server-sync.mjs /path/to/sync-dir
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import {
    DEFAULT_TEST_DATABASE_URL,
    NETONNET_ACTOR_SQL_PATTERN,
} from './lib/rulefile_sync_targets.mjs';

function read_json(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

async function upsert_rule_sets(pool, rows) {
    for (const row of rows) {
        await pool.query(
            `INSERT INTO rule_sets (
                id, name, content, published_content, version,
                created_at, updated_at, content_updated_at, production_base_id
             ) VALUES (
                $1, $2, $3::jsonb, $4::jsonb, $5,
                $6, $7, $8, $9
             )
             ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                content = EXCLUDED.content,
                published_content = EXCLUDED.published_content,
                version = EXCLUDED.version,
                updated_at = EXCLUDED.updated_at,
                content_updated_at = EXCLUDED.content_updated_at,
                production_base_id = EXCLUDED.production_base_id`,
            [
                row.id,
                row.name,
                JSON.stringify(row.content),
                row.published_content ? JSON.stringify(row.published_content) : null,
                row.version,
                row.created_at,
                row.updated_at,
                row.content_updated_at,
                row.production_base_id,
            ]
        );
        console.log(`[import] Regelfil uppdaterad: ${row.name} (${row.id})`);
    }
}

async function replace_netonnet_audit(pool, audit_row) {
    const existing = await pool.query(
        `SELECT id FROM audits WHERE metadata->>'actorName' ILIKE $1`,
        [NETONNET_ACTOR_SQL_PATTERN]
    );

    for (const row of existing.rows) {
        await pool.query('DELETE FROM audit_edit_locks WHERE audit_id = $1', [row.id]);
        await pool.query('DELETE FROM audits WHERE id = $1', [row.id]);
        console.log(`[import] Raderade befintlig NetOnNet-granskning: ${row.id}`);
    }

    await pool.query(
        `INSERT INTO audits (
            id, rule_set_id, rule_file_content, status, metadata, samples,
            version, last_updated_by, archived_requirement_results,
            last_rulefile_update_log, created_at, updated_at
         ) VALUES (
            $1, $2, $3::jsonb, $4, $5::jsonb, $6::jsonb,
            $7, $8, $9::jsonb, $10::jsonb, $11, $12
         )`,
        [
            audit_row.id,
            audit_row.rule_set_id,
            JSON.stringify(audit_row.rule_file_content),
            audit_row.status,
            JSON.stringify(audit_row.metadata),
            JSON.stringify(audit_row.samples),
            audit_row.version,
            audit_row.last_updated_by,
            audit_row.archived_requirement_results
                ? JSON.stringify(audit_row.archived_requirement_results)
                : null,
            audit_row.last_rulefile_update_log
                ? JSON.stringify(audit_row.last_rulefile_update_log)
                : null,
            audit_row.created_at,
            audit_row.updated_at,
        ]
    );
    console.log(`[import] NetOnNet-granskning importerad: ${audit_row.id}`);
}

async function main() {
    const sync_dir = process.argv[2];
    if (!sync_dir) {
        console.error('Ange katalog med rule_sets.json och netonnet_audit.json');
        process.exit(1);
    }

    const rule_sets_path = join(sync_dir, 'rule_sets.json');
    const netonnet_path = join(sync_dir, 'netonnet_audit.json');
    if (!existsSync(rule_sets_path) || !existsSync(netonnet_path)) {
        throw new Error('Saknar rule_sets.json eller netonnet_audit.json i synk-katalogen');
    }

    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL || DEFAULT_TEST_DATABASE_URL,
    });

    try {
        await upsert_rule_sets(pool, read_json(rule_sets_path));
        await replace_netonnet_audit(pool, read_json(netonnet_path));
    } finally {
        await pool.end();
    }
}

main().catch((err) => {
    console.error('[import-test-server-sync] Fel:', err.message);
    process.exit(1);
});
