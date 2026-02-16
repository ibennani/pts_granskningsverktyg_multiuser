/**
 * Gemensam logik för deploy-scripts.
 * Använder node-ssh när DEPLOY_SSH_PASSWORD är satt (fungerar på Windows utan sshpass).
 * Fallback: spawn(ssh/scp) med sshpass om tillgängligt.
 */
import 'dotenv/config';
import { spawn, execSync } from 'child_process';
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
    if (!sshPassword) return null;

    const ssh = new NodeSSH();
    await ssh.connect({
        host,
        username,
        password: sshPassword,
        tryKeyboard: true,
        readyTimeout: 20000
    });
    sshClient = ssh;
    return ssh;
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
    await run('ssh', [host, wrappedCmd]);
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
    await run('scp', [localPath, `${host}:${remotePathDest}`]);
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
    await run('scp', ['-r', localPath, `${host}:${remotePathDest}`]);
}

/**
 * Kör lokalt kommando (npm, etc) eller ssh/scp via spawn.
 */
function run(cmd, args, opts = {}) {
    let finalCmd = cmd;
    let finalArgs = args;

    if (sshPassword && (cmd === 'ssh' || cmd === 'scp') && !sshClient) {
        if (sshpass_available()) {
            if (cmd === 'ssh') {
                const [sshHost, ...rest] = args;
                finalCmd = 'sshpass';
                finalArgs = ['-p', sshPassword, 'ssh', '-o', 'StrictHostKeyChecking=accept-new', sshHost, ...rest];
            } else {
                finalCmd = 'sshpass';
                finalArgs = ['-p', sshPassword, 'scp', '-o', 'StrictHostKeyChecking=accept-new', ...args];
            }
        } else {
            throw new Error('DEPLOY_SSH_PASSWORD satt men sshpass saknas. Använd node-ssh (automatiskt) eller installera sshpass.');
        }
    }

    return new Promise((resolve, reject) => {
        const p = spawn(finalCmd, finalArgs, {
            stdio: 'inherit',
            shell: finalCmd === 'sshpass' ? false : true,
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

export { run, exec, putFile, putDirectory, getSshClient, disconnect, host, remotePath, projectRoot, sshPassword, username };
