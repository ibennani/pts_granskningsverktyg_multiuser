#!/usr/bin/env node
/**
 * Kör restore_sample_media_from_backup.mjs på v2-servern.
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { exec, putFile, disconnect, remotePath } from './deploy-utils.js';

const audit_id = process.argv[2];
const backup_filename = process.argv[3] || '';

if (!audit_id) {
    console.error('Användning: node scripts/restore_sample_media_from_backup_remote.mjs <audit-id> [backup-filnamn]');
    process.exit(1);
}

const runner_name = 'restore_sample_media_from_backup.mjs';
const runner_local = join(process.cwd(), 'scripts', runner_name);
const runner_remote = `${remotePath}/scripts/${runner_name}`;

async function main() {
    const source = readFileSync(runner_local, 'utf8');
    try {
        console.info(`[media-restore] Laddar upp och kör på servern (${audit_id})…`);
        await putFile(runner_local, runner_remote);
        const args = backup_filename
            ? `${audit_id} ${JSON.stringify(backup_filename)}`
            : audit_id;
        await exec(`node scripts/${runner_name} ${args}`);
        console.info('[media-restore] Klart.');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[media-restore] Fel:', err.message);
    process.exit(1);
});
