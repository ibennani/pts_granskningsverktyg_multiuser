#!/usr/bin/env node
/**
 * Deploy testserver till samma prod-värd under /test-server/.
 * Isolerad instans: egen deploy-mapp, backend :3001, databas granskningsverktyget_test.
 * Prod (/v2/, PM2 granskningsverktyget-v2) startas inte om.
 */
import 'dotenv/config';

process.env.DEPLOY_PATH = process.env.DEPLOY_PATH || '/var/www/granskningsverktyget-test-server';
if (!process.env.DEPLOY_SSH_ALIAS && !process.env.DEPLOY_SSH_PASSWORD) {
    process.env.DEPLOY_SSH_ALIAS = 'granskning';
}
if (!process.env.DEPLOY_USER) process.env.DEPLOY_USER = 'localiliben';
if (!process.env.DEPLOY_SSH_HOSTNAME) process.env.DEPLOY_SSH_HOSTNAME = 'ux-granskningsverktyg.pts.ad';

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const {
    run,
    exec,
    putFile,
    putDirectory,
    disconnect,
    host,
    remotePath,
    projectRoot,
    get_ssh_spawn_target,
    exec_sudo,
} = await import('./deploy-utils.js');

const distDir = join(projectRoot, 'dist');
const serverDir = join(projectRoot, 'server');
const PM2_NAME = 'granskningsverktyget-test-server';
const PROD_PM2_NAME = 'granskningsverktyget-v2';
const API_PORT = process.env.DEPLOY_TEST_SERVER_API_PORT || '3001';
const PUBLIC_URL = process.env.DEPLOY_TEST_SERVER_PUBLIC_URL
    || 'https://ux-granskningsverktyg.pts.ad/test-server';
const TEST_DB_NAME = process.env.GV_TEST_SERVER_DB_NAME || 'granskningsverktyget_test';
const PROD_DEPLOY_PATH = process.env.DEPLOY_PROD_PATH || '/var/www/granskningsverktyget-v2';

async function main() {
    try {
        console.log(`[deploy:test-server] SSH-mål: ${get_ssh_spawn_target()}`);

        console.log('[deploy:test-server] Säkerställer deploy-mapp på servern...');
        await exec(`mkdir -p ${remotePath}`, { cwd: false });

        console.log('[deploy:test-server] Bygger projektet med bas /test-server/...');
        await run('npm', ['run', 'build:test-server']);

        if (!existsSync(distDir)) {
            throw new Error('dist/ saknas efter build');
        }

        console.log(`[deploy:test-server] Laddar upp till ${host}:${remotePath}...`);

        await exec(
            `mkdir -p ${remotePath} ${remotePath}/server ${remotePath}/js ${remotePath}/scripts ${remotePath}/backups/db ${remotePath}/audit-media ${remotePath}/backup`,
            { cwd: false }
        );

        await putDirectory(distDir, `${remotePath}/temp-dist`);

        await exec(
            [
                `rm -rf ${remotePath}/assets`,
                `rm -f ${remotePath}/index.html`,
                `rm -f ${remotePath}/build-info.js`,
                `cp -r ${remotePath}/temp-dist/* ${remotePath}/`,
                `chmod -R o+rX ${remotePath}`,
                `rm -rf ${remotePath}/temp-dist`
            ].join(' && '),
            { cwd: false }
        );

        await putDirectory(join(projectRoot, 'css'), `${remotePath}/css`);
        await putDirectory(join(projectRoot, 'js'), `${remotePath}/js`);
        await putDirectory(join(projectRoot, 'shared'), `${remotePath}/shared`);
        await putDirectory(serverDir, `${remotePath}/server`);
        await putFile(join(projectRoot, 'scripts', 'health-check-and-restart.sh'), `${remotePath}/scripts/health-check-and-restart.sh`);
        await putFile(join(projectRoot, 'scripts', 'healthcheck-watchdog.js'), `${remotePath}/scripts/healthcheck-watchdog.js`);
        await putFile(join(projectRoot, 'scripts', 'pm2-leffe-common.sh'), `${remotePath}/scripts/pm2-leffe-common.sh`);
        await putFile(join(projectRoot, 'scripts', 'verify_pdf_generation.ts'), `${remotePath}/scripts/verify_pdf_generation.ts`);
        await putFile(join(projectRoot, 'scripts', 'cleanup-docker-remote.sh'), `${remotePath}/scripts/cleanup-docker-remote.sh`);
        await exec(
            `chmod +x ${remotePath}/scripts/health-check-and-restart.sh ${remotePath}/scripts/cleanup-docker-remote.sh ${remotePath}/scripts/pm2-leffe-common.sh`,
            { cwd: false }
        );
        await putFile(join(projectRoot, 'docker-compose.yml'), `${remotePath}/docker-compose.yml`);
        await putFile(join(projectRoot, 'package.json'), `${remotePath}/package.json`);
        await putFile(join(projectRoot, 'package-lock.json'), `${remotePath}/package-lock.json`);

        const nginxConf = join(projectRoot, 'scripts', 'ux-granskning-with-v2.conf');
        if (existsSync(nginxConf)) {
            console.log('[deploy:test-server] Laddar upp Nginx-konfiguration (v2 oförändrad, test-server tillagd)...');
            await putFile(nginxConf, `${remotePath}/nginx-ux-granskning.conf`);
        }

        const envTestPath = join(projectRoot, '.env.test-server');
        const shouldCopyEnv = process.env.DEPLOY_TEST_SERVER_COPY_ENV !== '0';
        if (shouldCopyEnv && existsSync(envTestPath)) {
            console.log('[deploy:test-server] Kopierar .env.test-server till servern...');
            let envContent = readFileSync(envTestPath, 'utf8');
            envContent = envContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            if (envContent.charCodeAt(0) === 0xFEFF) envContent = envContent.slice(1);
            const serverEnv = envContent.split('\n').filter((line) => !line.match(/^\s*DEPLOY_/)).join('\n');
            const envCleanPath = join(projectRoot, '.env.test-server.deploy');
            writeFileSync(envCleanPath, serverEnv, 'utf8');
            try {
                await putFile(envCleanPath, `${remotePath}/.env`);
            } finally {
                try { unlinkSync(envCleanPath); } catch (_) { /* ignoreras */ }
            }
        } else if (!existsSync(envTestPath)) {
            console.warn('[deploy:test-server] VARNING: .env.test-server saknas lokalt – backend kan behöva manuell .env på servern.');
        }

        console.log('[deploy:test-server] Säkerställer test-databas (prod-databas rörs inte)...');
        await exec(
            [
                `cd ${PROD_DEPLOY_PATH} && docker compose -p granskningsverktyget-v2 up -d postgres`,
                `docker exec granskningsverktyget-db psql -U granskning -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='${TEST_DB_NAME}'" | grep -q 1 || docker exec granskningsverktyget-db psql -U granskning -d postgres -c "CREATE DATABASE ${TEST_DB_NAME};"`
            ].join(' && '),
            { cwd: false }
        );

        console.log(`[deploy:test-server] Startar endast ${PM2_NAME} (rör inte ${PROD_PM2_NAME})...`);
        const pm2Start = [
            `(npx pm2 delete ${PM2_NAME} 2>/dev/null || true)`,
            `npx pm2 start npm --name ${PM2_NAME} --cwd ${remotePath} --max-memory-restart 600M --exp-backoff-restart-delay 200 -- run dev:server`,
            'npx pm2 save 2>/dev/null || true'
        ].join(' && ');
        const server_setup = [
            'npm install --omit=dev --ignore-scripts',
            'npx puppeteer browsers install chrome',
            'npm run db:migrate',
            pm2Start
        ].join(' && ');
        await exec(server_setup);

        console.log(`[deploy:test-server] Verifierar backend på port ${API_PORT}...`);
        const rp_esc = remotePath.replace(/'/g, "'\\''");
        const health_verify = [
            'set +e',
            `for _ in 1 2 3 4 5; do if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 http://127.0.0.1:${API_PORT}/api/health | grep -qx 200; then echo "[deploy:test-server] Backend OK (HTTP 200)."; exit 0; fi; sleep 3; done`,
            `echo "[deploy:test-server] VARNING: /api/health på :${API_PORT} svarade inte 200."`,
            `cd '${rp_esc}' && npx pm2 logs ${PM2_NAME} --lines 25 --nostream 2>/dev/null || true`,
            'exit 0'
        ].join('; ');
        await exec(health_verify, { cwd: false });

        console.log('[deploy:test-server] Verifierar PDF-export (Puppeteer/Chrome)...');
        try {
            await exec(`cd '${rp_esc}' && npx tsx scripts/verify_pdf_generation.ts`, { cwd: false });
        } catch (err) {
            console.warn('[deploy:test-server] VARNING: PDF-verifiering misslyckades:', err.message);
            console.warn('[deploy:test-server] Kör manuellt på servern: npx puppeteer browsers install chrome');
        }

        const nginxConfigPath = process.env.DEPLOY_NGINX_CONF || '/etc/nginx/conf.d/ux-granskning.conf';
        const nginxCopyAndReload = `cp ${remotePath}/nginx-ux-granskning.conf ${nginxConfigPath} && nginx -t && systemctl reload nginx`;
        try {
            console.log('[deploy:test-server] Uppdaterar Nginx och laddar om...');
            await exec_sudo(nginxCopyAndReload, { cwd: false });
            console.log('[deploy:test-server] Nginx uppdaterad.');
        } catch (err) {
            console.warn('[deploy:test-server] Nginx-uppdatering misslyckades:', err.message);
            console.warn('[deploy:test-server] Kör manuellt på servern om /test-server/ fortfarande ger 404.');
        }

        console.log(`[deploy:test-server] Klart! ${PUBLIC_URL}/`);
        console.log(`[deploy:test-server] Prod oförändrad: https://ux-granskningsverktyg.pts.ad/v2/`);
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[deploy:test-server] Fel:', err.message);
    process.exit(1);
});
