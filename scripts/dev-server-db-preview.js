#!/usr/bin/env node
/**
 * Som dev:serverdb men med byggd frontend (vite preview) – närmare produktionsserverns bundle.
 * Tunnel + backend 3001 + prod-DB; preview på port 5174.
 */
import 'dotenv/config';
import { spawn } from 'node:child_process';

const API_PORT = process.env.GV_SERVERDB_API_PORT || '3001';
const CLIENT_PORT = process.env.GV_SERVERDB_CLIENT_PORT || '5174';
const TUNNEL_PORT = process.env.GV_DB_TUNNEL_LOCAL_PORT || '5433';
const DB_NAME = process.env.GV_DB_NAME || 'granskningsverktyget';
const DB_USER = process.env.GV_DB_USER || 'granskning';
const DB_PASSWORD = process.env.GV_DB_PASSWORD || 'granskning';
const DATABASE_URL = `postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${TUNNEL_PORT}/${DB_NAME}`;

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let shutting_down = false;

function log(label, msg) {
    console.info(`[${label}] ${msg}`);
}

function spawn_child(label, command, args, extra_env = {}) {
    const child = spawn(command, args, {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, ...extra_env }
    });
    child.on('error', (err) => {
        console.warn(`[${label}] Kunde inte startas:`, err.message);
    });
    children.push(child);
    return child;
}

function spawn_tunnel() {
    const child = spawn_child('TUNNEL', 'node', ['scripts/db-tunnel.js']);
    child.on('exit', (code) => {
        if (shutting_down || code === 0) return;
        log('PREVIEW', 'Tunneln avslutades oväntat – startar om om 2 s…');
        setTimeout(spawn_tunnel, 2000);
    });
}

function shutdown() {
    shutting_down = true;
    for (const child of children) {
        try {
            child.kill('SIGTERM');
        } catch (_) {
            /* ignoreras */
        }
    }
    process.exit(0);
}

function wait_for_port(port, timeout_ms) {
    return new Promise((resolve, reject) => {
        const wait = spawn('npx', [
            'wait-on',
            `tcp:127.0.0.1:${port}`,
            '--timeout',
            String(timeout_ms)
        ], { stdio: 'inherit', shell: true });
        wait.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Port ${port} blev inte redo`));
        });
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
    log('PREVIEW', 'Bygger frontend…');
    const build = spawn('npm', ['run', 'build'], {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, VITE_LOCAL_SERVERDB: '1' }
    });
    await new Promise((resolve, reject) => {
        build.on('close', (code) => (code === 0 ? resolve() : reject(new Error('build misslyckades'))));
    });

    log('PREVIEW', `Startar mot prod-DB – http://localhost:${CLIENT_PORT}/v2/`);
    spawn_tunnel();

    try {
        await wait_for_port(TUNNEL_PORT, 120000);
    } catch (err) {
        console.error('[PREVIEW]', err.message);
        shutdown();
        return;
    }

    spawn_child('API', 'npx', ['tsx', 'server/index.js'], {
        DATABASE_URL,
        API_PORT,
        ALLOWED_ORIGINS: `http://localhost:${CLIENT_PORT}`
    });

    try {
        await wait_for_port(API_PORT, 60000);
    } catch (err) {
        console.error('[PREVIEW]', err.message);
        shutdown();
        return;
    }

    spawn_child('APP', 'npx', [
        'vite', 'preview',
        '--port', CLIENT_PORT,
        '--strictPort'
    ], {
        DEV_API_PORT: API_PORT,
        DEV_CLIENT_PORT: CLIENT_PORT,
        VITE_LOCAL_SERVERDB: '1'
    });
}

main().catch((err) => {
    console.error('[PREVIEW] Fel:', err?.message || err);
    shutdown();
});
