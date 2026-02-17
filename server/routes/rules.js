// server/routes/rules.js
import express from 'express';
import { query } from '../db.js';
import { broadcast } from '../ws.js';

const router = express.Router();

function broadcast_rules_changed() {
    broadcast({ type: 'rules:changed' });
}

router.get('/', async (_req, res) => {
    try {
        const result = await query(
            `SELECT id,
                COALESCE(NULLIF(TRIM(content->'metadata'->>'title'), ''), name) AS name,
                COALESCE(NULLIF(TRIM(content->'metadata'->>'version'), ''), version::text) AS version_display,
                content->'metadata'->>'version' AS metadata_version,
                COALESCE(NULLIF(TRIM(content->'metadata'->'monitoringType'->>'text'), ''),
                    NULLIF(TRIM(content->'metadata'->'monitoringType'->>'label'), '')) AS monitoring_type_text,
                version, created_at, updated_at
             FROM rule_sets ORDER BY updated_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[rules] GET list error:', err);
        res.status(500).json({ error: 'Kunde inte hämta regelfiler' });
    }
});

router.get('/:id/version', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('SELECT version, updated_at FROM rule_sets WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Regelfil hittades inte' });
        }
        const row = result.rows[0];
        res.json({ version: row.version, updated_at: row.updated_at });
    } catch (err) {
        console.error('[rules] GET version error:', err);
        res.status(500).json({ error: 'Kunde inte hämta version' });
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
        const title_from_content = content?.metadata?.title?.trim?.();
        const ruleName = title_from_content || name || 'Regelfil ' + new Date().toISOString().slice(0, 10);
        const result = await query(
            'INSERT INTO rule_sets (name, content) VALUES ($1, $2) RETURNING *',
            [ruleName, JSON.stringify(content)]
        );
        broadcast_rules_changed();
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
        const contentJson = JSON.stringify(content);
        const existing = await query(
            'SELECT * FROM rule_sets WHERE content = $1::jsonb LIMIT 1',
            [contentJson]
        );
        if (existing.rows.length > 0) {
            broadcast_rules_changed();
            return res.status(200).json(existing.rows[0]);
        }
        const title_from_content = content?.metadata?.title?.trim?.();
        const ruleName = title_from_content || name || 'Importerad ' + new Date().toISOString().slice(0, 10);
        const result = await query(
            'INSERT INTO rule_sets (name, content) VALUES ($1, $2) RETURNING *',
            [ruleName, contentJson]
        );
        broadcast_rules_changed();
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[rules] import error:', err);
        res.status(500).json({ error: 'Kunde inte importera' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const inUse = await query(
            'SELECT id FROM audits WHERE rule_set_id = $1 LIMIT 1',
            [id]
        );
        if (inUse.rows.length > 0) {
            return res.status(409).json({
                error: 'Regelfilen används av minst en granskning och kan inte raderas. Radera granskningarna först.'
            });
        }
        const result = await query('DELETE FROM rule_sets WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Regelfil hittades inte' });
        }
        broadcast_rules_changed();
        res.status(204).send();
    } catch (err) {
        console.error('[rules] DELETE error:', err);
        res.status(500).json({ error: 'Kunde inte radera regelfil' });
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
        updates.push(`version = version + 1`);
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);
        const result = await query(
            `UPDATE rule_sets SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
            values
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Regelfil hittades inte' });
        }
        broadcast_rules_changed();
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[rules] PUT error:', err);
        res.status(500).json({ error: 'Kunde inte uppdatera regelfil' });
    }
});

export default router;
