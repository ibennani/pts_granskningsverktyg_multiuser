#!/usr/bin/env node
/**
 * Startar PM2-processerna granskningsverktyget-v2 (backend) och granskningsverktyget-watchdog
 * på samma server som deploy:v2 / diagnose:v2.
 *
 * Miljö: samma som deploy-utils (DEPLOY_HOST, DEPLOY_PATH, DEPLOY_USER, DEPLOY_SSH_PASSWORD vid behov).
 *
 * Användning: npm run start:v2:remote
 */
import { exec, disconnect } from './deploy-utils.js';

async function main() {
    try {
        console.log('[start:v2] Startar PM2 på servern (backend + watchdog)...\n');
        const pm2_block = [
            '(npx pm2 delete granskningsverktyget-v2 2>/dev/null || true)',
            'npx pm2 start npm --name granskningsverktyget-v2 -- run dev:server',
            '(npx pm2 restart granskningsverktyget-watchdog 2>/dev/null || npx pm2 start scripts/healthcheck-watchdog.js --name granskningsverktyget-watchdog)',
            'npx pm2 save 2>/dev/null || true'
        ].join(' && ');
        await exec(pm2_block);

        console.log('\n[start:v2] Väntar på /api/health (localhost:3000)...\n');
        await exec(
            'for _ in 1 2 3 4 5 6 7 8 9 10; do if curl -fsS --connect-timeout 5 http://127.0.0.1:3000/api/health -o /dev/null; then echo "[start:v2] Backend svarar HTTP 200."; exit 0; fi; sleep 3; done; echo "[start:v2] FEL: Backend svarade inte 200 inom timeout."; exit 1',
            { cwd: false }
        );

        console.log('\n[start:v2] Kontrollerar HTTPS /v2/api/health (nginx)...\n');
        await exec(
            'hc=$(curl -sS -o /dev/null -w \'%{http_code}\' --connect-timeout 10 -k "https://127.0.0.1/v2/api/health" -H "Host: ux-granskningsverktyg.pts.ad" 2>/dev/null || echo 000); echo "[start:v2] HTTPS /v2/api/health: HTTP ${hc}"; if [ "$hc" != "200" ]; then echo "[start:v2] Om ovan var 200 men HTTPS inte: SELinux – kör: sudo setsebool -P httpd_can_network_connect 1"; fi; exit 0',
            { cwd: false }
        );

        console.log('\n[start:v2] Klart.');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[start:v2] Fel:', err.message);
    process.exit(1);
});
