#!/usr/bin/env node
/**
 * Verifierar sidrapportlistan för Apohem-granskningen via API på testservern.
 */
import { exec, disconnect } from './deploy-utils.js';

const APOHEM_AUDIT_ID = 'd2029bf0-538a-40e1-916d-cc0ae266012b';

async function main() {
    try {
        const output = await exec(
            `cd /var/www/granskningsverktyget-test-server && node --input-type=module -e "
import { build_audit_snapshot_list } from './server/services/audit_snapshot_list_service.ts';
import { query } from './server/db.js';

const audit_id = '${APOHEM_AUDIT_ID}';
const audit = await query('SELECT samples FROM audits WHERE id = $1', [audit_id]);
const samples = Array.isArray(audit.rows[0]?.samples) ? audit.rows[0].samples : [];
const items = await build_audit_snapshot_list(audit_id, samples);
const summary = items.map((item) => ({
    sampleId: item.sampleId,
    description: item.sampleDescription ?? null,
    ready: item.currentReady?.status ?? null,
    pending: item.pendingAttempt?.status ?? null,
    pendingError: item.pendingAttempt?.error ?? null,
}));
console.log(JSON.stringify({ count: summary.length, items: summary }, null, 2));
process.exit(0);
"`,
            { capture: true }
        );
        console.log(output);

        const parsed = JSON.parse(output.trim());
        const failed_visible = parsed.items.filter((item) => item.pending === 'failed');
        if (failed_visible.length > 0) {
            console.error('FAIL: Sidrapporter visas som misslyckade trots färdig status:', failed_visible);
            process.exit(1);
        }
        const without_ready = parsed.items.filter((item) => !item.ready && item.pending !== 'queued' && item.pending !== 'capturing' && item.pending !== 'packaging');
        const url_samples = parsed.items.filter((item) => item.description || item.sampleId);
        console.log('OK: Inga felaktigt visade misslyckanden.');
        console.log('Färdiga sidrapporter:', parsed.items.filter((item) => item.ready === 'ready').length, 'av', parsed.count);
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
