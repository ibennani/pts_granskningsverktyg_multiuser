/**
 * Gemensam logik för deploy-scripts.
 * Använder node-ssh när DEPLOY_SSH_PASSWORD är satt (fungerar på Windows utan sshpass).
 * Fallback: spawn(ssh/scp) med sshpass om tillgängligt.
 */
import 'dotenv/config';
import { spawn, execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { NodeSSH } from 'node-ssh';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

const rawHost = process.env.DEPLOY_HOST || 'ux-granskningsverktyg.pts.ad';
const hostParts = rawHost.includes('@') ? rawHost.split('@') : [null, rawHost];
const sshUser = hostParts[0] || null;
const host = hostParts[1] || rawHost;
const remotePath = process.env.DEPLOY_PATH || '/var/www/granskningsverktyget-v2';
const sshPassword = process.env.DEPLOY_SSH_PASSWORD || '';
const username = process.env.DEPLOY_USER || sshUser || process.env.USERNAME || process.env.USER || 'granskning';
/** SSH-config-alias (t.ex. "granskning") – används av spawn ssh/scp när node-ssh inte används. */
const sshAlias = process.env.DEPLOY_SSH_ALIAS || '';
const sshConnectHost = process.env.DEPLOY_SSH_HOSTNAME || host;

function resolve_private_key_pem() {
    const candidates = [
        process.env.DEPLOY_SSH_PRIVATE_KEY,
        join(homedir(), '.ssh', 'id_ed25519_granskning'),
        join(homedir(), '.ssh', 'id_rsa')
    ].filter(Boolean);
    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return readFileSync(candidate, 'utf8');
        }
    }
    return null;
}

function get_ssh_spawn_target() {
    return sshAlias || `${username}@${sshConnectHost}`;
}

/** Max väntan på SSH-handshake (ms). Höj vid långsam VPN eller "Timed out while waiting for handshake". */
const sshReadyTimeoutMs = (() => {
    const raw = process.env.DEPLOY_SSH_READY_TIMEOUT_MS;
    if (raw === undefined || raw === '') return 90000;
    const n = Number.parseInt(String(raw), 10);
    return Number.isFinite(n) && n >= 5000 ? n : 90000;
})();

let sshClient = null;

function sshpass_available() {
    try {
        execSync('sshpass -V', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Skapar en SSH-anslutning via node-ssh (fungerar på alla plattformar).
 */
async function getSshClient() {
    if (sshClient) return sshClient;
    /** OpenSSH-config (Host granskning m.m.) hanteras bättre av spawn ssh/scp än node-ssh. */
    if (sshAlias) return null;

    const privateKey = resolve_private_key_pem();
    const ssh = new NodeSSH();
    const baseOpts = {
        host: sshConnectHost,
        username,
        readyTimeout: sshReadyTimeoutMs,
        keepaliveInterval: 10000
    };

    if (privateKey && !sshPassword) {
        try {
            await ssh.connect({ ...baseOpts, privateKey });
            sshClient = ssh;
            return ssh;
        } catch (keyErr) {
            console.warn('[deploy] SSH-nyckel (node-ssh) misslyckades, försöker OpenSSH-alias:', keyErr.message);
            return null;
        }
    }

    if (privateKey) {
        try {
            await ssh.connect({ ...baseOpts, privateKey });
            sshClient = ssh;
            return ssh;
        } catch (keyErr) {
            console.warn('[deploy] SSH-nyckel misslyckades, försöker lösenord:', keyErr.message);
        }
    }

    if (!sshPassword) return null;

    try {
        await ssh.connect({
            ...baseOpts,
            password: sshPassword,
            tryKeyboard: true
        });
        sshClient = ssh;
        return ssh;
    } catch (passwordErr) {
        console.warn('[deploy] SSH-lösenord misslyckades, försöker OpenSSH-alias:', passwordErr.message);
        return null;
    }
}

/**
 * Kör kommando på servern. Använder node-ssh om lösenord finns, annars spawn.
 * Använder bash -l för att ladda användarens PATH (pm2, nvm, etc).
 * @param {string} cmd - Kommando att köra
 * @param {{ cwd?: boolean }} opts - cwd: false = kör utan att cd till remotePath först
 */
async function exec(cmd, opts = {}) {
    const useCwd = opts.cwd !== false;
    const fullCmd = useCwd ? `cd ${remotePath} && ${cmd}` : cmd;
    const wrappedCmd = `bash -l -c ${JSON.stringify(fullCmd)}`;
    const client = await getSshClient();
    if (client) {
        const result = await client.execCommand(wrappedCmd, useCwd ? {} : { cwd: '/' });
        if (result.stdout) process.stdout.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
        if (result.code !== 0) throw new Error(`Kommando misslyckades (kod ${result.code}): ${cmd}`);
        return;
    }
    await run('ssh', [get_ssh_spawn_target(), wrappedCmd]);
}

/**
 * Kopierar fil till servern.
 */
async function putFile(localPath, remotePathDest) {
    const client = await getSshClient();
    if (client) {
        await client.putFile(localPath, remotePathDest);
        return;
    }
    await run('scp', [localPath, `${get_ssh_spawn_target()}:${remotePathDest}`]);
}

/**
 * Kopierar mapp till servern.
 */
async function putDirectory(localPath, remotePathDest, opts = {}) {
    const client = await getSshClient();
    if (client) {
        await client.putDirectory(localPath, remotePathDest, {
            recursive: true,
            concurrency: 10,
            tick: (localPath, remotePath, error) => {
                if (error) process.stderr.write(`[scp] ${localPath}: ${error.message}\n`);
            },
            ...opts
        });
        return;
    }
    await run('scp', ['-r', localPath, `${get_ssh_spawn_target()}:${remotePathDest}`]);
}

/**
 * Kör lokalt kommando (npm, etc) eller ssh/scp via spawn.
 */
function run(cmd, args, opts = {}) {
    let finalCmd = cmd;
    let finalArgs = args;

    if (sshPassword && (cmd === 'ssh' || cmd === 'scp') && !sshClient && !sshAlias) {
        if (sshpass_available()) {
            if (cmd === 'ssh') {
                const [sshHost, ...rest] = args;
                finalCmd = 'sshpass';
                finalArgs = ['-p', sshPassword, 'ssh', '-o', 'StrictHostKeyChecking=accept-new', '-o', `ConnectTimeout=${Math.ceil(sshReadyTimeoutMs / 1000)}`, sshHost, ...rest];
            } else {
                finalCmd = 'sshpass';
                finalArgs = ['-p', sshPassword, 'scp', '-o', 'StrictHostKeyChecking=accept-new', '-o', `ConnectTimeout=${Math.ceil(sshReadyTimeoutMs / 1000)}`, ...args];
            }
        } else {
            throw new Error('DEPLOY_SSH_PASSWORD satt men sshpass saknas. Använd node-ssh (automatiskt) eller installera sshpass.');
        }
    } else if ((cmd === 'ssh' || cmd === 'scp') && !sshClient) {
        const connect_sec = Math.max(5, Math.ceil(sshReadyTimeoutMs / 1000));
        if (cmd === 'ssh') {
            const [sshHost, ...rest] = args;
            finalArgs = ['-o', `ConnectTimeout=${connect_sec}`, sshHost, ...rest];
        } else {
            finalArgs = ['-o', `ConnectTimeout=${connect_sec}`, ...args];
        }
    }

    return new Promise((resolve, reject) => {
        const p = spawn(finalCmd, finalArgs, {
            stdio: 'inherit',
            // ssh utan shell: undvik att PowerShell expanderar $ i fjärrkommandot
            shell: finalCmd === 'sshpass' || cmd === 'ssh' ? false : true,
            cwd: projectRoot,
            ...opts
        });
        p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${finalCmd} exited ${code}`))));
    });
}

async function disconnect() {
    if (sshClient) {
        sshClient.dispose();
        sshClient = null;
    }
}

export { run, exec, putFile, putDirectory, getSshClient, disconnect, host, remotePath, projectRoot, sshPassword, username, get_ssh_spawn_target };
