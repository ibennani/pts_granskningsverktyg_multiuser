#!/usr/bin/env node
/**
 * Seed testserver på prod med data från lokal utvecklingsmiljö.
 * Kopierar PostgreSQL-dump, audit-media och valfritt backup/ till test-deploy-root.
 *
 * Kräver --confirm (skriver över granskningsverktyget_test).
 * Torrkörning: --dry-run
 *
 * Användning:
 *   npm run seed:test-server -- --confirm
 */
process.env.DEPLOY_PATH = process.env.DEPLOY_PATH || '/var/www/granskningsverktyget-test-server';

import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const {
    exec,
    putFile,
    putDirectory,
    disconnect,
    host,
    remotePath,
    projectRoot
} = await import('./deploy-utils.js');

const LOCAL_DOCKER_PROJECT = process.env.GV_LOCAL_DOCKER_PROJECT || 'sessionversion';
const LOCAL_DB_CONTAINER = process.env.GV_LOCAL_DB_CONTAINER || 'granskningsverktyget-db';
const LOCAL_DB_USER = process.env.GV_LOCAL_DB_USER || 'granskning';
const LOCAL_DB_NAME = process.env.GV_LOCAL_DB_NAME || 'granskningsverktyget';
const REMOTE_DB_CONTAINER = process.env.GV_DB_CONTAINER || 'granskningsverktyget-db';
const REMOTE_DB_USER = process.env.GV_DB_USER || 'granskning';
const REMOTE_DB_NAME = process.env.GV_TEST_SERVER_DB_NAME || 'granskningsverktyget_test';
const REMOTE_DOCKER_PROJECT = process.env.GV_DOCKER_PROJECT || 'granskningsverktyget-v2';
const PM2_NAME = 'granskningsverktyget-test-server';

const args = process.argv.slice(2);
const dry_run = args.includes('--dry-run');
const confirmed = args.includes('--confirm');
const skip_media = args.includes('--skip-media');
const skip_backup = args.includes('--skip-backup');

function log_step(msg) {
    console.log(`[seed:test-server] ${msg}`);
}

async function main() {
    if (!confirmed && !dry_run) {
        console.error('[seed:test-server] Avbruten. Lägg till --confirm för att skriva över testserverns data, eller --dry-run.');
        process.exit(1);
    }

    if (!confirmed && dry_run) {
        log_step('Torrkörning – inga ändringar görs.');
    }

    const tmpDir = join(projectRoot, '.tmp-seed-test-server');
    if (!dry_run) {
        mkdirSync(tmpDir, { recursive: true });
    }
    const dumpLocal = join(tmpDir, 'local_seed.dump');
    const remoteDump = `${remotePath}/backups/db/local_seed_${Date.now()}.dump`;

    log_step(`Källa: lokal Docker ${LOCAL_DB_CONTAINER} / ${LOCAL_DB_NAME}`);
    log_step(`Mål: ${host}:${remotePath} → databas ${REMOTE_DB_NAME}`);

    if (dry_run) {
        log_step('Skulle köra pg_dump lokalt och pg_restore på testservern.');
        if (!skip_media) log_step('Skulle kopiera audit-media/');
        if (!skip_backup) log_step('Skulle kopiera backup/ (om mappen finns)');
        return;
    }

    try {
        log_step('Skapar lokal dump...');
        const dumpRes = spawnSync('docker', [
            'exec', LOCAL_DB_CONTAINER,
            'pg_dump', '-U', LOCAL_DB_USER, '-d', LOCAL_DB_NAME, '-Fc'
        ], { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 });

        if (dumpRes.status !== 0) {
            throw new Error(`pg_dump misslyckades: ${(dumpRes.stderr || '').toString()}`);
        }

        writeFileSync(dumpLocal, dumpRes.stdout);

        log_step('Laddar upp dump till servern...');
        await exec(`mkdir -p ${remotePath}/backups/db`);
        await putFile(dumpLocal, remoteDump);

        log_step(`Återställer dump till ${REMOTE_DB_NAME}...`);
        const restoreCmd = [
            `cd ${remotePath} && docker compose -p ${REMOTE_DOCKER_PROJECT} up -d postgres`,
            `docker exec ${REMOTE_DB_CONTAINER} psql -U ${REMOTE_DB_USER} -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='${REMOTE_DB_NAME}'" | grep -q 1 || docker exec ${REMOTE_DB_CONTAINER} psql -U ${REMOTE_DB_USER} -d postgres -c "CREATE DATABASE ${REMOTE_DB_NAME};"`,
            `docker exec -i ${REMOTE_DB_CONTAINER} pg_restore -U ${REMOTE_DB_USER} -d ${REMOTE_DB_NAME} --clean --if-exists -Fc < ${remoteDump}`,
            `cd ${remotePath} && npm run db:migrate`,
            `(npx pm2 restart ${PM2_NAME} 2>/dev/null || true)`
        ].join(' && ');
        await exec(restoreCmd);

        const auditMediaLocal = join(projectRoot, 'audit-media');
        if (!skip_media && existsSync(auditMediaLocal)) {
            log_step('Kopierar audit-media/...');
            await exec(`mkdir -p ${remotePath}/audit-media`);
            await putDirectory(auditMediaLocal, `${remotePath}/audit-media`);
        } else if (!skip_media) {
            log_step('Hoppar över audit-media/ (saknas lokalt).');
        }

        const backupLocal = join(projectRoot, 'backup');
        if (!skip_backup && existsSync(backupLocal)) {
            log_step('Kopierar backup/...');
            await exec(`mkdir -p ${remotePath}/backup`);
            await putDirectory(backupLocal, `${remotePath}/backup`);
        } else if (!skip_backup) {
            log_step('Hoppar över backup/ (saknas lokalt).');
        }

        log_step('Klart! Testserverns data är uppdaterad från lokal miljö.');
        log_step('Kör deploy:test-server om kod också ska uppdateras.');
    } finally {
        try {
            if (existsSync(dumpLocal)) unlinkSync(dumpLocal);
        } catch (_) { /* ignoreras */ }
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[seed:test-server] Fel:', err?.message || err);
    process.exit(1);
});
