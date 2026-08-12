#!/usr/bin/env node
/**
 * Startar om driftservern och väntar tills v2 + test-server svarar på health.
 * Användning: node scripts/reboot-and-verify-remote.js
 */
import { exec_sudo, disconnect } from './deploy-utils.js';

const PUBLIC_V2_HEALTH = 'https://ux-granskningsverktyg.pts.ad/v2/api/health';
const PUBLIC_TEST_HEALTH = 'https://ux-granskningsverktyg.pts.ad/test-server/api/health';
const MAX_WAIT_MS = 8 * 60 * 1000;
const POLL_MS = 10_000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetch_health_ok(url) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) return { ok: false, status: res.status, body: await res.text().catch(() => '') };
        const data = await res.json().catch(() => null);
        return { ok: data?.ok === true, status: res.status, data };
    } catch (err) {
        return { ok: false, status: 0, error: err?.message || String(err) };
    }
}

async function wait_for_both_health() {
    const started = Date.now();
    let attempt = 0;
    while (Date.now() - started < MAX_WAIT_MS) {
        attempt += 1;
        const v2 = await fetch_health_ok(PUBLIC_V2_HEALTH);
        const test = await fetch_health_ok(PUBLIC_TEST_HEALTH);
        const elapsed = Math.round((Date.now() - started) / 1000);
        console.info(
            `[reboot-verify] Försök ${attempt} (${elapsed}s): v2=${v2.status || 'err'} test=${test.status || 'err'}`
        );
        if (v2.ok && test.ok) {
            return { v2, test, elapsed_sec: elapsed };
        }
        await sleep(POLL_MS);
    }
    throw new Error(`Health-check timeout efter ${MAX_WAIT_MS / 1000}s`);
}

async function main() {
    console.info('[reboot-verify] Startar om servern (sudo reboot)...');
    try {
        await exec_sudo('nohup bash -c "sleep 2 && reboot" >/dev/null 2>&1 &', { cwd: false });
    } catch (err) {
        const msg = err?.message || '';
        if (!/closed|disconnect|ECONNRESET|connection/i.test(msg)) {
            throw err;
        }
        console.info('[reboot-verify] SSH bröts som förväntat vid reboot.');
    } finally {
        await disconnect();
    }

    console.info('[reboot-verify] Väntar 45s innan health-polling...');
    await sleep(45_000);

    const result = await wait_for_both_health();
    console.info(`[reboot-verify] Båda miljöerna svarar OK efter ${result.elapsed_sec}s.`);
    console.info('[reboot-verify] v2:', JSON.stringify(result.v2.data));
    console.info('[reboot-verify] test:', JSON.stringify(result.test.data));
}

main().catch((err) => {
    console.error('[reboot-verify] Fel:', err.message);
    process.exit(1);
});
