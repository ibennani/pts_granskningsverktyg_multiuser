#!/usr/bin/env node
import { spawn } from 'child_process';

let started = false;

function startApp() {
    if (started) return;
    started = true;

    console.log('[DOCKER] Startar Backend (nodemon)...');
    const backend = spawn('npx', ['nodemon'], {
        stdio: 'inherit',
        shell: true
    });

    backend.on('error', (err) => {
        console.warn('[DOCKER] Backend kunde inte startas:', err.message);
    });

    // Vänta på att backend (port 3000) är uppe
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

// Tvingar projektnamn 'sessionversion' och väntar på hälsa
const dockerCmd = 'docker compose -p sessionversion up -d --wait';

console.log('[DOCKER] Initierar containrar (sessionversion)...');

const docker = spawn(dockerCmd, [], {
    stdio: 'inherit',
    shell: true
});

docker.on('error', (err) => {
    console.warn('[DOCKER] Fel vid start av Docker:', err.message);
    startApp();
});

docker.on('close', (code) => {
    if (code === 0) {
        console.log('[DOCKER] Docker-containrar är redo.');
        // Vänta på Postgres port 5432
        const waitDb = spawn('npx', ['wait-on', 'tcp:localhost:5432', '--timeout', '6000'], {
            stdio: 'pipe',
            shell: true
        });
        waitDb.on('close', () => startApp());
    } else {
        console.warn('[DOCKER] Docker startade med felkod, försöker starta appen ändå...');
        startApp();
    }
});