/**
 * Skapar eller uppdaterar lösenord för en användare direkt i databasen (utan API-token).
 * Användning: node server/scripts/create_user_cli.js <användarnamn> <lösenord> [förnamn] [efternamn]
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { query, pool } from '../db.js';

async function main() {
    const username = (process.argv[2] || '').trim().toLowerCase();
    const password = process.argv[3] ?? '';
    const first = (process.argv[4] || 'Test').trim();
    const last = (process.argv[5] || 'User').trim();

    if (!username || password === '') {
        console.error('Användning: node server/scripts/create_user_cli.js <användarnamn> <lösenord> [förnamn] [efternamn]');
        process.exit(1);
    }

    const full_name = `${first} ${last}`.replace(/\s+/g, ' ').trim();
    const password_hash = await bcrypt.hash(String(password).trim(), 10);

    const existing = await query('SELECT id FROM users WHERE username = $1 LIMIT 1', [username]);

    if (existing.rows.length > 0) {
        await query('UPDATE users SET password = $1, name = $2 WHERE username = $3', [
            password_hash,
            full_name,
            username
        ]);
        console.log(JSON.stringify({ ok: true, action: 'lösenord_och_namn_uppdaterade', username }, null, 2));
    } else {
        await query(
            'INSERT INTO users (username, name, is_admin, password) VALUES ($1, $2, $3, $4)',
            [username, full_name, false, password_hash]
        );
        console.log(JSON.stringify({ ok: true, action: 'skapad', username, name: full_name }, null, 2));
    }

    await pool.end();
    process.exit(0);
}

main().catch(async (err) => {
    console.error('[create_user_cli]', err?.message || err);
    try {
        await pool.end();
    } catch {
        /* ignoreras */
    }
    process.exit(1);
});
