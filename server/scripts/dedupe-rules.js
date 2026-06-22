#!/usr/bin/env node
// Rensar dubletter i rule_sets. Behåller äldsta, uppdaterar audits, tar bort resten.
import 'dotenv/config';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://granskning:granskning@localhost:5432/granskningsverktyget';

async function dedupe() {
    const client = new pg.Client({ connectionString });
    try {
        await client.connect();

        const dupPairs = await client.query(`
            WITH ranked AS (
                SELECT id, name, content, created_at,
                       ROW_NUMBER() OVER (PARTITION BY content ORDER BY created_at ASC) AS rn
                FROM rule_sets
            ),
            duplicates AS (SELECT * FROM ranked WHERE rn > 1),
            keepers AS (SELECT id, content FROM ranked WHERE rn = 1)
            SELECT d.id AS dup_id, d.name AS dup_name, k.id AS keep_id
            FROM duplicates d
            JOIN keepers k ON k.content = d.content
        `);

        if (dupPairs.rows.length === 0) {
            console.log('[Dedupe] Inga dubletter hittades.');
            return;
        }

        console.log(`[Dedupe] Hittade ${dupPairs.rows.length} dublett(er) att ta bort.`);

        for (const row of dupPairs.rows) {
            const { dup_id, dup_name, keep_id } = row;
            console.log(`[Dedupe] Behåller ${keep_id}, tar bort ${dup_id} (${dup_name}).`);
            await client.query(
                'UPDATE audits SET rule_set_id = $1 WHERE rule_set_id = $2',
                [keep_id, dup_id]
            );
            await client.query('DELETE FROM rule_sets WHERE id = $1', [dup_id]);
        }

        console.log('[Dedupe] Klar.');
    } catch (err) {
        console.error('[Dedupe] Fel:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

dedupe();
