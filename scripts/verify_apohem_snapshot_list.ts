/**
 * @fileoverview Verifierar sidrapportlistan för Apohem-granskningen på servern.
 */
import 'dotenv/config';
import { build_audit_snapshot_list } from '../server/services/audit_snapshot_list_service.ts';
import { query } from '../server/db.js';

const APOHEM_AUDIT_ID = 'd2029bf0-538a-40e1-916d-cc0ae266012b';

const audit = await query('SELECT samples FROM audits WHERE id = $1', [APOHEM_AUDIT_ID]);
const samples = Array.isArray(audit.rows[0]?.samples) ? audit.rows[0].samples : [];
const items = await build_audit_snapshot_list(APOHEM_AUDIT_ID, samples);

const summary = items.map((item) => ({
    sampleId: item.sampleId,
    description: item.sampleDescription ?? null,
    ready: item.currentReady?.status ?? null,
    pending: item.pendingAttempt?.status ?? null,
    pendingError: item.pendingAttempt?.error ?? null,
}));

console.log(JSON.stringify({ count: summary.length, items: summary }, null, 2));

const failed_visible = summary.filter((item) => item.pending === 'failed');
if (failed_visible.length > 0) {
    console.error('FAIL: Sidrapporter visas som misslyckade trots färdig status:', failed_visible);
    process.exit(1);
}

const ready_count = summary.filter((item) => item.ready === 'ready').length;
console.log(`OK: ${ready_count} av ${summary.length} sidrapporter är färdiga utan felaktigt visade misslyckanden.`);
