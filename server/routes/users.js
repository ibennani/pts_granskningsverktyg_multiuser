// server/routes/users.js
import express from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db.js';
import { requireAdmin } from '../auth/middleware.js';

const router = express.Router();

function generate_reset_code(length = 10) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i += 1) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

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

function bump_last_character(value) {
    if (!value) return '';
    const str = String(value);
    const last_index = str.length - 1;
    const last_char = str.charAt(last_index);
    const prefix = str.slice(0, last_index);

    if (last_char >= 'a' && last_char <= 'z') {
        if (last_char === 'z') {
            return `${prefix}a`;
        }
        return `${prefix}${String.fromCharCode(last_char.charCodeAt(0) + 1)}`;
    }
    if (last_char >= 'A' && last_char <= 'Z') {
        if (last_char === 'Z') {
            return `${prefix}A`;
        }
        return `${prefix}${String.fromCharCode(last_char.charCodeAt(0) + 1)}`;
    }
    return `${str}a`;
}

router.get('/me', async (req, res) => {
    try {
        const user = req.user;
        const result = await query(
            'SELECT id, name, is_admin, language_preference, theme_preference, review_sort_preference, created_at FROM users WHERE id = $1 LIMIT 1',
            [user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Användare hittades inte' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[users] GET /me error:', err);
        res.status(500).json({ error: 'Kunde inte hämta användare' });
    }
});

router.patch('/me', async (req, res) => {
    try {
        const user = req.user;
        const { language_preference, theme_preference, review_sort_preference } = req.body;
        const updates = [];
        const values = [];
        let i = 1;
        if (language_preference !== undefined) {
            updates.push(`language_preference = $${i++}`);
            values.push(language_preference === null || language_preference === '' ? null : String(language_preference).trim());
        }
        if (theme_preference !== undefined) {
            updates.push(`theme_preference = $${i++}`);
            values.push(theme_preference === null || theme_preference === '' ? null : String(theme_preference).trim());
        }
        if (review_sort_preference !== undefined) {
            const valid = ['by_criteria', 'by_sample'];
            const val = valid.includes(review_sort_preference) ? review_sort_preference : 'by_criteria';
            updates.push(`review_sort_preference = $${i++}`);
            values.push(val);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'Ingen data att uppdatera' });
        }
        values.push(user.id);
        const result = await query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, name, language_preference, theme_preference, review_sort_preference`,
            values
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Användare hittades inte' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[users] PATCH /me error:', err);
        res.status(500).json({ error: 'Kunde inte uppdatera användare' });
    }
});

router.get('/', requireAdmin, async (_req, res) => {
    try {
        const result = await query('SELECT id, username, name, is_admin, created_at FROM users ORDER BY username, name');
        res.json(result.rows);
    } catch (err) {
        console.error('[users] GET error:', err);
        res.status(500).json({ error: 'Kunde inte hämta användare' });
    }
});

router.post('/', requireAdmin, async (req, res) => {
    try {
        const { username, first_name, last_name, name, is_admin, password } = req.body || {};

        const name_raw = typeof name === 'string' ? name.trim() : '';
        let first_name_trimmed = typeof first_name === 'string' ? first_name.trim() : '';
        let last_name_trimmed = typeof last_name === 'string' ? last_name.trim() : '';

        if (name_raw) {
            const normalized = name_raw.replace(/\s+/g, ' ').trim();
            const parts = normalized.split(/\s+/);
            first_name_trimmed = parts[0] || '';
            last_name_trimmed = parts.length > 1 ? parts[parts.length - 1] : '';
        }

        if (!first_name_trimmed || !last_name_trimmed) {
            return res.status(400).json({ error: 'Förnamn och efternamn krävs' });
        }

        const username_provided = typeof username === 'string' && username.trim() !== '';
        let username_final = username_provided ? username.trim() : generate_username_from_names(first_name_trimmed, last_name_trimmed);
        username_final = username_final.toLowerCase();
        if (!username_final) {
            return res.status(400).json({ error: 'Användarnamn krävs' });
        }

        if (!username_provided) {
            let candidate = username_final;
            // Begränsa antalet försök för att undvika evig loop
            for (let i = 0; i < 26; i += 1) {
                const existing = await query('SELECT 1 FROM users WHERE username = $1 LIMIT 1', [candidate]);
                if (existing.rows.length === 0) {
                    username_final = candidate;
                    break;
                }
                candidate = bump_last_character(candidate);
            }
        }

        const full_name = `${first_name_trimmed} ${last_name_trimmed}`.replace(/\s+/g, ' ').trim();
        const is_admin_bool = !!is_admin;

        let password_hash = null;
        if (password != null && typeof password === 'string' && password.trim() !== '') {
            password_hash = await bcrypt.hash(password.trim(), 10);
        }
        const result = await query(
            'INSERT INTO users (username, name, is_admin, password) VALUES ($1, $2, $3, $4) RETURNING id, username, name, is_admin, created_at',
            [username_final, full_name, is_admin_bool, password_hash]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[users] POST error:', err);
        if (err && err.code === '23505') {
            return res.status(409).json({ error: 'Användarnamnet är redan upptaget' });
        }
        res.status(500).json({ error: 'Kunde inte skapa användare' });
    }
});

router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { username, first_name, last_name, name, is_admin } = req.body || {};

        const updates = [];
        const values = [];
        let i = 1;

        if (username !== undefined) {
            const username_trimmed = typeof username === 'string' ? username.trim() : '';
            if (!username_trimmed) {
                return res.status(400).json({ error: 'Användarnamn krävs' });
            }
            updates.push(`username = $${i++}`);
            values.push(username_trimmed);
        }

        const has_first = first_name !== undefined;
        const has_last = last_name !== undefined;
        const has_name = name !== undefined;
        if (has_name) {
            const name_raw = typeof name === 'string' ? name.trim() : '';
            const normalized = name_raw.replace(/\s+/g, ' ').trim();
            const parts = normalized.split(/\s+/);
            if (parts.length < 2) {
                return res.status(400).json({ error: 'Förnamn och efternamn krävs' });
            }
            updates.push(`name = $${i++}`);
            values.push(normalized);
        } else if (has_first || has_last) {
            const first_name_trimmed = has_first && typeof first_name === 'string' ? first_name.trim() : '';
            const last_name_trimmed = has_last && typeof last_name === 'string' ? last_name.trim() : '';
            if (!first_name_trimmed || !last_name_trimmed) {
                return res.status(400).json({ error: 'Förnamn och efternamn krävs' });
            }
            const full_name = `${first_name_trimmed} ${last_name_trimmed}`.replace(/\s+/g, ' ').trim();
            updates.push(`name = $${i++}`);
            values.push(full_name);
        }

        if (is_admin !== undefined) {
            const is_admin_bool = !!is_admin;
            updates.push(`is_admin = $${i++}`);
            values.push(is_admin_bool);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Ingen data att uppdatera' });
        }

        values.push(id);
        const result = await query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, username, name, is_admin, created_at`,
            values
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Användare hittades inte' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[users] PUT /:id error:', err);
        if (err && err.code === '23505') {
            return res.status(409).json({ error: 'Användarnamnet är redan upptaget' });
        }
        res.status(500).json({ error: 'Kunde inte uppdatera användare' });
    }
});

router.post('/:id/password-reset-codes', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { expires_in_minutes } = req.body || {};
        const minutes = Number.isFinite(Number(expires_in_minutes)) && Number(expires_in_minutes) > 0
            ? Math.min(Number(expires_in_minutes), 240)
            : 15;

        const userResult = await query(
            'SELECT id, username, name FROM users WHERE id::text = $1 OR username = $1 OR name = $1 LIMIT 1',
            [id]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Användare hittades inte' });
        }

        const code = generate_reset_code(10);
        const hash = await bcrypt.hash(code, 10);
        const expiresAtResult = await query('SELECT (NOW() + ($1 || \' minutes\')::interval) AS expires_at', [minutes]);
        const expires_at = expiresAtResult.rows[0].expires_at;

        await query(
            `INSERT INTO password_reset_tokens (user_id, code_hash, expires_at)
             VALUES ($1, $2, $3)`,
            [userResult.rows[0].id, hash, expires_at]
        );

        return res.status(201).json({
            code,
            expires_at
        });
    } catch (err) {
        console.error('[users] POST /:id/password-reset-codes error:', err);
        return res.status(500).json({ error: 'Kunde inte skapa engångskod' });
    }
});

router.put('/:id/password', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        if (!password || typeof password !== 'string' || password.trim() === '') {
            return res.status(400).json({ error: 'Lösenord krävs' });
        }
        const hash = await bcrypt.hash(password.trim(), 10);
        const result = await query(
            'UPDATE users SET password = $1 WHERE id = $2 RETURNING id, name, is_admin, created_at',
            [hash, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Användare hittades inte' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[users] PUT password error:', err);
        res.status(500).json({ error: 'Kunde inte uppdatera lösenord' });
    }
});

router.get('/:id/audit-count', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const userResult = await query('SELECT id, name FROM users WHERE id = $1', [id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Användare hittades inte' });
        }

        const user_name = userResult.rows[0].name;
        const auditResult = await query(
            "SELECT COUNT(*) AS count FROM audits WHERE metadata->>'auditorName' = $1",
            [user_name]
        );
        const raw_count = auditResult.rows[0] && auditResult.rows[0].count;
        const audit_count = Number.isFinite(Number(raw_count)) ? Number(raw_count) : 0;

        res.json({ audit_count });
    } catch (err) {
        console.error('[users] GET /:id/audit-count error:', err);
        res.status(500).json({ error: 'Kunde inte hämta antal granskningar' });
    }
});

router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Användare hittades inte' });
        }
        res.status(204).send();
    } catch (err) {
        console.error('[users] DELETE error:', err);
        res.status(500).json({ error: 'Kunde inte ta bort användare' });
    }
});

export default router;
