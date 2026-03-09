import 'dotenv/config';
import { query } from '../db.js';

function generate_username_from_names(first_name, last_name) {
    const first = typeof first_name === 'string' ? first_name.trim().toLowerCase() : '';
    const last = typeof last_name === 'string' ? last_name.trim().toLowerCase() : '';

    if (!first && !last) {
        return '';
    }

    const first_part = first.slice(0, 3);
    const last_part = last.slice(0, 3);
    const combined = `${first_part}${last_part}` || `${first}${last}`.slice(0, 6);

    return combined.replace(/\s+/g, '');
}

function generate_username_from_full_name(name) {
    if (!name) return '';
    const trimmed = String(name).trim();
    if (!trimmed) return '';

    const parts = trimmed.split(/\s+/);
    const first_name = parts[0] || '';
    const last_name = parts.length > 1 ? parts.slice(1).join(' ') : '';

    const base = generate_username_from_names(first_name, last_name) || trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '');
    return base.slice(0, 30);
}

async function main() {
    try {
        const res = await query('SELECT id, name FROM users ORDER BY id', []);
        const users = res.rows || [];
        if (users.length === 0) {
            console.log('[regenerate_usernames_from_names] Inga användare hittades.');
            process.exit(0);
        }

        const usernames = new Map();

        for (const user of users) {
            const base_raw = generate_username_from_full_name(user.name);
            if (!base_raw) {
                console.warn(`[regenerate_usernames_from_names] Kunde inte generera användarnamn för användare med id=${user.id} och name="${user.name}". Hoppar över.`);
                continue;
            }

            const base = base_raw.toLowerCase();
            let candidate = base;
            let counter = 1;

            // Säkerställ unika användarnamn inom denna körning
            while (usernames.has(candidate)) {
                counter += 1;
                const suffix = String(counter);
                const max_base_length = Math.max(1, 30 - suffix.length);
                candidate = `${base.slice(0, max_base_length)}${suffix}`;
            }

            usernames.set(candidate, user.id);
        }

        let updated_count = 0;
        for (const [username, user_id] of usernames.entries()) {
            await query('UPDATE users SET username = $1 WHERE id = $2', [username, user_id]);
            updated_count += 1;
        }

        console.log(`[regenerate_usernames_from_names] Uppdaterade användarnamn för ${updated_count} användare.`);
        process.exit(0);
    } catch (err) {
        console.error('[regenerate_usernames_from_names] Fel:', err?.message || err);
        process.exit(1);
    }
}

main();

