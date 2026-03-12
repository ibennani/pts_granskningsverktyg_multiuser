#!/usr/bin/env node
/**
 * Verifierar att senaste PostgreSQL-backup på servern är läsbar (pg_restore --list).
 * Skapar ingen temporär databas – kontrollerar bara att dump-filen är giltig.
 *
 * Kör lokalt: node scripts/db-backup-verify-remote.js
 */
import { exec, disconnect } from './deploy-utils.js';

const BACKUP_DIR = process.env.GV_DB_BACKUP_DIR || '/var/www/granskningsverktyget-v2/backups/db';
const DB_CONTAINER = process.env.GV_DB_CONTAINER || 'granskningsverktyget-db';

async function main() {
    try {
        console.log('[verify] Verifierar senaste backup...');
        const cmd = [
            `DUMP=$(ls -1t ${BACKUP_DIR}/gv_postgres_*.dump 2>/dev/null | head -1)`,
            `test -n "$DUMP" || { echo "Ingen backup-fil hittades"; exit 1; }`,
            `echo "Fil: $DUMP"`,
            `cat "$DUMP" | docker exec -i ${DB_CONTAINER} pg_restore --list -Fc > /dev/null`
        ].join(' && ');
        await exec(cmd);
        console.log('[verify] Dump-filen är giltig (pg_restore --list lyckades).');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[verify] Fel:', err?.message || err);
    process.exit(1);
});
