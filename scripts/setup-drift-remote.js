#!/usr/bin/env node
/**
 * Full drift-setup på servern: boot (PM2 + systemd), cron-backup, verifiering.
 *
 * Användning: npm run setup:drift
 */
import { spawn } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { exec, disconnect, remotePath, username } from './deploy-utils.js';

const projectRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function run_node_script(relative_path) {
    return new Promise((resolve, reject) => {
        const script = join(projectRoot, relative_path);
        const child = spawn(process.execPath, [script], {
            stdio: 'inherit',
            cwd: projectRoot,
            env: process.env
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${relative_path} avslutades med kod ${code}`));
        });
    });
}

async function verify_drift() {
    const bootUser = username || process.env.DEPLOY_USER || '$(whoami)';
    const checks = [
        `systemctl is-enabled pm2-${bootUser}.service 2>/dev/null || echo pm2-not-enabled`,
        'systemctl is-enabled nginx 2>/dev/null || echo nginx-unknown',
        'systemctl is-enabled docker 2>/dev/null || echo docker-unknown',
        'crontab -l 2>/dev/null | grep health-check-and-restart.sh || npx pm2 describe granskningsverktyget-drift-backup 2>/dev/null | grep -q online && echo drift-backup-pm2-ok || echo drift-backup-missing',
        'docker ps --filter name=granskningsverktyget-db --format "{{.Names}} {{.Status}}" 2>/dev/null || true',
        `test -f ${remotePath}/logs/watchdog.heartbeat && echo watchdog-heartbeat-ok || echo watchdog-heartbeat-missing`,
        'curl -fsS --connect-timeout 5 http://127.0.0.1:3000/api/health && echo v2-health-ok || echo v2-health-fail',
        'curl -fsS --connect-timeout 5 http://127.0.0.1:3001/api/health && echo test-server-health-ok || echo test-server-health-fail',
        'npx pm2 list 2>/dev/null || true'
    ].join('; echo "---"; ');
    console.info('\n[setup:drift] Verifierar drift...\n');
    await exec(checks, { cwd: false });
}

async function main() {
    try {
        console.info('[setup:drift] Steg 1/3 – boot (Postgres, PM2, systemd)...\n');
        await run_node_script('scripts/remote-setup-v2-boot.js');

        console.info('\n[setup:drift] Steg 2/3 – cron-backup (var 5:e minut)...\n');
        await run_node_script('scripts/deploy-setup-cron.js');

        console.info('\n[setup:drift] Steg 3/3 – verifiering...\n');
        await verify_drift();

        console.info('\n[setup:drift] Klart.');
        console.info('[setup:drift] Lager: PM2 autorestart | watchdog 45s | cron 5 min | boot vid omstart.');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[setup:drift] Fel:', err.message);
    process.exit(1);
});
