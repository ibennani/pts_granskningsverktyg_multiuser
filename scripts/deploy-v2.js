#!/usr/bin/env node
/**
 * Deploy v2 till servern.
 * Kräver: SSH-åtkomst (Host från DEPLOY_HOST eller 'granskning')
 *
 * Användning:
 *   DEPLOY_HOST=granskning node scripts/deploy-v2.js
 *   eller
 *   npm run deploy:v2
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');
const distDir = join(projectRoot, 'dist');
const serverDir = join(projectRoot, 'server');

const host = process.env.DEPLOY_HOST || 'granskning';
const remotePath = process.env.DEPLOY_PATH || '/var/www/granskningsverktyget-v2';

function run(cmd, args, opts = {}) {
    return new Promise((resolve, reject) => {
        const p = spawn(cmd, args, {
            stdio: 'inherit',
            shell: true,
            cwd: projectRoot,
            ...opts
        });
        p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    });
}

async function main() {
    console.log('[deploy] Bygger projektet...');
    await run('npm', ['run', 'build']);

    if (!existsSync(distDir)) {
        throw new Error('dist/ saknas efter build');
    }

    console.log(`[deploy] Laddar upp till ${host}:${remotePath}...`);

    await run('ssh', [host, `mkdir -p ${remotePath}/v2 ${remotePath}/server`]);

    // Kopiera dist-innehåll till v2/ (root istället för alias kräver v2/ under remotePath)
    // Använder temp-mapp och mv för att undvika scp path-problem på Windows
    await run('scp', ['-r', distDir, `${host}:${remotePath}/temp-dist`]);
    await run('ssh', [
        host,
        `rm -rf ${remotePath}/v2 ${remotePath}/dist && mkdir -p ${remotePath}/v2 && cp -r ${remotePath}/temp-dist/* ${remotePath}/v2/ && chmod -R o+rX ${remotePath}/v2 && rm -rf ${remotePath}/temp-dist`
    ]);

    await run('scp', [
        '-r',
        serverDir,
        join(projectRoot, 'docker-compose.yml'),
        `${host}:${remotePath}/`
    ]);

    await run('scp', [
        join(projectRoot, 'package.json'),
        join(projectRoot, 'package-lock.json'),
        `${host}:${remotePath}/`
    ]);

    console.log('[deploy] Kör kommandon på servern...');
    await run('ssh', [
        host,
        `cd ${remotePath} && npm install --omit=dev --ignore-scripts && npm run db:migrate && (pm2 restart granskningsverktyget-v2 2>/dev/null || pm2 start server/index.js --name granskningsverktyget-v2)`
    ]);

    console.log('[deploy] Klart! https://ux-granskningsverktyg.pts.ad/v2/');
}

main().catch((err) => {
    console.error('[deploy] Fel:', err.message);
    process.exit(1);
});
