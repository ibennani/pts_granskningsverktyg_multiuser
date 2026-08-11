/**
 * @fileoverview Städar snapshots som saknar motsvarande granskningsdel i granskningen.
 *
 * Kör: npx tsx scripts/cleanup_orphan_audit_snapshots.mjs
 * Valfritt: AUDIT_ID=<uuid> för en granskning, DRY_RUN=1 för rapport utan radering.
 */
import { query } from '../server/db.js';
import { purge_orphan_audit_snapshots } from '../server/services/audit_snapshot_cleanup_service.ts';

async function list_audit_ids() {
    const result = await query('SELECT id FROM audits ORDER BY updated_at DESC');
    return result.rows.map((row) => String(row.id));
}

function sample_ids_from_row(samples) {
    if (!Array.isArray(samples)) return [];
    return samples.map((s) => String(s?.id ?? '')).filter(Boolean);
}

async function main() {
    const dry_run = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
    const only_audit_id = process.env.AUDIT_ID?.trim() || null;
    const audit_ids = only_audit_id ? [only_audit_id] : await list_audit_ids();

    let total_removed = 0;
    for (const audit_id of audit_ids) {
        const result = await query('SELECT samples FROM audits WHERE id = $1', [audit_id]);
        if (result.rows.length === 0) {
            console.warn(`[cleanup-orphan-snapshots] Granskning ${audit_id} hittades inte, hoppar över.`);
            continue;
        }
        const valid_ids = sample_ids_from_row(result.rows[0].samples);
        if (dry_run) {
            const orphan_result = await query(
                valid_ids.length === 0
                    ? `SELECT id, sample_id, status FROM audit_snapshots WHERE audit_id = $1`
                    : `SELECT id, sample_id, status FROM audit_snapshots
                       WHERE audit_id = $1 AND sample_id <> ALL($2::text[])`,
                valid_ids.length === 0 ? [audit_id] : [audit_id, valid_ids]
            );
            if (orphan_result.rows.length > 0) {
                console.log(
                    `[cleanup-orphan-snapshots] ${audit_id}: ${orphan_result.rows.length} orphan-rader (dry run)`
                );
                for (const row of orphan_result.rows) {
                    console.log(`  - ${row.id} sample=${row.sample_id} status=${row.status}`);
                }
                total_removed += orphan_result.rows.length;
            }
            continue;
        }
        const removed = await purge_orphan_audit_snapshots(audit_id, valid_ids);
        if (removed > 0) {
            console.log(`[cleanup-orphan-snapshots] ${audit_id}: tog bort ${removed} snapshot-rader`);
            total_removed += removed;
        }
    }

    console.log(
        `[cleanup-orphan-snapshots] Klart. ${dry_run ? 'Skulle ta bort' : 'Tog bort'} ${total_removed} snapshot-rader totalt.`
    );
}

main().catch((err) => {
    console.error('[cleanup-orphan-snapshots] Fel:', err);
    process.exit(1);
});
