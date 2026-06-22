#!/usr/bin/env node
import { exec, disconnect } from './deploy-utils.js';

async function run() {
    const backend_cmd = [
        "curl --http1.1 -i -s -N --max-time 5",
        "-H 'Connection: Upgrade'",
        "-H 'Upgrade: websocket'",
        "-H 'Sec-WebSocket-Version: 13'",
        "-H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=='",
        "http://127.0.0.1:3000/ws"
    ].join(' ') + " || true";

    const nginx_cmd = [
        "curl --http1.1 -k -i -s -N --max-time 5",
        "-H 'Connection: Upgrade'",
        "-H 'Upgrade: websocket'",
        "-H 'Sec-WebSocket-Version: 13'",
        "-H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=='",
        "https://127.0.0.1/v2/ws"
    ].join(' ') + " || true";

    const domain_cmd = [
        "curl --http1.1 -k -i -s -N --max-time 5",
        "-H 'Connection: Upgrade'",
        "-H 'Upgrade: websocket'",
        "-H 'Sec-WebSocket-Version: 13'",
        "-H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=='",
        "https://ux-granskningsverktyg.pts.ad/v2/ws"
    ].join(' ') + " || true";

    try {
        console.log('--- backend /ws (upgrade) ---');
        await exec(backend_cmd, { cwd: false });
        console.log('\n--- nginx /v2/ws (upgrade) ---');
        await exec(nginx_cmd, { cwd: false });
        console.log('\n--- domän /v2/ws (upgrade) ---');
        await exec(domain_cmd, { cwd: false });
    } finally {
        await disconnect();
    }
}

run().catch((err) => {
    console.error('[ws-debug] Fel:', err.message);
    process.exit(1);
});

