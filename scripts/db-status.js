#!/usr/bin/env node
// Kontrollerar databasens status och visar antal regelfiler/granskningar.
import 'dotenv/config';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://granskning:granskning@localhost:5432/granskningsverktyget';

async function status() {
    const client = new pg.Client({ connectionString });
    try {
        await client.connect();
        const rules = await client.query('SELECT COUNT(*) FROM rule_sets');
        const audits = await client.query('SELECT COUNT(*) FROM audits');
        const auditsWithRule = await client.query(
            'SELECT COUNT(*) FROM audits WHERE rule_set_id IS NOT NULL'
        );
        const orphaned = await client.query(
            'SELECT COUNT(*) FROM audits a LEFT JOIN rule_sets r ON a.rule_set_id = r.id WHERE a.rule_set_id IS NOT NULL AND r.id IS NULL'
        );
        console.log('[db-status] Databas: ansluten');
        console.log('[db-status] Regelfiler:', rules.rows[0].count);
        console.log('[db-status] Granskningar:', audits.rows[0].count);
        console.log('[db-status] Granskningar med regelfil:', auditsWithRule.rows[0].count);
        if (parseInt(orphaned.rows[0].count, 10) > 0) {
            console.warn('[db-status] Varning: Granskningar utan giltig regelfil:', orphaned.rows[0].count);
        }
    } catch (err) {
        console.error('[db-status] Kunde inte ansluta:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

status();
