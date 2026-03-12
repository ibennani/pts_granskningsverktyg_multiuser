#!/usr/bin/env node
/**
 * Listar PostgreSQL-backuper i serverkatalogen.
 *
 * Kör lokalt:
 *   node scripts/db-backup-list-remote.js
 */
import { exec, disconnect } from './deploy-utils.js';

const BACKUP_DIR = process.env.GV_DB_BACKUP_DIR || '/var/www/granskningsverktyget-v2/backups/db';

async function main() {
    try {
        const cmds = [
            `echo "=== Backup-katalog ===" && echo ${BACKUP_DIR}`,
            `echo "" && echo "=== Filer (senaste 50) ===" && (ls -lht ${BACKUP_DIR} 2>/dev/null | head -n 52 || echo "Inga backupfiler hittades")`,
            `echo "" && echo "=== Total storlek ===" && (du -sh ${BACKUP_DIR} 2>/dev/null || true)`
        ];
        await exec(cmds.join(' && '));
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[backup-list] Fel:', err?.message || err);
    process.exit(1);
});

