#!/usr/bin/env node
/**
 * Kör apply_user_changes.js på servern (ta bort användare, sätt lösenord, uppdatera användarnamn).
 * Kräver DEPLOY_SSH_PASSWORD i .env.
 */
import { join } from 'path';
import { fileURLToPath } from 'url';
import { putFile, exec, disconnect, remotePath, projectRoot, sshPassword } from './deploy-utils.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function main() {
    if (!sshPassword) {
        console.error('DEPLOY_SSH_PASSWORD måste vara satt i .env.');
        process.exit(1);
    }

    try {
        const scriptPath = join(projectRoot, 'server', 'scripts', 'apply_user_changes.js');
        await putFile(scriptPath, `${remotePath}/server/scripts/apply_user_changes.js`);
        await exec('node server/scripts/apply_user_changes.js');
    } catch (err) {
        console.error('Fel:', err.message);
        process.exit(1);
    } finally {
        await disconnect();
    }
}

main();
