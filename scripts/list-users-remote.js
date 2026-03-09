#!/usr/bin/env node
/**
 * Listar användare på servern via SSH.
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
        const scriptPath = join(projectRoot, 'server', 'scripts', 'list_users.js');
        await putFile(scriptPath, `${remotePath}/server/scripts/list_users.js`);
        await exec('node server/scripts/list_users.js');
    } catch (err) {
        console.error('Fel:', err.message);
        process.exit(1);
    } finally {
        await disconnect();
    }
}

main();
