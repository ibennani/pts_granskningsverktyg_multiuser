// Simulerar serverns GET /audits/:id – hämtar samma rad och räknar kört-fast i row.samples.
// Kör: node scripts/debug_get_audit.js
import pg from 'pg';

const AUDIT_ID = '91a37304-6a00-42cf-83a6-7bbe1eeb7883';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://granskning:granskning@localhost:5432/granskningsverktyget'
});

function count_stuck_in_samples(samples) {
    if (!samples || !Array.isArray(samples)) return 0;
    let n = 0;
    samples.forEach((s) => {
        const results = s?.requirementResults || {};
        Object.values(results).forEach((r) => {
            const t = (r?.stuckProblemDescription || '').trim();
            if (t !== '') n += 1;
        });
    });
    return n;
}

async function run() {
    // Samma som servern: SELECT * (eller id, rule_set_id, samples)
    const result = await pool.query('SELECT id, rule_set_id, samples FROM audits WHERE id = $1', [AUDIT_ID]);
    if (result.rows.length === 0) {
        console.log('Audit hittades inte');
        await pool.end();
        return;
    }
    const row = result.rows[0];
    const stuck = count_stuck_in_samples(row.samples);
    console.log('GET /audits/:id – rad från DB (parsad av node-pg):');
    console.log('  audit id:', row.id);
    console.log('  rule_set_id:', row.rule_set_id);
    console.log('  samples är array:', Array.isArray(row.samples));
    console.log('  samples.length:', row.samples?.length);
    console.log('  kört-fast i row.samples:', stuck);

    // Räkna i SQL på samma rad (så som count_stuck_in_db gör)
    const countResult = await pool.query(
        `SELECT COUNT(*) AS n FROM jsonb_array_elements(COALESCE((SELECT samples FROM audits WHERE id = $1), '[]'::jsonb)) AS sample, jsonb_each(COALESCE(sample->'requirementResults', '{}'::jsonb)) AS req_entry WHERE NULLIF(TRIM(req_entry.value->>'stuckProblemDescription'), '') IS NOT NULL`,
        [AUDIT_ID]
    );
    const sql_count = parseInt(countResult.rows[0].n, 10);
    console.log('  kört-fast enligt SQL (samma rad):', sql_count);

    // Hämta samples som text och räkna manuellt
    const rawResult = await pool.query('SELECT samples::text AS samples_text FROM audits WHERE id = $1', [AUDIT_ID]);
    const rawText = rawResult.rows[0]?.samples_text || '';
    const occurrences = (rawText.match(/stuckProblemDescription/g) || []).length;
    console.log('  förekomster av "stuckProblemDescription" i raw JSON-text:', occurrences);
    if (rawText.length < 500) {
        console.log('  raw samples (kort):', rawText);
    } else {
        console.log('  raw samples längd:', rawText.length, 'tecken');
    }
    await pool.end();
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
