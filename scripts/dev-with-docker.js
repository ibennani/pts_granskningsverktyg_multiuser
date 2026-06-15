#!/usr/bin/env node
/**
 * @file Startar Docker-tjänster för lokal utveckling och därefter backend.
 * Hanterar befintlig Ollama-container (ollama-final) utan namnkonflikt.
 */

import { spawn, spawnSync } from 'child_process';

const COMPOSE_PROJECT = 'sessionversion';
const COMPOSE_NETWORK = `${COMPOSE_PROJECT}_private-net`;
const LEGACY_OLLAMA_CONTAINER = 'ollama-final';

let started = false;

function run_quiet(command, args = []) {
    return spawnSync(command, args, { encoding: 'utf8', shell: false });
}

function container_exists(name) {
    const result = run_quiet('docker', ['inspect', '-f', '{{.Id}}', name]);
    return result.status === 0 && Boolean(result.stdout?.trim());
}

function ensure_legacy_ollama() {
    if (!container_exists(LEGACY_OLLAMA_CONTAINER)) {
        return false;
    }
    console.info(`[DOCKER] Hittade befintlig Ollama (${LEGACY_OLLAMA_CONTAINER}), använder den.`);
    run_quiet('docker', ['start', LEGACY_OLLAMA_CONTAINER]);
    const connect = run_quiet('docker', ['network', 'connect', COMPOSE_NETWORK, LEGACY_OLLAMA_CONTAINER]);
    if (connect.status !== 0 && !String(connect.stderr || '').includes('already exists')) {
        console.warn('[DOCKER] Kunde inte koppla Ollama till Docker-nätverket:', connect.stderr?.trim() || connect.stdout?.trim());
    }
    return true;
}

function startApp() {
    if (started) return;
    started = true;

    console.info('[DOCKER] Startar Backend (nodemon)...');
    const backend = spawn('npx', ['nodemon'], {
        stdio: 'inherit',
        shell: true
    });

    backend.on('error', (err) => {
        console.warn('[DOCKER] Backend kunde inte startas:', err.message);
    });

    const wait = spawn('npx', ['wait-on', 'tcp:localhost:3000', '--timeout', '8000'], {
        stdio: 'pipe',
        shell: true
    });

    wait.on('close', (code) => {
        if (code !== 0) {
            console.warn('[DOCKER] Backend svarade inte inom 8s – Appen fortsätter ändå.');
        }
    });
}

function waitForServices(onReady) {
    const waitDb = spawn('npx', ['wait-on', 'tcp:localhost:5432', '--timeout', '6000'], {
        stdio: 'pipe',
        shell: true
    });
    const waitOllama = spawn('npx', ['wait-on', 'tcp:localhost:11434', '--timeout', '15000'], {
        stdio: 'pipe',
        shell: true
    });
    let db_done = false;
    let ollama_done = false;
    const maybe_start = () => {
        if (db_done && ollama_done) onReady();
    };
    waitDb.on('close', () => {
        db_done = true;
        maybe_start();
    });
    waitOllama.on('close', (code) => {
        if (code !== 0) {
            console.warn('[DOCKER] Ollama svarar inte på port 11434 ännu – backend startar ändå.');
        }
        ollama_done = true;
        maybe_start();
    });
}

function run_compose_up() {
    const has_legacy_ollama = ensure_legacy_ollama();
    const services = has_legacy_ollama ? 'postgres open-webui' : '';
    const docker_cmd = services
        ? `docker compose -p ${COMPOSE_PROJECT} up -d --wait ${services}`
        : `docker compose -p ${COMPOSE_PROJECT} up -d --wait`;

    console.info('[DOCKER] Initierar containrar (sessionversion)...');
    const docker = spawn(docker_cmd, [], {
        stdio: 'inherit',
        shell: true
    });

    docker.on('error', (err) => {
        console.warn('[DOCKER] Fel vid start av Docker:', err.message);
        startApp();
    });

    docker.on('close', (code) => {
        if (code === 0) {
            console.info('[DOCKER] Docker-containrar är redo.');
            waitForServices(() => startApp());
        } else {
            console.warn('[DOCKER] Docker startade med felkod, försöker starta appen ändå...');
            startApp();
        }
    });
}

run_compose_up();
