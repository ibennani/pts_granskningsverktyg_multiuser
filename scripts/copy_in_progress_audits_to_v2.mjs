#!/usr/bin/env node
/**
 * Kopierar pågående granskningar från lokal DB till V2.
 * Enda ändringen mot källan: metadata.actorName får prefix "(Förnamn) ".
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { query as local_query } from '../server/db.js';
import { exec, putFile, disconnect, remotePath } from './deploy-utils.js';

const FIRST_NAMES = [
    'Carro',
    'Veronica',
    'Ilias',
    'Natasza',
    'Petra',
    'Nora',
    'Jon',
    'Claudio'
];

function prefix_actor_name(actor_name, first_name) {
    const base = (actor_name ?? '').toString().trim();
    const prefix = `(${first_name}) `;
    if (base.startsWith(`(${first_name})`)) {
        return base;
    }
    return `${prefix}${base}`;
}

async function fetch_local_audits() {
    const result = await local_query(
        `SELECT id, rule_set_id, rule_file_content, status, metadata, samples,
                archived_requirement_results, last_rulefile_update_log, version,
                last_updated_by, created_at, updated_at::text AS updated_at
         FROM audits
         WHERE status = 'in_progress'
         ORDER BY updated_at DESC`
    );
    if (result.rows.length !== FIRST_NAMES.length) {
        throw new Error(
            `Förväntade ${FIRST_NAMES.length} pågående granskningar lokalt, hittade ${result.rows.length}`
        );
    }
    return result.rows.map((row, index) => {
        const metadata = { ...(row.metadata || {}) };
        metadata.actorName = prefix_actor_name(metadata.actorName, FIRST_NAMES[index]);
        return {
            ...row,
            metadata,
            _label: `${FIRST_NAMES[index]} → ${metadata.actorName}`
        };
    });
}

const runner_name = '_copy_audits_to_v2_runner.mjs';
const runner_local = join(process.cwd(), 'scripts', runner_name);
const payload_local = join(process.cwd(), 'scripts', '_copy_audits_to_v2_payload.json');
const payload_remote = `${remotePath}/scripts/_copy_audits_to_v2_payload.json`;
const runner_remote = `${remotePath}/scripts/${runner_name}`;

const runner_source = `import 'dotenv/config';
import { readFileSync } from 'fs';
import pg from 'pg';

const payload_path = process.argv[2];
const rows = JSON.parse(readFileSync(payload_path, 'utf8'));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

for (const row of rows) {
    const params = [
        row.id,
        row.rule_set_id,
        row.rule_file_content != null ? JSON.stringify(row.rule_file_content) : null,
        row.status,
        JSON.stringify(row.metadata || {}),
        JSON.stringify(row.samples || []),
        row.archived_requirement_results != null ? JSON.stringify(row.archived_requirement_results) : null,
        row.last_rulefile_update_log != null ? JSON.stringify(row.last_rulefile_update_log) : null,
        row.version ?? 1,
        row.last_updated_by,
        row.created_at,
        row.updated_at
    ];
    const sql = \`INSERT INTO audits (
            id, rule_set_id, rule_file_content, status, metadata, samples,
            archived_requirement_results, last_rulefile_update_log, version,
            last_updated_by, created_at, updated_at
        ) VALUES (
            $1, $2, $3::jsonb, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $11, $12
        )
        ON CONFLICT (id) DO UPDATE SET
            rule_set_id = EXCLUDED.rule_set_id,
            rule_file_content = EXCLUDED.rule_file_content,
            status = EXCLUDED.status,
            metadata = EXCLUDED.metadata,
            samples = EXCLUDED.samples,
            archived_requirement_results = EXCLUDED.archived_requirement_results,
            last_rulefile_update_log = EXCLUDED.last_rulefile_update_log,
            version = EXCLUDED.version,
            last_updated_by = EXCLUDED.last_updated_by,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at\`;
    await pool.query(sql, params);
    console.info('[copy-v2] Sparad:', row.metadata?.actorName || row.id);
}
await pool.end();
console.info('[copy-v2] Klart:', rows.length, 'granskningar');
`;

async function main() {
    const audits = await fetch_local_audits();
    audits.forEach((row, i) => {
        console.info(`${i + 1}. ${row._label}`);
    });

    const payload = audits.map(({ _label, ...rest }) => rest);
    writeFileSync(payload_local, JSON.stringify(payload), 'utf8');
    writeFileSync(runner_local, runner_source, 'utf8');

    try {
        console.info('\n[copy-v2] Laddar upp till V2 och kör import…');
        await putFile(payload_local, payload_remote);
        await putFile(runner_local, runner_remote);
        await exec(`node scripts/${runner_name} scripts/_copy_audits_to_v2_payload.json`);
        console.info('[copy-v2] Alla granskningar kopierade till V2.');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[copy-v2] Fel:', err.message);
    process.exit(1);
});
