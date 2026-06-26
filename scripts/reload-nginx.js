#!/usr/bin/env node
/**
 * Kopierar nginx-ux-granskning.conf från deploy-mappen och laddar om nginx på servern.
 * Sudo: DEPLOY_SSH_PASSWORD från .env (samma som SSH), valfri override DEPLOY_SUDO_PASSWORD.
 *
 * Testserver: npm run reload-nginx:test-server
 * Prod v2:    npm run reload-nginx
 */
import 'dotenv/config';
import { exec_sudo, disconnect, remotePath } from './deploy-utils.js';

async function main() {
    const nginxConfigPath = process.env.DEPLOY_NGINX_CONF || '/etc/nginx/conf.d/ux-granskning.conf';
    const nginxCopyAndReload =
        `cp ${remotePath}/nginx-ux-granskning.conf ${nginxConfigPath} && nginx -t && systemctl reload nginx`;

    try {
        console.log(`[reload-nginx] Uppdaterar ${nginxConfigPath} från ${remotePath}/nginx-ux-granskning.conf ...`);
        await exec_sudo(nginxCopyAndReload, { cwd: false });
        console.log('[reload-nginx] Nginx testad och omstartad.');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[reload-nginx] Fel:', err.message);
    process.exit(1);
});
