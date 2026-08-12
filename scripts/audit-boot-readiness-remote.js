#!/usr/bin/env node
/**
 * Granskar om Leffe startar automatiskt vid serveromstart (v2 + test-server).
 */
import { exec, exec_sudo, disconnect, username } from './deploy-utils.js';

async function main() {
    const boot_user = username || 'localiliben';
    const svc = `pm2-${boot_user}.service`;

    try {
        console.info('[boot-audit] === Boot-konfiguration ===\n');
        await exec(
            [
                'uptime',
                `systemctl is-enabled ${svc} 2>&1 || true`,
                `systemctl is-active ${svc} 2>&1 || true`,
                'systemctl is-enabled nginx 2>/dev/null || echo nginx-unknown',
                'systemctl is-enabled docker 2>/dev/null || echo docker-unknown',
                'systemctl is-active nginx 2>/dev/null || true',
                'systemctl is-active docker 2>/dev/null || true',
                'test -x /usr/lib/node_modules/pm2/bin/pm2 && echo pm2-bin-ok || echo pm2-bin-blocked',
                'stat -c "%a" /usr/lib/node_modules/pm2 2>/dev/null || echo pm2-stat-fail',
                'grep -E "^(ExecStart|TimeoutStartSec)=" /etc/systemd/system/' + svc + ' 2>/dev/null || echo unit-not-readable',
                'test -f /home/' + boot_user + '/.pm2/dump.pm2 && echo dump-exists || echo dump-missing',
                'docker ps --filter name=granskningsverktyget-db --format "{{.Names}} {{.Status}}" 2>/dev/null || true',
                'curl -fsS --connect-timeout 5 http://127.0.0.1:3000/api/health && echo v2-ok || echo v2-fail',
                'curl -fsS --connect-timeout 5 http://127.0.0.1:3001/api/health && echo test-ok || echo test-fail',
                'npx pm2 list 2>/dev/null || true',
                'crontab -l 2>/dev/null | grep health-check-and-restart || echo no-health-cron',
                'npx pm2 describe granskningsverktyget-watchdog 2>/dev/null | grep -E "status|uptime" | head -3 || echo watchdog-missing',
                'npx pm2 describe granskningsverktyget-drift-backup 2>/dev/null | grep -E "status|uptime" | head -3 || echo drift-backup-missing'
            ].join('; echo "---"; '),
            { cwd: false }
        );

        console.info('\n[boot-audit] === Senaste pm2-systemd vid boot (journal) ===\n');
        await exec_sudo(
            `journalctl -u ${svc} -b --no-pager 2>&1 | tail -15`,
            { cwd: false }
        );
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[boot-audit] Fel:', err.message);
    process.exit(1);
});
