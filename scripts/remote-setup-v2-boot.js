#!/usr/bin/env node
/**
 * Konfigurerar V2-servern så att Leffe (Postgres, PM2-backend, watchdog) startar vid boot.
 *
 * Miljö: samma som deploy-utils (DEPLOY_HOST, DEPLOY_PATH, DEPLOY_SSH_PASSWORD).
 * För pm2 startup och systemctl enable krävs DEPLOY_SUDO_PASSWORD i .env (samma som nginx-deploy).
 *
 * Användning: npm run setup:v2:boot
 */
import { join } from 'path';
import {
    exec,
    disconnect,
    remotePath,
    projectRoot,
    putFile,
    username,
    getSshClient
} from './deploy-utils.js';

const sudoPassword = process.env.DEPLOY_SUDO_PASSWORD || '';

async function exec_capture(cmd, opts = {}) {
    const useCwd = opts.cwd !== false;
    const fullCmd = useCwd ? `cd ${remotePath} && ${cmd}` : cmd;
    const wrappedCmd = `bash -l -c ${JSON.stringify(fullCmd)}`;
    const client = await getSshClient();
    if (!client) {
        throw new Error('exec_capture kräver DEPLOY_SSH_PASSWORD (node-ssh)');
    }
    const result = await client.execCommand(wrappedCmd, useCwd ? {} : { cwd: '/' });
    return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        code: result.code ?? 1
    };
}

async function run_sudo(shell_cmd) {
    if (!sudoPassword) {
        throw new Error('DEPLOY_SUDO_PASSWORD saknas i .env');
    }
    const b64 = Buffer.from(sudoPassword, 'utf8').toString('base64');
    await exec(
        `echo ${JSON.stringify(b64)} | base64 -d | sudo -S -k bash -c ${JSON.stringify(shell_cmd)}`,
        { cwd: false }
    );
}

async function setup_pm2_systemd(boot_user) {
    const pm2_service = `pm2-${boot_user}.service`;
    const enabled = await exec_capture(`systemctl is-enabled ${pm2_service} 2>/dev/null || true`, { cwd: false });
    if (enabled.stdout.trim() === 'enabled') {
        console.info(`[setup:boot] ${pm2_service} är redan enabled.`);
        return;
    }

    const boot_home = (
        await exec_capture(`getent passwd ${boot_user} | cut -d: -f6`, { cwd: false })
    ).stdout.trim() || `/home/${boot_user}`;

    let pm2_bin = (await exec_capture('bash -l -c "command -v pm2 2>/dev/null || true"')).stdout.trim();
    if (!pm2_bin) {
        console.info('[setup:boot] pm2 saknas globalt – installerar systemomfattande (sudo npm install -g pm2)...');
        await run_sudo('npm install -g pm2');
        pm2_bin = (await exec_capture('command -v pm2', { cwd: false })).stdout.trim()
            || '/usr/bin/pm2';
    }
    if (!pm2_bin) {
        throw new Error('pm2 kunde inte installeras – kontrollera npm på servern');
    }
    const user_path = (await exec_capture('bash -l -c "echo $PATH"')).stdout.trim();

    // pm2 startup kräver root men pm2 finns ofta bara i användarens PATH (nvm) – skicka explicit PATH.
    const root_cmd = `env PATH=${user_path}:/usr/bin ${pm2_bin} startup systemd -u ${boot_user} --hp ${boot_home}`;
    console.info('[setup:boot] Registrerar PM2 i systemd (sudo)...');
    await run_sudo(root_cmd);
    await exec('npx pm2 save');
}

async function enable_os_services() {
    if (!sudoPassword) {
        console.warn('[setup:boot] Hoppar över systemctl enable (DEPLOY_SUDO_PASSWORD saknas).');
        return;
    }
    console.info('[setup:boot] Enable nginx och docker vid boot...');
    await run_sudo('systemctl enable nginx docker 2>/dev/null || true');
}

async function run_boot_script() {
    const scriptPath = join(projectRoot, 'scripts', 'server-boot-leffe.sh');
    const remoteScript = `${remotePath}/scripts/server-boot-leffe.sh`;

    await putFile(scriptPath, remoteScript);
    await exec('perl -pi -e "s/\\r$//" scripts/server-boot-leffe.sh 2>/dev/null || true');
    await exec('chmod +x scripts/server-boot-leffe.sh');

    const bootUser = username || process.env.DEPLOY_USER || '';
    const envPrefix = bootUser ? `LEFFE_BOOT_USER=${bootUser} ` : '';

    console.info('[setup:boot] Startar Postgres och PM2 (utan sudo)...');
    await exec(`${envPrefix}LEFFE_SKIP_SYSTEMD=1 bash scripts/server-boot-leffe.sh`);

    await setup_pm2_systemd(bootUser || username);
    await enable_os_services();
}

async function verify_boot_config() {
    const bootUser = username || process.env.DEPLOY_USER || '$(whoami)';
    const checks = [
        `systemctl is-enabled pm2-${bootUser}.service 2>/dev/null || echo pm2-not-enabled`,
        'systemctl is-enabled nginx 2>/dev/null || echo nginx-unknown',
        'systemctl is-enabled docker 2>/dev/null || echo docker-unknown',
        'docker ps --filter name=granskningsverktyget-db --format "{{.Names}} {{.Status}}" 2>/dev/null || true',
        'curl -fsS --connect-timeout 5 http://127.0.0.1:3000/api/health && echo health-ok || echo health-fail'
    ].join('; echo "---"; ');
    console.info('\n[setup:boot] Verifierar boot-konfiguration...\n');
    await exec(checks, { cwd: false });
}

async function main() {
    try {
        console.info('[setup:boot] Konfigurerar automatisk start vid serverboot på V2...\n');
        await run_boot_script();
        await verify_boot_config();
        console.info('\n[setup:boot] Klart. Efter nästa omstart ska Postgres, backend och watchdog starta automatiskt.');
        console.info('[setup:boot] nginx och Docker ska vara enabled via systemd.');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[setup:boot] Fel:', err.message);
    process.exit(1);
});
