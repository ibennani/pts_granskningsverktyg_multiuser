#!/usr/bin/env node
/**
 * Kopierar .env till servern och startar om backend.
 * Använd när 500 kvarstår pga felaktig .env.
 * Automatisk inloggning: DEPLOY_SSH_PASSWORD i .env (fungerar på Windows).
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { run, putFile, exec, disconnect, host, remotePath, projectRoot, sshPassword } from './deploy-utils.js';

async function main() {
    try {
        const envPath = join(projectRoot, '.env');
        if (!existsSync(envPath)) {
            console.error('[fix-env] .env saknas lokalt. Skapa den först.');
            process.exit(1);
        }

        console.log('[fix-env] Kopierar .env till servern (utan DEPLOY_*-variabler)...');
        let envContent = readFileSync(envPath, 'utf8');
        envContent = envContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        if (envContent.charCodeAt(0) === 0xFEFF) envContent = envContent.slice(1);
        const serverEnv = envContent
            .split('\n')
            .filter(line => !line.match(/^\s*DEPLOY_/))
            .join('\n');
        const tmpPath = join(projectRoot, '.env.server');
        writeFileSync(tmpPath, serverEnv, 'utf8');
        try {
            if (sshPassword) {
                await putFile(tmpPath, `${remotePath}/.env`);
            } else {
                await run('scp', [tmpPath, `${host}:${remotePath}/.env`]);
            }
        } finally {
            try { unlinkSync(tmpPath); } catch (_) {}
        }

        console.log('[fix-env] Startar om backend...');
        const pm2Cmd = 'chmod 600 .env && (npx pm2 restart granskningsverktyget-v2 2>/dev/null || npx pm2 start server/index.js --name granskningsverktyget-v2)';
        if (sshPassword) {
            await exec(pm2Cmd);
        } else {
            await run('ssh', [host, `cd ${remotePath} && ${pm2Cmd}`]);
        }

        console.log('[fix-env] Klart. Kör deploy:debug för att verifiera.');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[fix-env] Fel:', err.message);
    process.exit(1);
});
