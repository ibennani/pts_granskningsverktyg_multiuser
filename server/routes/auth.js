// server/routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db.js';
import { sign_token } from '../auth/jwt.js';

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { name, password } = req.body || {};
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Användarnamn krävs' });
        }
        if (!password || typeof password !== 'string') {
            return res.status(400).json({ error: 'Lösenord krävs' });
        }
        const result = await query(
            'SELECT id, name, is_admin, password FROM users WHERE name = $1 LIMIT 1',
            [name.trim()]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Fel användarnamn eller lösenord' });
        }
        const row = result.rows[0];
        const stored_hash = row.password;
        if (!stored_hash) {
            return res.status(401).json({ error: 'Användaren har inget lösenord satt. Kontakta administratör.' });
        }
        const match = await bcrypt.compare(password, stored_hash);
        if (!match) {
            return res.status(401).json({ error: 'Fel användarnamn eller lösenord' });
        }
        const token = sign_token({
            id: row.id,
            name: row.name,
            is_admin: !!row.is_admin
        });
        res.json({ token });
    } catch (err) {
        console.error('[auth] login error:', err);
        res.status(500).json({ error: 'Inloggning misslyckades' });
    }
});

export default router;
