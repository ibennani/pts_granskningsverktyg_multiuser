#!/usr/bin/env node
/**
 * Konfigurerar servern så att Leffe (Postgres, v2 + test-server backend, watchdog) startar vid boot.
 *
 * Miljö: samma som deploy-utils (DEPLOY_HOST, DEPLOY_PATH, DEPLOY_SSH_PASSWORD).
 * För pm2 startup och systemctl enable krävs DEPLOY_SUDO_PASSWORD i .env (samma som nginx-deploy).
 *
 * Användning: npm run setup:boot
 */
import { join } from 'path';
import {
    exec,
    exec_sudo,
    disconnect,
    remotePath,
    projectRoot,
    putFile,
    username,
    getSshClient,
    resolve_sudo_password
} from './deploy-utils.js';

const sudoPassword = resolve_sudo_password();
const PM2_GLOBAL_DIR = '/usr/lib/node_modules/pm2';

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
        throw new Error('DEPLOY_SUDO_PASSWORD eller DEPLOY_SSH_PASSWORD saknas i .env');
    }
    await exec_sudo(shell_cmd, { cwd: false });
}

/**
 * RHEL/Fedora: global pm2 ligger ofta i 0750-katalog – deploy-användaren får EXEC 203 vid boot.
 * Körs utan systemctl restart så pågående backend inte störs.
 */
async function patch_pm2_systemd_for_boot(boot_user) {
    if (!sudoPassword) {
        console.warn('[setup:boot] Hoppar över PM2 boot-patch (sudo-lösenord saknas).');
        return;
    }
    const pm2_service = `pm2-${boot_user}.service`;
    const unit_path = `/etc/systemd/system/${pm2_service}`;
    console.info('[setup:boot] Säkerställer att global pm2 går att köra vid boot...');
    await run_sudo(`test -d ${PM2_GLOBAL_DIR} && chmod -R a+rx ${PM2_GLOBAL_DIR} || true`);
    await run_sudo(
        `test -f ${unit_path} && (grep -q '^TimeoutStartSec=' ${unit_path} || sed -i '/^\\[Service\\]/a TimeoutStartSec=180' ${unit_path}) || true`
    );
    await run_sudo('systemctl daemon-reload');
}

async function setup_pm2_systemd(boot_user) {
    const pm2_service = `pm2-${boot_user}.service`;
    const enabled = await exec_capture(`systemctl is-enabled ${pm2_service} 2>/dev/null || true`, { cwd: false });
    if (enabled.stdout.trim() === 'enabled') {
        console.info(`[setup:boot] ${pm2_service} är redan enabled – patchar boot-rättigheter.`);
        await patch_pm2_systemd_for_boot(boot_user);
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
    await patch_pm2_systemd_for_boot(boot_user);
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
    const watchdogPath = join(projectRoot, 'scripts', 'healthcheck-watchdog.js');
    const healthRestartPath = join(projectRoot, 'scripts', 'health-check-and-restart.sh');
    const commonPath = join(projectRoot, 'scripts', 'pm2-leffe-common.sh');
    const driftBackupPath = join(projectRoot, 'scripts', 'drift-backup-loop.js');

    await putFile(scriptPath, remoteScript);
    await putFile(watchdogPath, `${remotePath}/scripts/healthcheck-watchdog.js`);
    await putFile(healthRestartPath, `${remotePath}/scripts/health-check-and-restart.sh`);
    await putFile(commonPath, `${remotePath}/scripts/pm2-leffe-common.sh`);
    await putFile(driftBackupPath, `${remotePath}/scripts/drift-backup-loop.js`);
    await exec('perl -pi -e "s/\\r$//" scripts/server-boot-leffe.sh scripts/health-check-and-restart.sh scripts/pm2-leffe-common.sh 2>/dev/null || true');
    await exec('chmod +x scripts/server-boot-leffe.sh scripts/health-check-and-restart.sh scripts/pm2-leffe-common.sh');
    await exec('mkdir -p logs');

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
        'curl -fsS --connect-timeout 5 http://127.0.0.1:3000/api/health && echo v2-health-ok || echo v2-health-fail',
        'curl -fsS --connect-timeout 5 http://127.0.0.1:3001/api/health && echo test-server-health-ok || echo test-server-health-fail',
        'npx pm2 list 2>/dev/null || true'
    ].join('; echo "---"; ');
    console.info('\n[setup:boot] Verifierar boot-konfiguration...\n');
    await exec(checks, { cwd: false });
}

async function main() {
    try {
        console.info('[setup:boot] Konfigurerar automatisk start vid serverboot (v2 + test-server)...\n');
        await run_boot_script();
        await verify_boot_config();
        console.info('\n[setup:boot] Klart. Efter nästa omstart ska Postgres, v2, test-server, watchdog och nginx starta automatiskt.');
        console.info('[setup:boot] PM2 sparar processlistan; systemd-tjänsten pm2-<användare> återställer den vid boot.');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[setup:boot] Fel:', err.message);
    process.exit(1);
});
