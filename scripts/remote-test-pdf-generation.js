#!/usr/bin/env node
/**
 * Verifierar att Puppeteer kan generera PDF på remote server (test eller prod deploy-mapp).
 */
import { exec, disconnect, remotePath } from './deploy-utils.js';

const rp = remotePath.replace(/'/g, "'\\''");
const cmd = [
    `cd '${rp}'`,
    'npx puppeteer browsers install chrome',
    `npx tsx scripts/verify_pdf_generation.ts`,
].join(' && ');

async function main() {
    try {
        await exec(cmd, { cwd: false });
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[remote-test-pdf] Fel:', err.message);
    process.exit(1);
});
