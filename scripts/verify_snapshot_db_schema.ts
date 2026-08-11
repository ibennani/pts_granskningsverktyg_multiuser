/**
 * @fileoverview Verifierar att audit_snapshots har warnings_json och att skrivning fungerar.
 */
import 'dotenv/config';
import pg from 'pg';

const connection_string =
    process.env.DATABASE_URL || 'postgresql://granskning:granskning@localhost:5432/granskningsverktyget';

async function main(): Promise<void> {
    const client = new pg.Client({ connectionString: connection_string });
    await client.connect();
    try {
        const column = await client.query(
            `SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'audit_snapshots'
               AND column_name = 'warnings_json'`
        );
        if (column.rows.length === 0) {
            throw new Error('Kolumnen warnings_json saknas i audit_snapshots');
        }

        await client.query('BEGIN');
        try {
            const row = await client.query('SELECT id FROM audit_snapshots LIMIT 1');
            if (row.rows.length > 0) {
                const probe = [{ code: 'schema_probe', message: 'Verifiering av warnings_json' }];
                await client.query(
                    `UPDATE audit_snapshots
                     SET warnings_json = $1::jsonb, warning_count = 1
                     WHERE id = $2`,
                    [JSON.stringify(probe), row.rows[0].id]
                );
            }
            await client.query('ROLLBACK');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }

        console.log(JSON.stringify({ ok: true, warnings_json_column: true }, null, 2));
    } finally {
        await client.end();
    }
}

main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ ok: false, error: message }, null, 2));
    process.exit(1);
});
