#!/usr/bin/env node
/**
 * Rensar Nelly-granskningar på testservern: granskningsdelar och sidrapporter.
 */
import { exec, disconnect } from './deploy-utils.js';

const TEST_SERVER_ROOT = '/var/www/granskningsverktyget-test-server';

async function main() {
    const find_sql = `
SELECT id
FROM audits
WHERE samples::text ILIKE '%nelly%'
   OR metadata::text ILIKE '%nelly%'
ORDER BY updated_at DESC;
`;

    console.log('=== Hittar Nelly-granskningar ===');
    const raw = await exec(
        `docker exec granskningsverktyget-db psql -U granskning -d granskningsverktyget_test -t -A -c ${JSON.stringify(find_sql.replace(/\n/g, ' '))}`
    );
    const audit_ids = (raw || '').trim().split('\n').map((line) => line.trim()).filter(Boolean);
    if (audit_ids.length === 0) {
        console.log('Inga Nelly-granskningar hittades.');
        return;
    }

    for (const audit_id of audit_ids) {
        console.log(`\n--- Rensar granskning ${audit_id} ---`);

        const snap_count_raw = await exec(
            `docker exec granskningsverktyget-db psql -U granskning -d granskningsverktyget_test -t -A -c ${JSON.stringify(`SELECT COUNT(*) FROM audit_snapshots WHERE audit_id='${audit_id}';`)}`
        );
        const snap_count = Number((snap_count_raw || '0').trim()) || 0;
        console.log(`Sidrapporter att ta bort: ${snap_count}`);

        await exec(
            `docker exec granskningsverktyget-db psql -U granskning -d granskningsverktyget_test -c ${JSON.stringify(`DELETE FROM audit_snapshots WHERE audit_id='${audit_id}';`)}`
        );

        await exec(
            `docker exec granskningsverktyget-db psql -U granskning -d granskningsverktyget_test -c ${JSON.stringify(`UPDATE audits SET samples='[]'::jsonb, updated_at=NOW() WHERE id='${audit_id}';`)}`
        );

        await exec(
            `rm -rf ${TEST_SERVER_ROOT}/audit-snapshots/${audit_id} 2>/dev/null || true`
        );

        console.log('Klart: granskningsdelar borttagna, sidrapporter raderade.');
    }
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => disconnect());
