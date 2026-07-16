#!/usr/bin/env node
/**
 * Watchdog som kontrollerar v2- och test-server-backend var 45:e sekund.
 * Skriver heartbeat-fil som cron kan läsa om watchdog hänger.
 */
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const INTERVAL_MS = 45 * 1000;
const V2_DIR = process.env.GV_SERVER_DIR || '/var/www/granskningsverktyget-v2';
const TEST_SERVER_DIR = process.env.GV_TEST_SERVER_DIR || '/var/www/granskningsverktyget-test-server';
const DOCKER_PROJECT = process.env.GV_DOCKER_PROJECT || 'granskningsverktyget-v2';
const DB_CONTAINER = process.env.GV_DB_CONTAINER || 'granskningsverktyget-db';
const HEARTBEAT_PATH = join(V2_DIR, 'logs', 'watchdog.heartbeat');
const BACKEND_PM2_OPTS = '--max-memory-restart 600M --exp-backoff-restart-delay 200';

const BACKENDS = [
    {
        label: 'v2',
        health_url: 'http://localhost:3000/api/health',
        app_name: 'granskningsverktyget-v2',
        project_dir: V2_DIR
    },
    {
        label: 'test-server',
        health_url: 'http://localhost:3001/api/health',
        app_name: 'granskningsverktyget-test-server',
        project_dir: TEST_SERVER_DIR
    }
];

function safe_exec(cmd) {
    try {
        return execSync(cmd, { stdio: 'pipe', shell: true }).toString('utf8');
    } catch (_e) {
        return null;
    }
}

function write_heartbeat() {
    try {
        mkdirSync(join(V2_DIR, 'logs'), { recursive: true });
        writeFileSync(HEARTBEAT_PATH, `${new Date().toISOString()}\n`, 'utf8');
    } catch (e) {
        console.error('[watchdog] Kunde inte skriva heartbeat:', e.message);
    }
}

function ensure_postgres_running() {
    const ready = safe_exec(`docker exec ${DB_CONTAINER} pg_isready -U granskning 2>/dev/null`);
    if (ready && ready.toLowerCase().includes('accepting connections')) {
        return { ok: true, reason: 'pg_isready' };
    }

    safe_exec(`cd ${V2_DIR} && docker compose -p ${DOCKER_PROJECT} up -d postgres`);

    for (let i = 0; i < 10; i += 1) {
        const r = safe_exec(`docker exec ${DB_CONTAINER} pg_isready -U granskning 2>/dev/null`);
        if (r && r.toLowerCase().includes('accepting connections')) {
            return { ok: true, reason: 'started' };
        }
        safe_exec('sleep 1');
    }

    const ps = safe_exec('docker ps -a --format "table {{.Names}}\\t{{.Status}}"') || '';
    return { ok: false, reason: 'not_ready', ps };
}

async function is_healthy(health_url) {
    try {
        const res = await fetch(health_url, { signal: AbortSignal.timeout(5000) });
        return res.ok;
    } catch (_e) {
        return false;
    }
}

function restart_backend(backend) {
    const restarted = safe_exec(`npx pm2 restart ${backend.app_name}`);
    if (restarted !== null) {
        return;
    }
    safe_exec(`npx pm2 delete ${backend.app_name} 2>/dev/null || true`);
    safe_exec(
        `npx pm2 start npm --name ${backend.app_name} --cwd ${backend.project_dir} ${BACKEND_PM2_OPTS} -- run dev:server`
    );
}

async function check_backend(backend, postgres_checked) {
    if (await is_healthy(backend.health_url)) {
        return postgres_checked;
    }

    const ts = new Date().toISOString();
    let checked = postgres_checked;
    if (!checked) {
        const db = ensure_postgres_running();
        checked = true;
        if (!db.ok) {
            console.log(
                `[watchdog] ${ts} Postgres verkar nere (${db.reason}) – försökte starta. docker ps:\n${db.ps || '(ingen output)'}`
            );
        }
    }

    console.log(`[watchdog] ${ts} ${backend.label} svarar inte – startar om ${backend.app_name}`);
    try {
        restart_backend(backend);
        safe_exec('npx pm2 save 2>/dev/null || true');
    } catch (e) {
        console.error(`[watchdog] PM2 restart misslyckades för ${backend.app_name}:`, e.message);
    }
    return checked;
}

async function check_all() {
    let postgres_checked = false;
    for (const backend of BACKENDS) {
        postgres_checked = await check_backend(backend, postgres_checked);
    }
    write_heartbeat();
}

async function loop() {
    while (true) {
        await check_all();
        await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
}

loop().catch((e) => {
    console.error('[watchdog] Fel:', e);
    process.exit(1);
});
