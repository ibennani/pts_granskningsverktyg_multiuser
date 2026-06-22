import 'dotenv/config';
import { query } from '../db.js';

async function main() {
    try {
        const username = process.argv[2];
        const is_admin_flag = process.argv[3];
        if (!username) {
            console.error('Användarnamn (username) krävs som första argument.');
            process.exit(1);
        }
        const make_admin = String(is_admin_flag || 'true').toLowerCase() === 'true';
        await query('UPDATE users SET is_admin = $1 WHERE username = $2', [make_admin, username]);
        const res = await query('SELECT id, username, name, is_admin FROM users WHERE username = $1', [username]);
        if (res.rows.length === 0) {
            console.error(`Ingen användare med användarnamn "${username}" hittades.`);
            process.exit(1);
        }
        console.log(JSON.stringify(res.rows[0], null, 2));
        process.exit(0);
    } catch (err) {
        console.error('[set_user_admin] Fel:', err?.message || err);
        process.exit(1);
    }
}

main();

