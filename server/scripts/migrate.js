// server/scripts/migrate.js
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connectionString = process.env.DATABASE_URL || 'postgresql://granskning:granskning@localhost:5432/granskningsverktyget';

async function migrate() {
    const client = new pg.Client({ connectionString });
    try {
        await client.connect();
        const sql1 = readFileSync(join(__dirname, '../migrations/001_initial.sql'), 'utf8');
        await client.query(sql1);
        console.log('[Migrate] Migration 001 kördes.');
        const sql2 = readFileSync(join(__dirname, '../migrations/002_add_rule_file_content_to_audits.sql'), 'utf8');
        await client.query(sql2);
        console.log('[Migrate] Migration 002 kördes.');
    } catch (err) {
        console.error('[Migrate] Fel:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();
