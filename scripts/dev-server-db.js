#!/usr/bin/env node
/**
 * Startar Leffe mot serverns databas (via SSH-tunnel).
 * Oberoende av npm run dev – egna portar: API 3001, Vite 5174, DB-tunnel 5433.
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
        env: {
            ...process.env,
            ...extra_env
        }
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
        log('SERVERDB', 'Tunneln avslutades oväntat – startar om om 2 s…');
        setTimeout(spawn_tunnel, 2000);
    });
    return child;
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

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

log('SERVERDB', 'Startar instans mot serverns databas…');
log('SERVERDB', `Frontend: http://localhost:${CLIENT_PORT}/v2/`);

spawn_tunnel();
spawn_child('BUILDINFO', 'node', ['scripts/dev-build-info-watcher.js']);

const wait_tunnel = spawn('npx', [
    'wait-on',
    `tcp:127.0.0.1:${TUNNEL_PORT}`,
    '--timeout',
    '120000'
], { stdio: 'inherit', shell: true });

wait_tunnel.on('close', (code) => {
    if (code !== 0) {
        console.error('[SERVERDB] Tunneln blev inte redo inom timeout.');
        shutdown();
        return;
    }

    log('SERVERDB', 'Startar backend…');
    spawn_child('API', 'npx', ['nodemon'], {
        DATABASE_URL,
        API_PORT,
        ALLOWED_ORIGINS: `http://localhost:${CLIENT_PORT}`
    });

    const wait_api = spawn('npx', [
        'wait-on',
        `tcp:127.0.0.1:${API_PORT}`,
        '--timeout',
        '60000'
    ], { stdio: 'inherit', shell: true });

    wait_api.on('close', (api_code) => {
        if (api_code !== 0) {
            console.error('[SERVERDB] Backend blev inte redo inom timeout.');
            shutdown();
            return;
        }

        log('SERVERDB', 'Startar Vite…');
        spawn_child('APP', 'npx', ['vite', '--port', CLIENT_PORT, '--strictPort'], {
            DEV_API_PORT: API_PORT,
            DEV_CLIENT_PORT: CLIENT_PORT,
            VITE_LOCAL_SERVERDB: '1'
        });
    });
});
