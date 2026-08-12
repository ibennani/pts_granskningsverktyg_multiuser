#!/usr/bin/env node
/**
 * Verifierar alla Leffe-tjänster efter serveromstart (v2 + test-server).
 */
import { exec, disconnect, username } from './deploy-utils.js';

const PUBLIC = {
    v2_health: 'https://ux-granskningsverktyg.pts.ad/v2/api/health',
    test_health: 'https://ux-granskningsverktyg.pts.ad/test-server/api/health',
    v2_front: 'https://ux-granskningsverktyg.pts.ad/v2/',
    test_front: 'https://ux-granskningsverktyg.pts.ad/test-server/'
};

async function public_check(label, url, expect_json = false) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
        const ok = res.ok;
        let detail = String(res.status);
        if (expect_json && ok) {
            const data = await res.json().catch(() => null);
            detail = data?.ok === true ? '200 ok:true' : `200 ok:${data?.ok}`;
        }
        console.info(`[verify] ${label}: ${detail}`);
        return ok && (!expect_json || detail.includes('ok:true'));
    } catch (err) {
        console.info(`[verify] ${label}: FEL (${err?.message || err})`);
        return false;
    }
}

async function main() {
    const boot_user = username || 'localiliben';
    const svc = `pm2-${boot_user}.service`;

    try {
        console.info('[verify] === Serverinternt (SSH) ===\n');
        await exec(
            [
                'uptime',
                `systemctl is-active ${svc} 2>&1 || true`,
                `systemctl is-active nginx 2>&1 || true`,
                `systemctl is-active docker 2>&1 || true`,
                'docker ps --filter name=granskningsverktyget-db --format "{{.Names}} {{.Status}}" 2>/dev/null || true',
                'curl -fsS --connect-timeout 5 http://127.0.0.1:3000/api/health && echo localhost-v2-ok || echo localhost-v2-fail',
                'curl -fsS --connect-timeout 5 http://127.0.0.1:3001/api/health && echo localhost-test-ok || echo localhost-test-fail',
                'curl -fsS --connect-timeout 5 -X POST -H "Content-Type: application/json" -d \'{"username":"x","password":"y"}\' http://127.0.0.1:3000/api/auth/login -w " login-v2:%{http_code}" -o /dev/null || echo login-v2-fail',
                'curl -fsS --connect-timeout 5 -X POST -H "Content-Type: application/json" -d \'{"username":"x","password":"y"}\' http://127.0.0.1:3001/api/auth/login -w " login-test:%{http_code}" -o /dev/null || echo login-test-fail',
                'npx pm2 list 2>/dev/null || true'
            ].join('; echo "---"; '),
            { cwd: false }
        );

        console.info('\n[verify] === Publikt (HTTPS) ===\n');
        const checks = await Promise.all([
            public_check('v2 /api/health', PUBLIC.v2_health, true),
            public_check('test /api/health', PUBLIC.test_health, true),
            public_check('v2 frontend', PUBLIC.v2_front, false),
            public_check('test frontend', PUBLIC.test_front, false)
        ]);

        const all_ok = checks.every(Boolean);
        console.info(`\n[verify] ${all_ok ? 'ALLT OK' : 'MINST EN KONTROLL MISSLYCKADES'}`);
        if (!all_ok) process.exit(1);
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[verify] Fel:', err.message);
    process.exit(1);
});
