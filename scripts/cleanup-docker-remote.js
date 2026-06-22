#!/usr/bin/env node
/**
 * Kör Docker-städning på deploy-servern (tar bort stoppade containrar,
 * oanvända nätverk, hängande images). Datavolymer påverkas inte.
 *
 * Kör lokalt: node scripts/cleanup-docker-remote.js
 */
import { exec, disconnect } from './deploy-utils.js';

async function main() {
    try {
        console.log('[cleanup] Kör Docker-städning på servern...');
        await exec('bash scripts/cleanup-docker-remote.sh');
        console.log('[cleanup] Klar.');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[cleanup] Fel:', err?.message || err);
    process.exit(1);
});
