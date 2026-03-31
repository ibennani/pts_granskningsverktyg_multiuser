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

        // Säkerställ mappstruktur för backend + statiska filer
        await sshOrRun(
            `mkdir -p ${remotePath} ${remotePath}/server ${remotePath}/js ${remotePath}/scripts`,
            ['ssh', [host, `mkdir -p ${remotePath} ${remotePath}/server ${remotePath}/js ${remotePath}/scripts`]],
            { cwd: false }
        );

        // Ladda upp frontend-bygget till temporär katalog
        await scpDir(distDir, `${remotePath}/temp-dist`);

        // Byt ut tidigare frontend-filer (index.html, assets, build-info) men lämna server/js/scripts/intakta
        await sshOrRun(
            [
                `rm -rf ${remotePath}/assets`,
                `rm -f ${remotePath}/index.html`,
                `rm -f ${remotePath}/build-info.js`,
                `cp -r ${remotePath}/temp-dist/* ${remotePath}/`,
                `chmod -R o+rX ${remotePath}`,
                `rm -rf ${remotePath}/temp-dist`
            ].join(' && '),
            ['ssh', [host, `rm -rf ${remotePath}/assets && rm -f ${remotePath}/index.html && rm -f ${remotePath}/build-info.js && cp -r ${remotePath}/temp-dist/* ${remotePath}/ && chmod -R o+rX ${remotePath} && rm -rf ${remotePath}/temp-dist`]]
        );

        // Kopiera CSS-mappen så att /v2/css/... pekar på /var/www/granskningsverktyget-v2/css/...
        await scpDir(join(projectRoot, 'css'), `${remotePath}/css`);

        // Ladda upp JS-källor (används av servern / bundlade moduler)
        await scpDir(join(projectRoot, 'js'), `${remotePath}/js`);

        await scpDir(serverDir, `${remotePath}/server`);
        await scpFile(join(projectRoot, 'scripts', 'health-check-and-restart.sh'), `${remotePath}/scripts/health-check-and-restart.sh`);
        await scpFile(join(projectRoot, 'scripts', 'healthcheck-watchdog.js'), `${remotePath}/scripts/healthcheck-watchdog.js`);
        await scpFile(join(projectRoot, 'scripts', 'cleanup-docker-remote.sh'), `${remotePath}/scripts/cleanup-docker-remote.sh`);
        await sshOrRun(`chmod +x ${remotePath}/scripts/health-check-and-restart.sh ${remotePath}/scripts/cleanup-docker-remote.sh`, ['ssh', [host, `chmod +x ${remotePath}/scripts/health-check-and-restart.sh ${remotePath}/scripts/cleanup-docker-remote.sh`]], { cwd: false });
        await scpFile(join(projectRoot, 'docker-compose.yml'), `${remotePath}/docker-compose.yml`);
        await scpFile(join(projectRoot, 'package.json'), `${remotePath}/package.json`);
        await scpFile(join(projectRoot, 'package-lock.json'), `${remotePath}/package-lock.json`);

        const nginxConf = join(projectRoot, 'scripts', 'ux-granskning-with-v2.conf');
        if (existsSync(nginxConf)) {
            console.log('[deploy] Laddar upp Nginx-konfiguration...');
            await scpFile(nginxConf, `${remotePath}/nginx-ux-granskning.conf`);
        }

        // Bygg fullchain-cert i deploy-mappen (utan sudo) för att undvika att vissa klienter
        // inte kan verifiera cert-kedjan vid t.ex. WebSocket (wss).
        //
        // Vi hämtar servercertet via TLS (Node) och kombinerar med den befintliga kedjefilen
        // som finns på servern. Resultatet blir: leaf + intermediate(s).
        //
        // OBS: Kedjefilen på servern heter "pts-ad-chain.crt_används-ej" men används här som källa.
        try {
            console.log('[deploy] Bygger fullchain-cert för nginx...');
            await sshOrRun(
                [
                    `mkdir -p ${remotePath}/ssl`,
                    // Skriv leaf-cert (PEM) från live-TLS
                    `node -e "const tls=require('tls');const fs=require('fs');` +
                        `const s=tls.connect({host:'ux-granskningsverktyg.pts.ad',port:443,servername:'ux-granskningsverktyg.pts.ad',rejectUnauthorized:false},()=>{` +
                        `const c=s.getPeerCertificate(true);` +
                        `if(!c||!c.raw){console.error('Kunde inte läsa servercert (raw)');process.exit(1);}` +
                        `const b64=c.raw.toString('base64');` +
                        `const pem='-----BEGIN CERTIFICATE-----\\n'+b64.match(/.{1,64}/g).join('\\n')+'\\n-----END CERTIFICATE-----\\n';` +
                        `fs.writeFileSync('${remotePath}/ssl/pts-ad-leaf.crt',pem,'utf8');` +
                        `s.end();` +
                        `});s.on('error',e=>{console.error('TLS error',e.message);process.exit(1);});"`,
                    // Bygg fullchain: leaf + kedja (om kedjefilen finns)
                    `if [ -f /etc/nginx/ssl/pts-ad-chain.crt_används-ej ]; then ` +
                        `cat ${remotePath}/ssl/pts-ad-leaf.crt /etc/nginx/ssl/pts-ad-chain.crt_används-ej > ${remotePath}/ssl/pts-ad-fullchain.crt; ` +
                        `else cp ${remotePath}/ssl/pts-ad-leaf.crt ${remotePath}/ssl/pts-ad-fullchain.crt; fi`,
                    `chmod 0644 ${remotePath}/ssl/pts-ad-fullchain.crt ${remotePath}/ssl/pts-ad-leaf.crt || true`
                ].join(' && '),
                ['ssh', [host, `cd ${remotePath} && mkdir -p ssl && node -e "const tls=require('tls');const fs=require('fs');const s=tls.connect({host:'ux-granskningsverktyg.pts.ad',port:443,servername:'ux-granskningsverktyg.pts.ad',rejectUnauthorized:false},()=>{const c=s.getPeerCertificate(true);if(!c||!c.raw){console.error('Kunde inte läsa servercert (raw)');process.exit(1);}const b64=c.raw.toString('base64');const pem='-----BEGIN CERTIFICATE-----\\n'+b64.match(/.{1,64}/g).join('\\n')+'\\n-----END CERTIFICATE-----\\n';fs.writeFileSync('ssl/pts-ad-leaf.crt',pem,'utf8');s.end();});s.on('error',e=>{console.error('TLS error',e.message);process.exit(1);});\" && if [ -f /etc/nginx/ssl/pts-ad-chain.crt_används-ej ]; then cat ssl/pts-ad-leaf.crt /etc/nginx/ssl/pts-ad-chain.crt_används-ej > ssl/pts-ad-fullchain.crt; else cp ssl/pts-ad-leaf.crt ssl/pts-ad-fullchain.crt; fi && chmod 0644 ssl/pts-ad-fullchain.crt ssl/pts-ad-leaf.crt || true`]]
            );
        } catch (e) {
            console.warn('[deploy] Kunde inte bygga fullchain-cert (fortsätter):', e.message);
        }

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
        const pm2Start = [
            '(npx pm2 restart granskningsverktyget-v2 2>/dev/null || npx pm2 start server/index.js --name granskningsverktyget-v2)',
            '(npx pm2 restart granskningsverktyget-watchdog 2>/dev/null || npx pm2 start scripts/healthcheck-watchdog.js --name granskningsverktyget-watchdog)',
            'npx pm2 save 2>/dev/null || true'
        ].join(' && ');
        await sshOrRun(
            `npm install --omit=dev --ignore-scripts && npm run db:migrate && ${pm2Start}`,
            ['ssh', [host, `cd ${remotePath} && npm install --omit=dev --ignore-scripts && npm run db:migrate && ${pm2Start}`]]
        );

        console.log('[deploy] Verifierar att backend svarar på /api/health...');
        const rp_esc = remotePath.replace(/'/g, "'\\''");
        const health_verify = [
            'set +e',
            'for _ in 1 2 3 4 5; do if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 http://127.0.0.1:3000/api/health | grep -qx 200; then echo "[deploy] Backend OK (HTTP 200)."; exit 0; fi; sleep 3; done',
            'echo "[deploy] VARNING: /api/health svarade inte 200 efter flera försök. Kör: npm run diagnose:v2"',
            `cd '${rp_esc}' && npx pm2 logs granskningsverktyget-v2 --lines 25 --nostream 2>/dev/null || true`,
            'exit 0'
        ].join('; ');
        await exec(health_verify, { cwd: false });

        try {
            await exec('npx pm2 install pm2-logrotate 2>/dev/null || true');
        } catch (_) {
            // Ignorera om modulen redan finns
        }

        const nginxConfigPath = process.env.DEPLOY_NGINX_CONF || '/etc/nginx/conf.d/ux-granskning.conf';
        const sudoPassword = process.env.DEPLOY_SUDO_PASSWORD || '';
        const nginxCopyAndReload = `cp ${remotePath}/nginx-ux-granskning.conf ${nginxConfigPath} && nginx -t && systemctl reload nginx`;
        const nginxCmd = sudoPassword
            ? `echo ${JSON.stringify(Buffer.from(sudoPassword, 'utf8').toString('base64'))} | base64 -d | sudo -S bash -c ${JSON.stringify(nginxCopyAndReload)}`
            : `sudo cp ${remotePath}/nginx-ux-granskning.conf ${nginxConfigPath} && sudo nginx -t && sudo systemctl reload nginx`;
        try {
            console.log('[deploy] Uppdaterar Nginx och laddar om...');
            await exec(nginxCmd, { cwd: false });
            console.log('[deploy] Nginx uppdaterad.');
        } catch (err) {
            console.warn('[deploy] Nginx-uppdatering misslyckades (kräver sudo):', err.message);
            console.warn('[deploy] Kör manuellt på servern: sudo cp', `${remotePath}/nginx-ux-granskning.conf`, nginxConfigPath, '&& sudo nginx -t && sudo systemctl reload nginx');
        }

        console.log('[deploy] Klart! https://ux-granskningsverktyg.pts.ad/v2/');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[deploy] Fel:', err.message);
    process.exit(1);
});
