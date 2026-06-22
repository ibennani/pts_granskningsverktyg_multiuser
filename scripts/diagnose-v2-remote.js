#!/usr/bin/env node
/**
 * Kör felsökning på samma server som deploy:v2 (DEPLOY_HOST, DEPLOY_PATH, DEPLOY_SSH_PASSWORD m.m.).
 * Visar PM2, curl mot /api/health, Docker, SELinux och PM2-loggar.
 *
 * Användning: npm run diagnose:v2
 *
 * Använder ett enda radbrytningsfritt bash-kommando så att SSH/node-ssh inte förvränger flerraders-skript (CRLF / citattecken).
 */
import { exec, disconnect, host, remotePath } from './deploy-utils.js';

async function main() {
    try {
        console.log(`[diagnose] Ansluter till ${host} (${remotePath})...\n`);
        const rp = remotePath.replace(/'/g, "'\\''");
        const script = [
            'set +e',
            `cd '${rp}' && echo "========== PM2 ==========" && npx pm2 list 2>/dev/null`,
            'echo ""',
            'echo "========== Backend direkt (localhost:3000/api/health) =========="',
            'curl -sS --connect-timeout 10 -w " [HTTP %{http_code}]" http://127.0.0.1:3000/api/health 2>/dev/null | head -c 800',
            'echo ""',
            'echo "========== Nginx → API (via HTTPS lokalt, samma Host) =========="',
            'curl -sS -o /dev/null -w "HTTPS /v2/api/health HTTP: %{http_code} " --connect-timeout 10 -k "https://127.0.0.1/v2/api/health" -H "Host: ux-granskningsverktyg.pts.ad" 2>/dev/null || echo "(curl mot nginx misslyckades – kontrollera att nginx lyssnar på 443)"',
            'echo ""',
            'echo "========== Docker (postgres) =========="',
            'docker ps -a --filter name=granskningsverktyget-db 2>/dev/null || echo "(docker ej tillgängligt)"',
            'echo ""',
            'echo "========== SELinux (502 på API trots att Node svarar) =========="',
            'if command -v getenforce >/dev/null 2>&1; then getenforce; echo "Om Enforcing och backend svarar 200 ovan men webbläsaren får 502: kör"; echo "  sudo setsebool -P httpd_can_network_connect 1"; else echo "(inget SELinux – normalt på Debian/Ubuntu)"; fi',
            'echo ""',
            `echo "========== Senaste raderna PM2 (granskningsverktyget-v2) ==========" && cd '${rp}' && npx pm2 logs granskningsverktyget-v2 --lines 35 --nostream 2>/dev/null`,
            'echo ""',
            'echo "========== Klart =========="'
        ].join('; ');
        await exec(script, { cwd: false });
        console.log('\n[diagnose] Om HTTP-kod mot localhost:3000 inte är 200: kontrollera .env (DATABASE_URL), att Postgres körs och PM2-loggar ovan.');
        console.log('[diagnose] Om localhost är 200 men HTTPS /v2/api/health inte: kontrollera nginx-config och SELinux.');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[diagnose] Fel:', err.message);
    process.exit(1);
});
