#!/usr/bin/env node
/**
 * Återställer en granskning på v2-servern från JSON-säkerhetskopia på disk.
 * Kör lokalt: node scripts/restore_audit_from_backup_remote.mjs <audit-id> <backup-filnamn>
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { exec, putFile, disconnect, remotePath } from './deploy-utils.js';

const audit_id = process.argv[2];
const backup_filename = process.argv[3];

if (!audit_id || !backup_filename) {
    console.error('Användning: node scripts/restore_audit_from_backup_remote.mjs <audit-id> <backup-filnamn>');
    process.exit(1);
}

const runner_name = '_restore_audit_runner.mjs';
const runner_local = join(process.cwd(), 'scripts', runner_name);
const runner_remote = `${remotePath}/scripts/${runner_name}`;

const runner_source = `import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

const audit_id = process.argv[2];
const backup_filename = process.argv[3];
const backup_base = process.env.GV_BACKUP_DIR || join(process.cwd(), 'backup');
const fp = join(backup_base, audit_id, backup_filename);

const data = JSON.parse(readFileSync(fp, 'utf8'));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const before = await pool.query(
    'SELECT version, status, last_updated_by FROM audits WHERE id = $1',
    [audit_id]
);
if (before.rows.length === 0) {
    console.error('[restore] Granskning saknas:', audit_id);
    process.exit(1);
}
console.log('[restore] Före — version:', before.rows[0].version, 'status:', before.rows[0].status, 'av:', before.rows[0].last_updated_by);
console.log('[restore] Backup:', fp, 'backup-version:', data.version, 'status:', data.auditStatus);

const meta = JSON.stringify(data.auditMetadata || {});
const samples = JSON.stringify(data.samples || []);
const rule_file = data.ruleFileContent != null ? JSON.stringify(data.ruleFileContent) : null;
const archived = JSON.stringify(data.archivedRequirementResults || []);
const rule_log = data.lastRulefileUpdateLog != null ? JSON.stringify(data.lastRulefileUpdateLog) : null;
const status = data.auditStatus || 'in_progress';

const updated = await pool.query(
    \`UPDATE audits SET
        metadata = $1::jsonb,
        status = $2,
        samples = $3::jsonb,
        rule_file_content = $4::jsonb,
        archived_requirement_results = $5::jsonb,
        last_rulefile_update_log = $6::jsonb,
        version = version + 1,
        last_updated_by = $7,
        updated_at = CURRENT_TIMESTAMP
     WHERE id = $8
     RETURNING version, status, updated_at::text AS updated_at, last_updated_by\`,
    [meta, status, samples, rule_file, archived, rule_log, 'Återställning från säkerhetskopia', audit_id]
);

const row = updated.rows[0];
console.log('[restore] Efter — version:', row.version, 'status:', row.status, 'updated_at:', row.updated_at);
await pool.end();
`;

async function main() {
    const { writeFileSync } = await import('fs');
    writeFileSync(runner_local, runner_source, 'utf8');
    try {
        console.log(`[restore] Laddar upp och kör på servern (${audit_id})…`);
        await putFile(runner_local, runner_remote);
        await exec(`node scripts/${runner_name} ${audit_id} ${backup_filename}`);
        console.log('[restore] Klart.');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[restore] Fel:', err.message);
    process.exit(1);
});
