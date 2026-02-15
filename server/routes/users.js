// server/routes/users.js
import express from 'express';
import { query } from '../db.js';

const router = express.Router();

router.get('/', async (_req, res) => {
    try {
        const result = await query('SELECT id, name, is_admin, created_at FROM users ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error('[users] GET error:', err);
        res.status(500).json({ error: 'Kunde inte hämta användare' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Namn krävs' });
        }
        const result = await query(
            'INSERT INTO users (name) VALUES ($1) RETURNING id, name, is_admin, created_at',
            [name.trim()]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[users] POST error:', err);
        res.status(500).json({ error: 'Kunde inte skapa användare' });
    }
});

router.delete('/:id', async (req, res) => {
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
