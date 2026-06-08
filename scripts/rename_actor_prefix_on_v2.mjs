#!/usr/bin/env node
/**
 * Byter aktörsnamn-prefix på V2: "(Förnamn) " → "Förnamn: ".
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { exec, putFile, disconnect, remotePath } from './deploy-utils.js';

const runner_name = '_rename_actor_prefix_v2_runner.mjs';
const runner_local = join(process.cwd(), 'scripts', runner_name);
const runner_remote = `${remotePath}/scripts/${runner_name}`;

const runner_source = `import 'dotenv/config';
import pg from 'pg';

function rename_actor_prefix(actor_name) {
    const text = (actor_name ?? '').toString();
    const match = text.match(/^\\(([^)]+)\\) (.*)$/);
    if (!match) return text;
    return \`\${match[1]}: \${match[2]}\`;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const result = await pool.query(
    \`SELECT id, metadata->>'actorName' AS actor_name, metadata
     FROM audits
     WHERE metadata->>'actorName' LIKE '(%) %'
     ORDER BY updated_at DESC\`
);

let updated = 0;
for (const row of result.rows) {
    const new_name = rename_actor_prefix(row.actor_name);
    if (new_name === row.actor_name) continue;
    const metadata = { ...(row.metadata || {}), actorName: new_name };
    await pool.query(
        'UPDATE audits SET metadata = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [JSON.stringify(metadata), row.id]
    );
    console.info('[rename-v2]', row.actor_name, '→', new_name);
    updated += 1;
}
await pool.end();
console.info('[rename-v2] Klart:', updated, 'granskningar uppdaterade');
`;

async function main() {
    writeFileSync(runner_local, runner_source, 'utf8');
    try {
        await putFile(runner_local, runner_remote);
        await exec(`node scripts/${runner_name}`);
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[rename-v2] Fel:', err.message);
    process.exit(1);
});
