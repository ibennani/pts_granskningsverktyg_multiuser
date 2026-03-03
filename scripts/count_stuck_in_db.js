// Räknar "kört fast"-poster (stuckProblemDescription) i databasen.
// Kör: node scripts/count_stuck_in_db.js
import pg from 'pg';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://granskning:granskning@localhost:5432/granskningsverktyget'
});

async function run() {
    const q = `
        SELECT
            a.id AS audit_id,
            COUNT(*) FILTER (WHERE NULLIF(TRIM(req_entry.value->>'stuckProblemDescription'), '') IS NOT NULL) AS stuck_count
        FROM audits a,
            jsonb_array_elements(COALESCE(a.samples, '[]'::jsonb)) AS sample,
            jsonb_each(COALESCE(sample->'requirementResults', '{}'::jsonb)) AS req_entry
        GROUP BY a.id
        HAVING COUNT(*) FILTER (WHERE NULLIF(TRIM(req_entry.value->>'stuckProblemDescription'), '') IS NOT NULL) > 0
    `;
    const res = await pool.query(q);
    console.log('Antal granskningar med minst en kört-fast-post:', res.rows.length);
    let total = 0;
    res.rows.forEach((r) => {
        console.log('  Audit', r.audit_id, ':', r.stuck_count, 'st');
        total += parseInt(r.stuck_count, 10);
    });
    console.log('Totalt antal kört-fast-poster:', total);

    const q2 = `SELECT COUNT(*) AS n FROM audits a, jsonb_array_elements(COALESCE(a.samples, '[]'::jsonb)) AS sample, jsonb_each(COALESCE(sample->'requirementResults', '{}'::jsonb)) AS req_entry WHERE NULLIF(TRIM(req_entry.value->>'stuckProblemDescription'), '') IS NOT NULL`;
    const r2 = await pool.query(q2);
    console.log('Verifiering totalt:', r2.rows[0].n);

    await pool.end();
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
