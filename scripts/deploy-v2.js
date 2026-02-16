#!/usr/bin/env node
/**
 * Deploy v2 till servern.
 * Kräver: SSH-åtkomst. Lägg DEPLOY_SSH_PASSWORD i .env för automatisk inloggning (fungerar på Windows).
 *
 * Användning:
 *   npm run deploy:v2
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { run, exec, putFile, putDirectory, disconnect, host, remotePath, projectRoot, sshPassword } from './deploy-utils.js';

const distDir = join(projectRoot, 'dist');
const serverDir = join(projectRoot, 'server');

async function sshOrRun(sshCmd, spawnArgs, execOpts = {}) {
    if (sshPassword) {
        await exec(sshCmd, execOpts);
    } else {
        await run(spawnArgs[0], spawnArgs[1]);
    }
}

async function scpFile(local, remote) {
    if (sshPassword) {
        await putFile(local, remote);
    } else {
        await run('scp', [local, `${host}:${remote}`]);
    }
}

async function scpDir(local, remote) {
    if (sshPassword) {
        await putDirectory(local, remote);
    } else {
        await run('scp', ['-r', local, `${host}:${remote}`]);
    }
}

async function main() {
    try {
        console.log('[deploy] Bygger projektet...');
        await run('npm', ['run', 'build']);

        if (!existsSync(distDir)) {
            throw new Error('dist/ saknas efter build');
        }

        console.log(`[deploy] Laddar upp till ${host}:${remotePath}...`);

        await sshOrRun(`mkdir -p ${remotePath}/v2 ${remotePath}/server ${remotePath}/js`, ['ssh', [host, `mkdir -p ${remotePath}/v2 ${remotePath}/server ${remotePath}/js`]], { cwd: false });

        await scpDir(join(projectRoot, 'js'), `${remotePath}/js`);
        await scpDir(distDir, `${remotePath}/temp-dist`);

        await sshOrRun(
            `rm -rf ${remotePath}/v2 ${remotePath}/dist && mkdir -p ${remotePath}/v2 && cp -r ${remotePath}/temp-dist/* ${remotePath}/v2/ && chmod -R o+rX ${remotePath}/v2 && rm -rf ${remotePath}/temp-dist`,
            ['ssh', [host, `rm -rf ${remotePath}/v2 ${remotePath}/dist && mkdir -p ${remotePath}/v2 && cp -r ${remotePath}/temp-dist/* ${remotePath}/v2/ && chmod -R o+rX ${remotePath}/v2 && rm -rf ${remotePath}/temp-dist`]]
        );

        await scpDir(serverDir, `${remotePath}/server`);
        await scpFile(join(projectRoot, 'docker-compose.yml'), `${remotePath}/docker-compose.yml`);
        await scpFile(join(projectRoot, 'package.json'), `${remotePath}/package.json`);
        await scpFile(join(projectRoot, 'package-lock.json'), `${remotePath}/package-lock.json`);

        const envPath = join(projectRoot, '.env');
        if (existsSync(envPath)) {
            console.log('[deploy] Kopierar .env till servern (utan DEPLOY_*)...');
            let envContent = readFileSync(envPath, 'utf8');
            envContent = envContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            if (envContent.charCodeAt(0) === 0xFEFF) envContent = envContent.slice(1);
            const serverEnv = envContent.split('\n').filter(line => !line.match(/^\s*DEPLOY_/)).join('\n');
            const envCleanPath = join(projectRoot, '.env.deploy');
            writeFileSync(envCleanPath, serverEnv, 'utf8');
            try {
                await scpFile(envCleanPath, `${remotePath}/.env`);
            } finally {
                try { unlinkSync(envCleanPath); } catch (_) {}
            }
        } else {
            console.log('[deploy] OBS: .env saknas – skapa den lokalt för att använda eget databaslösenord vid deploy');
        }

        console.log('[deploy] Kör kommandon på servern...');
        await sshOrRun(
            'npm install --omit=dev --ignore-scripts && npm run db:migrate && (npx pm2 restart granskningsverktyget-v2 2>/dev/null || npx pm2 start server/index.js --name granskningsverktyget-v2)',
            ['ssh', [host, `cd ${remotePath} && npm install --omit=dev --ignore-scripts && npm run db:migrate && (npx pm2 restart granskningsverktyget-v2 2>/dev/null || npx pm2 start server/index.js --name granskningsverktyget-v2)`]]
        );

        console.log('[deploy] Klart! https://ux-granskningsverktyg.pts.ad/v2/');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[deploy] Fel:', err.message);
    process.exit(1);
});
