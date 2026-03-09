// server/routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db.js';
import { sign_token } from '../auth/jwt.js';
import { login_rate_limiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/login', login_rate_limiter, async (req, res) => {
    try {
        const { username, name, password } = req.body || {};

        const login_identifier = typeof username === 'string' && username.trim()
            ? username.trim()
            : (typeof name === 'string' && name.trim() ? name.trim() : '');

        if (!login_identifier) {
            return res.status(400).json({ error: 'Användarnamn krävs' });
        }
        if (!password || typeof password !== 'string') {
            return res.status(400).json({ error: 'Lösenord krävs' });
        }
        const result = await query(
            'SELECT id, name, is_admin, password FROM users WHERE username = $1 LIMIT 1',
            [login_identifier]
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

router.post('/reset-password', async (req, res) => {
    try {
        const { code, password } = req.body || {};
        if (!code || typeof code !== 'string' || !code.trim()) {
            return res.status(400).json({ error: 'Återställningskod krävs' });
        }
        if (!password || typeof password !== 'string' || password.trim().length < 8) {
            return res.status(400).json({ error: 'Lösenordet måste vara minst 8 tecken' });
        }

        const tokensResult = await query(
            `SELECT t.id, t.user_id, t.code_hash, t.expires_at, t.used_at, u.name, u.is_admin
             FROM password_reset_tokens t
             JOIN users u ON u.id = t.user_id
             WHERE t.used_at IS NULL AND t.expires_at > NOW()`,
            []
        );

        let matched = null;
        for (let i = 0; i < tokensResult.rows.length; i += 1) {
            const ok = await bcrypt.compare(code.trim(), tokensResult.rows[i].code_hash);
            if (ok) {
                matched = tokensResult.rows[i];
                break;
            }
        }

        if (!matched) {
            return res.status(400).json({ error: 'Ogiltig eller utgången återställningskod' });
        }

        const newHash = await bcrypt.hash(password.trim(), 10);
        await query('UPDATE users SET password = $1 WHERE id = $2', [newHash, matched.user_id]);
        await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [matched.id]);

        const token = sign_token({
            id: matched.user_id,
            name: matched.name,
            is_admin: !!matched.is_admin
        });
        return res.json({ token });
    } catch (err) {
        console.error('[auth] reset-password error:', err);
        return res.status(500).json({ error: 'Återställning av lösenord misslyckades' });
    }
});

export default router;
