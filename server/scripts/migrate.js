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
        const sql3 = readFileSync(join(__dirname, '../migrations/003_add_default_users.sql'), 'utf8');
        await client.query(sql3);
        console.log('[Migrate] Migration 003 kördes.');
        const sql4 = readFileSync(join(__dirname, '../migrations/004_remove_admin_user.sql'), 'utf8');
        await client.query(sql4);
        console.log('[Migrate] Migration 004 kördes.');
        const sql5 = readFileSync(join(__dirname, '../migrations/005_add_user_preferences.sql'), 'utf8');
        await client.query(sql5);
        console.log('[Migrate] Migration 005 kördes.');
        const sql6 = readFileSync(join(__dirname, '../migrations/006_add_review_sort_preference.sql'), 'utf8');
        await client.query(sql6);
        console.log('[Migrate] Migration 006 kördes.');
        const sql7 = readFileSync(join(__dirname, '../migrations/007_review_sort_default_by_criteria.sql'), 'utf8');
        await client.query(sql7);
        console.log('[Migrate] Migration 007 kördes.');
        const sql8 = readFileSync(join(__dirname, '../migrations/008_disconnect_audits_from_rule_sets.sql'), 'utf8');
        await client.query(sql8);
        console.log('[Migrate] Migration 008 kördes.');
        const sql9 = readFileSync(join(__dirname, '../migrations/009_add_published_content_to_rule_sets.sql'), 'utf8');
        await client.query(sql9);
        console.log('[Migrate] Migration 009 kördes.');
        const sql10 = readFileSync(join(__dirname, '../migrations/010_add_production_base_id_to_rule_sets.sql'), 'utf8');
        await client.query(sql10);
        console.log('[Migrate] Migration 010 kördes.');
        const sql11 = readFileSync(join(__dirname, '../migrations/011_add_archived_and_rulefile_update_log_to_audits.sql'), 'utf8');
        await client.query(sql11);
        console.log('[Migrate] Migration 011 kördes.');
        const sql12 = readFileSync(join(__dirname, '../migrations/012_add_password_to_users.sql'), 'utf8');
        await client.query(sql12);
        console.log('[Migrate] Migration 012 kördes.');
        const sql13 = readFileSync(join(__dirname, '../migrations/013_add_password_reset_tokens.sql'), 'utf8');
        await client.query(sql13);
        console.log('[Migrate] Migration 013 kördes.');
        const sql14 = readFileSync(join(__dirname, '../migrations/014_add_username_to_users.sql'), 'utf8');
        await client.query(sql14);
        console.log('[Migrate] Migration 014 kördes.');
        const sql15 = readFileSync(join(__dirname, '../migrations/015_seed_users_if_empty.sql'), 'utf8');
        await client.query(sql15);
        console.log('[Migrate] Migration 015 kördes.');
        const sql16 = readFileSync(join(__dirname, '../migrations/016_add_content_updated_at_to_rule_sets.sql'), 'utf8');
        await client.query(sql16);
        console.log('[Migrate] Migration 016 kördes.');
    } catch (err) {
        console.error('[Migrate] Fel:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();
