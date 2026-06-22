/**
 * Engångsskript: Ta bort claudioquidral, sätt lösenord för Ilias Bennani,
 * uppdatera alla användarnamn till tre första i för- och efternamn (gemener).
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { query } from '../db.js';

function generate_username_from_name(full_name) {
    if (!full_name || typeof full_name !== 'string') return '';
    const parts = full_name.trim().split(/\s+/);
    const first = (parts[0] || '').toLowerCase().slice(0, 3);
    const last = (parts.length > 1 ? parts.slice(1).join(' ') : '').toLowerCase().slice(0, 3);
    return (first + last).replace(/\s+/g, '') || '';
}

async function main() {
    try {
        // 1. Ta bort användaren claudioquidral (Claudio Quidral)
        const del = await query(
            "DELETE FROM users WHERE username = 'claudioquidral' RETURNING id, username, name"
        );
        if (del.rows.length > 0) {
            console.log('Borttagen användare:', del.rows[0].username, del.rows[0].name);
        } else {
            console.log('Användaren claudioquidral fanns inte (redan borttagen?).');
        }

        // 2. Sätt lösenord för iliasbennani till erikbebis
        const hash = await bcrypt.hash('erikbebis', 10);
        const pwd = await query(
            "UPDATE users SET password = $1 WHERE username = 'iliasbennani' RETURNING id, username, name",
            [hash]
        );
        if (pwd.rows.length > 0) {
            console.log('Lösenord satt för:', pwd.rows[0].name, '(' + pwd.rows[0].username + ')');
        } else {
            console.log('Användaren iliasbennani hittades inte.');
        }

        // 3. Uppdatera alla användarnamn: tre första i förnamn + tre första i efternamn, gemener
        const res = await query('SELECT id, name, username FROM users ORDER BY name');
        const users = res.rows || [];
        const used = new Set();

        for (const user of users) {
            let newUsername = generate_username_from_name(user.name);
            if (!newUsername) {
                console.warn('Hoppar över (kunde inte generera användarnamn):', user.name);
                continue;
            }
            let candidate = newUsername;
            let n = 1;
            while (used.has(candidate)) {
                candidate = newUsername + String(n);
                n++;
            }
            used.add(candidate);

            if (candidate !== user.username) {
                await query('UPDATE users SET username = $1 WHERE id = $2', [candidate, user.id]);
                console.log(user.name, ':', user.username, '->', candidate);
            }
        }

        console.log('Klart.');
        process.exit(0);
    } catch (err) {
        console.error('Fel:', err.message);
        process.exit(1);
    }
}

main();
