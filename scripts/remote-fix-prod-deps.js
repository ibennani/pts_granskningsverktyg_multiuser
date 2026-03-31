#!/usr/bin/env node
/**
 * Kör npm install --omit=dev på servern och startar om backend (samma SSH som deploy).
 * Användning: node scripts/remote-fix-prod-deps.js
 */
import { exec, disconnect, remotePath } from './deploy-utils.js';

const rp = remotePath.replace(/'/g, "'\\''");
const cmd = [
    `cd '${rp}'`,
    'npm install --omit=dev --ignore-scripts',
    'test -d node_modules/express && echo "OK: node_modules/express finns" || echo "FEL: express saknas"',
    'npx pm2 restart granskningsverktyget-v2',
    'sleep 2',
    'curl -s -o /dev/null -w "localhost /api/health: %{http_code}\\n" http://127.0.0.1:3000/api/health'
].join(' && ');

async function main() {
    try {
        await exec(cmd, { cwd: false });
    } finally {
        await disconnect();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
