// server/routes/users.js
import express from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db.js';
import { requireAdmin } from '../auth/middleware.js';

const router = express.Router();

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

router.get('/', async (_req, res) => {
    try {
        const result = await query('SELECT id, name, is_admin, created_at FROM users ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error('[users] GET error:', err);
        res.status(500).json({ error: 'Kunde inte hämta användare' });
    }
});

router.post('/', requireAdmin, async (req, res) => {
    try {
        const { name, password } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Namn krävs' });
        }
        let password_hash = null;
        if (password != null && typeof password === 'string' && password.trim() !== '') {
            password_hash = await bcrypt.hash(password.trim(), 10);
        }
        const result = await query(
            'INSERT INTO users (name, password) VALUES ($1, $2) RETURNING id, name, is_admin, created_at',
            [name.trim(), password_hash]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[users] POST error:', err);
        res.status(500).json({ error: 'Kunde inte skapa användare' });
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
