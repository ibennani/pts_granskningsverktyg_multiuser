#!/usr/bin/env node
/**
 * Backup-drift utan cron: kör health-check-and-restart.sh var 5:e minut.
 * PM2 startar om denna process vid krasch (ersätter crontab där det är spärrat).
 */
import { execSync } from 'child_process';
import { join } from 'path';

const V2_DIR = process.env.GV_SERVER_DIR || '/var/www/granskningsverktyget-v2';
const INTERVAL_MS = 5 * 60 * 1000;
const SCRIPT = join(V2_DIR, 'scripts', 'health-check-and-restart.sh');
const PM2_NAME = 'granskningsverktyget-drift-backup';

async function run_check() {
    try {
        execSync(`bash ${JSON.stringify(SCRIPT)}`, { stdio: 'inherit', shell: true });
    } catch (e) {
        console.error(`[${PM2_NAME}] health-check avslutades med fel:`, e.message);
    }
}

async function loop() {
    while (true) {
        await run_check();
        await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
}

loop().catch((e) => {
    console.error(`[${PM2_NAME}] Fel:`, e);
    process.exit(1);
});
