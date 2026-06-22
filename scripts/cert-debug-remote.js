#!/usr/bin/env node
import { exec, disconnect } from './deploy-utils.js';

async function run() {
    try {
        console.log('--- /etc/nginx/ssl (lista) ---');
        await exec('ls -la /etc/nginx/ssl || true', { cwd: false });

        console.log('\n--- BEGIN CERTIFICATE antal ---');
        await exec(
            "python3 -c \"import re; p='/etc/nginx/ssl/pts-ad.crt'; "
            + "import sys; "
            + "s=open(p,'r',encoding='utf-8',errors='ignore').read(); "
            + "print(p,'BEGIN CERTIFICATE:',len(re.findall('BEGIN CERTIFICATE',s)))\"",
            { cwd: false }
        );
        await exec(
            "python3 -c \"import re; p='/etc/nginx/ssl/pts-ad-fullchain.crt'; "
            + "import sys; "
            + "s=open(p,'r',encoding='utf-8',errors='ignore').read(); "
            + "print(p,'BEGIN CERTIFICATE:',len(re.findall('BEGIN CERTIFICATE',s)))\"",
            { cwd: false }
        );

        console.log('\n--- cert som servern presenterar (Node TLS, ej verifierat) ---');
        await exec(
            "node -e \"const tls=require('tls');"
            + "const s=tls.connect({host:'ux-granskningsverktyg.pts.ad',port:443,servername:'ux-granskningsverktyg.pts.ad',rejectUnauthorized:false},()=>{"
            + "const c=s.getPeerCertificate(true);"
            + "console.log(JSON.stringify({subject:c.subject,issuer:c.issuer,subjectaltname:c.subjectaltname,valid_from:c.valid_from,valid_to:c.valid_to,issuerCertificate: c.issuerCertificate? {subject:c.issuerCertificate.subject,issuer:c.issuerCertificate.issuer}: null},null,2));"
            + "s.end();"
            + "});"
            + "s.on('error',e=>{console.error('TLS error',e.message);process.exit(1);});\"",
            { cwd: false }
        );
    } finally {
        await disconnect();
    }
}

run().catch((err) => {
    console.error('[cert-debug] Fel:', err.message);
    process.exit(1);
});

