#!/usr/bin/env node
/**
 * Kör migrate_last_in_progress_activity_at på V2-servern (samma SSH som deploy:v2).
 *
 * Användning:
 *   node scripts/migrate_last_in_progress_activity_at_v2.mjs --dry-run
 *   node scripts/migrate_last_in_progress_activity_at_v2.mjs --apply
 */
import 'dotenv/config';
import { exec, disconnect, remotePath } from './deploy-utils.js';

async function main() {
    const apply = process.argv.includes('--apply');
    const flag = apply ? '--apply' : '--dry-run';
    const rp = remotePath.replace(/'/g, "'\\''");
    try {
        console.info(`[migrate-v2] Kör migrering på ${remotePath} (${flag})...\n`);
        await exec(`cd '${rp}' && npx tsx server/scripts/migrate_last_in_progress_activity_at.js ${flag}`);
        console.info('\n[migrate-v2] Klart.');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[migrate-v2] Fel:', err.message);
    process.exit(1);
});
