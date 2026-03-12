#!/usr/bin/env node
/**
 * Diagnostik för 500-felet på servern.
 * Kör: npm run deploy:debug
 * Automatisk inloggning: DEPLOY_SSH_PASSWORD i .env (fungerar på Windows).
 */
import { run, exec, disconnect, host, remotePath, sshPassword } from './deploy-utils.js';

async function main() {
    try {
        console.log('[debug] Kör diagnostik på servern...\n');

        const cmds = [
            'echo "=== PM2 status ===" && (npx pm2 list 2>/dev/null || pm2 list 2>/dev/null || echo "PM2 ej installerat")',
            'echo "" && echo "=== PM2 loggar (sista 30 rader) ===" && (npx pm2 logs granskningsverktyget-v2 --lines 30 --nostream 2>/dev/null || pm2 logs granskningsverktyget-v2 --lines 30 --nostream 2>/dev/null || echo "Inga loggar")',
            'echo "" && echo "=== Backend health (localhost) ===" && curl -s http://localhost:3000/api/health || echo "Backend svarar inte"',
            'echo "" && echo "=== Debug-status ===" && curl -s http://localhost:3000/api/debug-status 2>/dev/null || echo "Debug-endpoint ej tillgänglig"',
            'echo "" && echo "=== .env finns? ===" && (test -f .env && echo "Ja" && head -1 .env | sed "s/:.*/:***/" || echo "Nej")',
            'echo "" && echo "=== Docker Postgres (projekt: granskningsverktyget-v2) ===" && (cd ' + remotePath + ' && docker compose -p granskningsverktyget-v2 ps 2>/dev/null || true) && (docker ps 2>/dev/null | grep -E "postgres|granskningsverktyget" || echo "Postgres-container ej synlig")'
        ];

        if (sshPassword) {
            await exec(cmds.join(' && '));
        } else {
            await run('ssh', [host, `cd ${remotePath} && ${cmds.join(' && ')}`]);
        }

        console.log('\n[debug] Klart. Om backend svarar 503 eller "Databas ej tillgänglig" – starta Postgres med rätt data: cd ' + remotePath + ' && docker compose -p granskningsverktyget-v2 up -d postgres');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[debug] Fel:', err.message);
    process.exit(1);
});
