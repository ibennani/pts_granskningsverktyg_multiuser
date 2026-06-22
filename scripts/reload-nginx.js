#!/usr/bin/env node
/**
 * Kör nginx -t och reload på servern via SSH.
 * Använder DEPLOY_SSH_PASSWORD från .env (samma som deploy:v2).
 * För sudo: lägg DEPLOY_SUDO_PASSWORD i .env (eller använd NOPASSWD för nginx på servern).
 */
import 'dotenv/config';
import { exec, disconnect } from './deploy-utils.js';

const sudoPassword = process.env.DEPLOY_SUDO_PASSWORD || '';

async function main() {
    try {
        // Base64 undviker problem med specialtecken i lösenord
        const pwB64 = sudoPassword ? Buffer.from(sudoPassword, 'utf8').toString('base64') : '';
        const cmd = pwB64
            ? `echo ${JSON.stringify(pwB64)} | base64 -d | sudo -S nginx -t && echo ${JSON.stringify(pwB64)} | base64 -d | sudo -S systemctl reload nginx`
            : 'sudo nginx -t && sudo systemctl reload nginx';
        await exec(cmd, { cwd: false });
        console.log('[reload-nginx] Nginx testad och omstartad.');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[reload-nginx] Fel:', err.message);
    process.exit(1);
});
