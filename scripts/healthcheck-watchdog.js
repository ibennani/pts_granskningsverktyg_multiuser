#!/usr/bin/env node
/**
 * Watchdog som kontrollerar backend var minut.
 * Om /api/health inte svarar 200 – startar om PM2.
 * Körs med PM2: npx pm2 start scripts/healthcheck-watchdog.js --name granskningsverktyget-watchdog
 */
const INTERVAL_MS = 60 * 1000;
const HEALTH_URL = 'http://localhost:3000/api/health';
const APP_NAME = 'granskningsverktyget-v2';

async function check() {
    try {
        const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(5000) });
        if (res.ok) return;
    } catch (_) {}
    const ts = new Date().toISOString();
    console.log(`[watchdog] ${ts} Backend svarar inte – startar om ${APP_NAME}`);
    const { execSync } = await import('child_process');
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
