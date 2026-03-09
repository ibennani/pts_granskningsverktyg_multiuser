import 'dotenv/config';
import { query } from '../db.js';

async function main() {
    try {
        const name = process.argv[2];
        const is_admin_flag = process.argv[3];
        if (!name) {
            console.error('Användarnamn krävs som första argument.');
            process.exit(1);
        }
        const make_admin = String(is_admin_flag || 'true').toLowerCase() === 'true';
        await query('UPDATE users SET is_admin = $1 WHERE name = $2', [make_admin, name]);
        const res = await query('SELECT id, name, is_admin FROM users WHERE name = $1', [name]);
        if (res.rows.length === 0) {
            console.error(`Ingen användare med namn "${name}" hittades.`);
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

