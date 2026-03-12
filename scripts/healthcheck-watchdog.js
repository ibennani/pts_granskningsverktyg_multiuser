#!/usr/bin/env node
/**
 * Watchdog som kontrollerar backend var minut.
 * Om /api/health inte svarar 200 – startar om PM2.
 * Körs med PM2: npx pm2 start scripts/healthcheck-watchdog.js --name granskningsverktyget-watchdog
 */
import { execSync } from 'child_process';

const INTERVAL_MS = 60 * 1000;
const HEALTH_URL = 'http://localhost:3000/api/health';
const APP_NAME = 'granskningsverktyget-v2';
const PROJECT_DIR = process.env.GV_SERVER_DIR || '/var/www/granskningsverktyget-v2';
const DOCKER_PROJECT = process.env.GV_DOCKER_PROJECT || 'granskningsverktyget-v2';
const DB_CONTAINER = process.env.GV_DB_CONTAINER || 'granskningsverktyget-db';

function safe_exec(cmd) {
    try {
        return execSync(cmd, { stdio: 'pipe', shell: true }).toString('utf8');
    } catch (e) {
        return null;
    }
}

function ensure_postgres_running() {
    // 1) Snabbkoll: finns container och svarar pg_isready?
    const ready = safe_exec(`docker exec ${DB_CONTAINER} pg_isready -U granskning 2>/dev/null`);
    if (ready && ready.toLowerCase().includes('accepting connections')) return { ok: true, reason: 'pg_isready' };

    // 2) Försök starta enbart Postgres med fast projektname (för rätt volym).
    // Vi undviker att starta andra services (ollama/open-webui).
    const start_cmd = `cd ${PROJECT_DIR} && docker compose -p ${DOCKER_PROJECT} up -d postgres`;
    safe_exec(start_cmd);

    // 3) Vänta upp till ~10s på att DB blir redo.
    for (let i = 0; i < 10; i += 1) {
        const r = safe_exec(`docker exec ${DB_CONTAINER} pg_isready -U granskning 2>/dev/null`);
        if (r && r.toLowerCase().includes('accepting connections')) return { ok: true, reason: 'started' };
        safe_exec('sleep 1');
    }

    const ps = safe_exec('docker ps -a --format "table {{.Names}}\\t{{.Status}}"') || '';
    return { ok: false, reason: 'not_ready', ps };
}

async function check() {
    try {
        const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(5000) });
        if (res.ok) return;
    } catch (_) {}
    const ts = new Date().toISOString();
    const db = ensure_postgres_running();
    if (!db.ok) {
        console.log(`[watchdog] ${ts} Postgres verkar nere (${db.reason}) – försökte starta. docker ps:\n${db.ps || '(ingen output)'}`);
    }
    console.log(`[watchdog] ${ts} Backend svarar inte – startar om ${APP_NAME}`);
    try {
        execSync(`npx pm2 restart ${APP_NAME}`, { stdio: 'inherit' });
    } catch (e) {
        console.error('[watchdog] PM2 restart misslyckades:', e.message);
    }
}

async function loop() {
    while (true) {
        await check();
        await new Promise(r => setTimeout(r, INTERVAL_MS));
    }
}

loop().catch(e => {
    console.error('[watchdog] Fel:', e);
    process.exit(1);
});
