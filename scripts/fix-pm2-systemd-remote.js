#!/usr/bin/env node
/**
 * Åtgärdar pm2-<användare>.service vid serverboot:
 * - /usr/lib/node_modules/pm2 är ofta 0750 (root only) → deploy-användaren får EXEC 203 Permission denied
 * - Ökar TimeoutStartSec så resurrect hinner starta alla processer
 *
 * Kör INTE systemctl restart (stör pågående drift). Säker att köra när backend redan kör.
 *
 * Användning: node scripts/fix-pm2-systemd-remote.js
 */
import { exec, exec_sudo, disconnect, username } from './deploy-utils.js';

async function main() {
    const boot_user = username || process.env.DEPLOY_USER || 'localiliben';
    const svc = `pm2-${boot_user}.service`;
    const unit_path = `/etc/systemd/system/${svc}`;
    const pm2_global_dir = '/usr/lib/node_modules/pm2';

    try {
        console.info(`[fix-pm2-systemd] Öppnar läsrättigheter för ${pm2_global_dir}...`);
        await exec_sudo(`chmod -R a+rx ${pm2_global_dir}`, { cwd: false });

        console.info(`[fix-pm2-systemd] Säkerställer TimeoutStartSec i ${svc}...`);
        await exec_sudo(
            `grep -q '^TimeoutStartSec=' ${unit_path} || sed -i '/^\\[Service\\]/a TimeoutStartSec=180' ${unit_path}`,
            { cwd: false }
        );
        await exec_sudo('systemctl daemon-reload', { cwd: false });

        await exec(
            [
                `test -x ${pm2_global_dir}/bin/pm2 && echo pm2-bin-executable-ok || echo pm2-bin-still-blocked`,
                `stat -c '%a %n' ${pm2_global_dir} 2>/dev/null || true`,
                `systemctl is-enabled ${svc} 2>/dev/null || true`,
                'curl -fsS --connect-timeout 5 http://127.0.0.1:3000/api/health && echo v2-health-ok || echo v2-health-fail',
                'curl -fsS --connect-timeout 5 http://127.0.0.1:3001/api/health && echo test-server-health-ok || echo test-server-health-fail'
            ].join('; echo "---"; '),
            { cwd: false }
        );

        console.info('\n[fix-pm2-systemd] Klart. Vid nästa omstart ska pm2 resurrect kunna köras utan Permission denied.');
        console.info('[fix-pm2-systemd] Backend lämnades orörd (ingen systemctl restart).');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[fix-pm2-systemd] Fel:', err.message);
    process.exit(1);
});
