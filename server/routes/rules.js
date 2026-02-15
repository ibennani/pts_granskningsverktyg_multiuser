// server/routes/rules.js
import express from 'express';
import { query } from '../db.js';

const router = express.Router();

router.get('/', async (_req, res) => {
    try {
        const result = await query(
            'SELECT id, name, version, created_at, updated_at FROM rule_sets ORDER BY updated_at DESC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[rules] GET list error:', err);
        res.status(500).json({ error: 'Kunde inte hämta regelfiler' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('SELECT * FROM rule_sets WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Regelfil hittades inte' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[rules] GET one error:', err);
        res.status(500).json({ error: 'Kunde inte hämta regelfil' });
    }
});

router.get('/:id/export', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('SELECT id, name, content, version FROM rule_sets WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Regelfil hittades inte' });
        }
        res.setHeader('Content-Disposition', `attachment; filename="regelfil_${id}.json"`);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[rules] export error:', err);
        res.status(500).json({ error: 'Kunde inte exportera' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, content } = req.body;
        if (!content || typeof content !== 'object') {
            return res.status(400).json({ error: 'Content krävs' });
        }
        const ruleName = name || 'Regelfil ' + new Date().toISOString().slice(0, 10);
        const result = await query(
            'INSERT INTO rule_sets (name, content) VALUES ($1, $2) RETURNING *',
            [ruleName, JSON.stringify(content)]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[rules] POST error:', err);
        res.status(500).json({ error: 'Kunde inte skapa regelfil' });
    }
});

router.post('/import', async (req, res) => {
    try {
        const { name, content } = req.body;
        if (!content || typeof content !== 'object') {
            return res.status(400).json({ error: 'Content krävs' });
        }
        const ruleName = name || 'Importerad ' + new Date().toISOString().slice(0, 10);
        const result = await query(
            'INSERT INTO rule_sets (name, content) VALUES ($1, $2) RETURNING *',
            [ruleName, JSON.stringify(content)]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[rules] import error:', err);
        res.status(500).json({ error: 'Kunde inte importera' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, content } = req.body;
        const updates = [];
        const values = [];
        let i = 1;
        if (name !== undefined) {
            updates.push(`name = $${i++}`);
            values.push(name);
        }
        if (content !== undefined) {
            updates.push(`content = $${i++}`);
            values.push(JSON.stringify(content));
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'Ingen data att uppdatera' });
        }
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);
        const result = await query(
            `UPDATE rule_sets SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
            values
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Regelfil hittades inte' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[rules] PUT error:', err);
        res.status(500).json({ error: 'Kunde inte uppdatera regelfil' });
    }
});

export default router;
