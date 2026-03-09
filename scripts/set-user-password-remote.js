#!/usr/bin/env node
/**
 * Sätter lösenord för en användare på servern via SSH.
 * Kräver DEPLOY_SSH_PASSWORD i .env.
 *
 * Användning:
 *   node scripts/set-user-password-remote.js --name=iliben --password=erikbebis
 */
import { join } from 'path';
import { fileURLToPath } from 'url';
import { putFile, exec, disconnect, remotePath, projectRoot, sshPassword } from './deploy-utils.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function main() {
    const name_arg = process.argv.find((a) => a.startsWith('--name=')) || '';
    const password_arg = process.argv.find((a) => a.startsWith('--password=')) || '';
    const name = name_arg.split('=')[1] || '';
    const password = password_arg.split('=')[1] || '';

    if (!name || !password) {
        console.error('Användning: node scripts/set-user-password-remote.js --name=användarnamn --password=lösenord');
        process.exit(1);
    }

    if (password.length < 8) {
        console.error('Lösenordet måste vara minst 8 tecken.');
        process.exit(1);
    }

    if (!sshPassword) {
        console.error('DEPLOY_SSH_PASSWORD måste vara satt i .env för att köra detta skript.');
        process.exit(1);
    }

    try {
        console.log('[set-user-password-remote] Kopierar set_user_password.js till servern...');
        const scriptPath = join(projectRoot, 'server', 'scripts', 'set_user_password.js');
        await putFile(scriptPath, `${remotePath}/server/scripts/set_user_password.js`);

        console.log('[set-user-password-remote] Sätter lösenord för', name, 'på servern...');
        const esc = (s) => String(s).replace(/'/g, "'\\''");
        await exec(
            `node server/scripts/set_user_password.js --name='${esc(name)}' --password='${esc(password)}'`
        );
        console.log('[set-user-password-remote] Klart.');
    } catch (err) {
        console.error('[set-user-password-remote] Fel:', err.message);
        process.exit(1);
    } finally {
        await disconnect();
    }
}

main();
