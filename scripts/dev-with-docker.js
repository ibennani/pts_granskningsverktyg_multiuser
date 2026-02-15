#!/usr/bin/env node
// Startar Docker/Postgres om möjligt, sedan backend + Vite. Fungerar även utan Docker.
import { spawn } from 'child_process';

let started = false;

function startApp() {
    if (started) return;
    started = true;

    const backend = spawn('npx', ['nodemon'], {
        stdio: 'inherit',
        shell: true
    });
    backend.on('error', (err) => {
        console.warn('[dev] Backend kunde inte startas:', err.message);
    });

    const wait = spawn('npx', ['wait-on', 'tcp:localhost:3000', '--timeout', '8000'], {
        stdio: 'pipe',
        shell: true
    });
    wait.on('close', (code) => {
        if (code !== 0) {
            console.warn('[dev] Backend svarade inte i tid – startar Vite ändå.');
        }
        const vite = spawn('npx', ['vite'], {
            stdio: 'inherit',
            shell: true
        });
        vite.on('error', (err) => {
            console.error('[dev] Kunde inte starta Vite:', err.message);
            process.exit(1);
        });
    });
}

const docker = spawn('docker', ['compose', 'up', '-d', '--wait'], {
    stdio: 'inherit',
    shell: true
});

docker.on('error', () => {
    console.warn('[dev] Docker hittades inte – backend och Vite startar ändå (serverfunktioner kräver Postgres).');
    startApp();
});

docker.on('close', () => {
    const wait = spawn('npx', ['wait-on', 'tcp:localhost:5432', '--timeout', '6000'], {
        stdio: 'pipe',
        shell: true
    });
    wait.on('close', (code) => {
        if (code === 0) {
            const migrate = spawn('node', ['server/scripts/migrate.js'], {
                stdio: 'inherit',
                shell: true
            });
            migrate.on('close', () => startApp());
        } else {
            startApp();
        }
    });
});
