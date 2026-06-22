#!/usr/bin/env node
/**
 * Sätter användare som admin (eller tar bort admin) på servern via SSH.
 * Kräver DEPLOY_SSH_PASSWORD i .env.
 *
 * Användning:
 *   node scripts/set-user-admin-remote.js --username=iliben
 *   node scripts/set-user-admin-remote.js --username=iliben --admin=false
 */
import { join } from 'path';
import { fileURLToPath } from 'url';
import { putFile, exec, disconnect, remotePath, projectRoot, sshPassword } from './deploy-utils.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function main() {
    const username_arg = process.argv.find((a) => a.startsWith('--username=')) || '';
    const admin_arg = process.argv.find((a) => a.startsWith('--admin=')) || '';
    const username = username_arg.split('=')[1] || '';
    const admin_flag = admin_arg.split('=')[1];

    if (!username) {
        console.error('Användning: node scripts/set-user-admin-remote.js --username=användarnamn [--admin=true|false]');
        process.exit(1);
    }

    if (!sshPassword) {
        console.error('DEPLOY_SSH_PASSWORD måste vara satt i .env för att köra detta skript.');
        process.exit(1);
    }

    try {
        console.log('[set-user-admin-remote] Kopierar set_user_admin.js till servern...');
        const scriptPath = join(projectRoot, 'server', 'scripts', 'set_user_admin.js');
        await putFile(scriptPath, `${remotePath}/server/scripts/set_user_admin.js`);

        const flag = admin_flag === 'false' ? 'false' : 'true';
        console.log('[set-user-admin-remote] Sätter admin för', username, 'till', flag, 'på servern...');
        const esc = (s) => String(s).replace(/'/g, "'\\''");
        await exec(
            `node server/scripts/set_user_admin.js '${esc(username)}' ${flag}`
        );
        console.log('[set-user-admin-remote] Klart.');
    } catch (err) {
        console.error('[set-user-admin-remote] Fel:', err.message);
        process.exit(1);
    } finally {
        await disconnect();
    }
}

main();
