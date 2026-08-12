#!/usr/bin/env node
/**
 * Kör verify_apohem_snapshot_list.ts på testservern via SSH.
 */
process.env.DEPLOY_PATH =
    process.env.DEPLOY_PATH || '/var/www/granskningsverktyget-test-server';

import { exec, disconnect } from './deploy-utils.js';

async function main() {
    try {
        await exec('npx tsx scripts/verify_apohem_snapshot_list.ts');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
