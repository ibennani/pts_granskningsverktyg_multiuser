#!/usr/bin/env node
/**
 * Kör snapshot-capture-test mot Apohem på testservern.
 */
process.env.DEPLOY_PATH = process.env.DEPLOY_PATH || '/var/www/granskningsverktyget-test-server';
if (!process.env.DEPLOY_SSH_ALIAS && !process.env.DEPLOY_SSH_PASSWORD) {
    process.env.DEPLOY_SSH_ALIAS = 'granskning';
}

const { exec, disconnect, remotePath } = await import('./deploy-utils.js');

const rp = remotePath.replace(/'/g, "'\\''");
const cmd = `cd '${rp}' && npx tsx scripts/verify_snapshot_capture.ts`;

async function main() {
    try {
        await exec(cmd, { cwd: false });
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[remote-test-snapshot] Fel:', err.message);
    process.exit(1);
});
