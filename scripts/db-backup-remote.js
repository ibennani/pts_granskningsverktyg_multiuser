#!/usr/bin/env node
/**
 * Skapar en PostgreSQL-backup på deploy-servern i en serverkatalog.
 *
 * Kör lokalt:
 *   node scripts/db-backup-remote.js
 *
 * Hämtning (exempel):
 *   scp ux-granskningsverktyg.pts.ad:/var/www/granskningsverktyget-v2/backups/db/<filnamn> .
 */
import { exec, disconnect, remotePath } from './deploy-utils.js';
 
const BACKUP_DIR = process.env.GV_DB_BACKUP_DIR || '/var/www/granskningsverktyget-v2/backups/db';
const KEEP = parseInt(process.env.GV_DB_BACKUP_KEEP || '30', 10);
const DOCKER_PROJECT = process.env.GV_DOCKER_PROJECT || 'granskningsverktyget-v2';
const DB_CONTAINER = process.env.GV_DB_CONTAINER || 'granskningsverktyget-db';
const DB_USER = process.env.GV_DB_USER || 'granskning';
const DB_NAME = process.env.GV_DB_NAME || 'granskningsverktyget';
 
function safe_int(n, fallback) {
    return Number.isFinite(n) && n > 0 ? n : fallback;
}
 
async function main() {
    const keep = safe_int(KEEP, 30);
    const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const filename = `gv_postgres_${ts}.dump`;
    const fullpath = `${BACKUP_DIR}/${filename}`;
 
    try {
        console.log('[backup] Skapar backup på servern...');
        const cmds = [
            `mkdir -p ${BACKUP_DIR}`,
            // Säkerställ att Postgres är igång med rätt projektnamn/volym.
            `cd ${remotePath} && docker compose -p ${DOCKER_PROJECT} up -d postgres`,
            // Dump i custom-format (kompakt och snabb att återställa).
            `docker exec ${DB_CONTAINER} pg_dump -U ${DB_USER} -d ${DB_NAME} -Fc > ${fullpath}`,
            // Lista senaste filer
            `ls -lh ${BACKUP_DIR} | tail -n 20`,
            // En enkel retention: behåll senaste N dump-filer
            `if [ "${keep}" -gt 0 ]; then ` +
                `cd ${BACKUP_DIR} && ` +
                `ls -1t gv_postgres_*.dump 2>/dev/null | tail -n +$(( ${keep} + 1 )) | xargs -r rm -f; ` +
            `fi`,
            `echo "" && echo "[backup] Klar:" && echo ${fullpath}`
        ];
        await exec(cmds.join(' && '));
    } finally {
        await disconnect();
    }
}
 
main().catch((err) => {
    console.error('[backup] Fel:', err?.message || err);
    process.exit(1);
});

