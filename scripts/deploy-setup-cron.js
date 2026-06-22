#!/usr/bin/env node
/**
 * Sätter upp cron som backup – health-check-and-restart.sh körs var 5:e minut.
 * Primär health-check sker via watchdog (var minut) som startas automatiskt vid deploy.
 * Kör detta för extra säkerhet om både app och watchdog skulle krascha: npm run deploy:setup-cron
 */
import { exec, disconnect, remotePath, sshPassword } from './deploy-utils.js';
import { run, host } from './deploy-utils.js';

async function main() {
    try {
        const scriptPath = `${remotePath}/scripts/health-check-and-restart.sh`;
        const logPath = `${remotePath}/logs/healthcheck.log`;
        const cronLine = `*/5 * * * * mkdir -p ${remotePath}/logs && ${scriptPath} >> ${logPath} 2>&1`;

        const cmd = `(crontab -l 2>/dev/null | grep -v health-check-and-restart.sh | grep -v '^$'; echo '${cronLine}') | crontab -`;
        if (sshPassword) {
            await exec(cmd, { cwd: false });
        } else {
            await run('ssh', [host, cmd]);
        }
        console.log('[setup-cron] Cron konfigurerad som backup (var 5:e minut). Primär: watchdog var minut.');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[setup-cron] Fel:', err.message);
    process.exit(1);
});
