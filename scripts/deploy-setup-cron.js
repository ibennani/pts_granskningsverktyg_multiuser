#!/usr/bin/env node
/**
 * Sätter upp backup-drift (var 5:e minut): cron om tillåtet, annars PM2-process.
 *
 * Användning: npm run setup:cron
 */
import { join } from 'path';
import {
    exec,
    disconnect,
    remotePath,
    putFile,
    projectRoot,
    getSshClient
} from './deploy-utils.js';

const DRIFT_BACKUP_PM2 = 'granskningsverktyget-drift-backup';

async function exec_capture(cmd, opts = {}) {
    const useCwd = opts.cwd !== false;
    const fullCmd = useCwd ? `cd ${remotePath} && ${cmd}` : cmd;
    const wrappedCmd = `bash -l -c ${JSON.stringify(fullCmd)}`;
    const client = await getSshClient();
    if (!client) {
        throw new Error('exec_capture kräver node-ssh');
    }
    const result = await client.execCommand(wrappedCmd, useCwd ? {} : { cwd: '/' });
    return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        code: result.code ?? 1
    };
}

async function upload_drift_scripts() {
    const files = [
        'pm2-leffe-common.sh',
        'health-check-and-restart.sh',
        'healthcheck-watchdog.js',
        'server-boot-leffe.sh',
        'drift-backup-loop.js'
    ];
    for (const name of files) {
        await putFile(join(projectRoot, 'scripts', name), `${remotePath}/scripts/${name}`);
    }
    const rp = remotePath.replace(/'/g, "'\\''");
    await exec(
        `perl -pi -e "s/\\r$//" '${rp}/scripts/pm2-leffe-common.sh' '${rp}/scripts/health-check-and-restart.sh' '${rp}/scripts/server-boot-leffe.sh' 2>/dev/null || true`,
        { cwd: false }
    );
    await exec(
        `chmod +x '${rp}/scripts/pm2-leffe-common.sh' '${rp}/scripts/health-check-and-restart.sh' '${rp}/scripts/server-boot-leffe.sh'`,
        { cwd: false }
    );
    await exec(`mkdir -p '${rp}/logs'`, { cwd: false });
}

async function setup_pm2_backup() {
    const rp = remotePath.replace(/'/g, "'\\''");
    await exec(
        `(npx pm2 delete ${DRIFT_BACKUP_PM2} 2>/dev/null || true) && npx pm2 start scripts/drift-backup-loop.js --name ${DRIFT_BACKUP_PM2} --cwd '${rp}' --max-memory-restart 100M && npx pm2 save 2>/dev/null || true`
    );
    console.log('[setup:cron] PM2 backup-drift aktiv (var 5:e minut).');
}

async function try_user_crontab(scriptPath, logPath) {
    const cronLine = `*/5 * * * * mkdir -p ${remotePath}/logs && ${scriptPath} >> ${logPath} 2>&1`;
    const cmd = `(crontab -l 2>/dev/null | grep -v health-check-and-restart.sh | grep -v '^$'; echo '${cronLine}') | crontab -`;
    const result = await exec_capture(cmd, { cwd: false });
    if (result.code !== 0) {
        return { ok: false, reason: result.stderr.trim() || `exit ${result.code}` };
    }
    return { ok: true };
}

async function main() {
    try {
        console.log('[setup:cron] Laddar upp drift-skript...');
        await upload_drift_scripts();

        const scriptPath = `${remotePath}/scripts/health-check-and-restart.sh`;
        const logPath = `${remotePath}/logs/healthcheck.log`;

        const cron = await try_user_crontab(scriptPath, logPath);
        if (cron.ok) {
            console.log('[setup:cron] Användar-crontab konfigurerad (var 5:e minut).');
        } else {
            console.warn('[setup:cron] Crontab otillgänglig:', cron.reason);
            console.warn('[setup:cron] Använder PM2 backup-drift i stället.');
            await setup_pm2_backup();
        }

        console.log('[setup:cron] Logg:', logPath);
        console.log('[setup:cron] Primär övervakning: watchdog var 45:e sekund + heartbeat-fil.');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[setup:cron] Fel:', err.message);
    process.exit(1);
});
