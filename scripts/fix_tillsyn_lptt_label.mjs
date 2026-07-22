/**
 * Uppdaterar sparad auditTypeLabel "Tillsyn, LPTT" → "Tillsyn LPTT" i lokala granskningar.
 * Kör: node scripts/fix_tillsyn_lptt_label.mjs
 *      node scripts/fix_tillsyn_lptt_label.mjs --dry-run
 */
import pg from 'pg';

const DRY_RUN = process.argv.includes('--dry-run');
const OLD_LABEL = 'Tillsyn, LPTT';
const NEW_LABEL = 'Tillsyn LPTT';

const pool = new pg.Pool({
    connectionString:
        process.env.DATABASE_URL ||
        'postgresql://granskning:granskning@localhost:5432/granskningsverktyget',
});

async function run() {
    const preview = await pool.query(
        `SELECT id FROM audits
         WHERE metadata->>'auditTypeLabel' = $1
            OR metadata->>'auditTypeLabel' LIKE $2`,
        [OLD_LABEL, '%Tillsyn,%']
    );

    console.log(
        `Hittade ${preview.rows.length} granskningar med gammal etikett${DRY_RUN ? ' (torrkörning)' : ''}.`
    );

    if (preview.rows.length === 0) {
        await pool.end();
        return;
    }

    if (DRY_RUN) {
        for (const row of preview.rows) {
            console.log(`  WOULD UPDATE ${row.id}`);
        }
        await pool.end();
        return;
    }

    const result = await pool.query(
        `UPDATE audits
         SET metadata = jsonb_set(metadata, '{auditTypeLabel}', to_jsonb($1::text), true)
         WHERE metadata->>'auditTypeLabel' = $2`,
        [NEW_LABEL, OLD_LABEL]
    );

    console.log(`Uppdaterade ${result.rowCount} rader till "${NEW_LABEL}".`);
    await pool.end();
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
