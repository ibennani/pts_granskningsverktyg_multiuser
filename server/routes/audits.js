// server/routes/audits.js
import express from 'express';
import { query } from '../db.js';

const router = express.Router();

function build_full_state(audit_row, rule_set_row) {
    const ruleFileContent = rule_set_row ? rule_set_row.content : null;
    const samples = audit_row.samples || [];
    return {
        saveFileVersion: '2.1.0',
        ruleFileContent,
        auditMetadata: audit_row.metadata || {},
        auditStatus: audit_row.status,
        startTime: audit_row.metadata?.startTime || null,
        endTime: audit_row.metadata?.endTime || null,
        samples,
        deficiencyCounter: 1,
        ruleFileOriginalContentString: null,
        ruleFileOriginalFilename: '',
        version: audit_row.version,
        auditId: audit_row.id,
        ruleSetId: audit_row.rule_set_id
    };
}

router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        let sql = 'SELECT a.id, a.rule_set_id, a.status, a.metadata, a.version, a.last_updated_by, a.created_at, a.updated_at, r.name as rule_set_name FROM audits a LEFT JOIN rule_sets r ON a.rule_set_id = r.id';
        const params = [];
        if (status) {
            params.push(status);
            sql += ' WHERE a.status = $1';
        }
        sql += ' ORDER BY a.updated_at DESC';
        const result = await query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('[audits] GET list error:', err);
        res.status(500).json({ error: 'Kunde inte hämta granskningar' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const auditResult = await query('SELECT * FROM audits WHERE id = $1', [id]);
        if (auditResult.rows.length === 0) {
            return res.status(404).json({ error: 'Granskning hittades inte' });
        }
        const audit = auditResult.rows[0];
        let ruleSet = null;
        if (audit.rule_set_id) {
            const ruleResult = await query('SELECT * FROM rule_sets WHERE id = $1', [audit.rule_set_id]);
            ruleSet = ruleResult.rows[0] || null;
        }
        const fullState = build_full_state(audit, ruleSet);
        res.json(fullState);
    } catch (err) {
        console.error('[audits] GET one error:', err);
        res.status(500).json({ error: 'Kunde inte hämta granskning' });
    }
});

router.get('/:id/export', async (req, res) => {
    try {
        const { id } = req.params;
        const auditResult = await query('SELECT * FROM audits WHERE id = $1', [id]);
        if (auditResult.rows.length === 0) {
            return res.status(404).json({ error: 'Granskning hittades inte' });
        }
        const audit = auditResult.rows[0];
        let ruleSet = null;
        if (audit.rule_set_id) {
            const ruleResult = await query('SELECT * FROM rule_sets WHERE id = $1', [audit.rule_set_id]);
            ruleSet = ruleResult.rows[0] || null;
        }
        const fullState = build_full_state(audit, ruleSet);
        res.setHeader('Content-Disposition', `attachment; filename="granskning_${id}.json"`);
        res.json(fullState);
    } catch (err) {
        console.error('[audits] export error:', err);
        res.status(500).json({ error: 'Kunde inte exportera' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { rule_set_id } = req.body;
        const last_updated_by = req.headers['x-user-name'] || req.headers['x-user-id'] || null;
        if (!rule_set_id) {
            return res.status(400).json({ error: 'rule_set_id krävs' });
        }
        const ruleResult = await query('SELECT * FROM rule_sets WHERE id = $1', [rule_set_id]);
        if (ruleResult.rows.length === 0) {
            return res.status(404).json({ error: 'Regelfil hittades inte' });
        }
        const ruleSet = ruleResult.rows[0];
        const result = await query(
            'INSERT INTO audits (rule_set_id, status, metadata, samples, last_updated_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [rule_set_id, 'not_started', '{}', '[]', last_updated_by]
        );
        const audit = result.rows[0];
        const fullState = build_full_state(audit, ruleSet);
        res.status(201).json(fullState);
    } catch (err) {
        console.error('[audits] POST error:', err);
        res.status(500).json({ error: 'Kunde inte skapa granskning' });
    }
});

router.post('/import', async (req, res) => {
    try {
        const data = req.body;
        const last_updated_by = req.headers['x-user-name'] || req.headers['x-user-id'] || null;
        if (!data.ruleFileContent) {
            return res.status(400).json({ error: 'ruleFileContent krävs' });
        }
        const ruleResult = await query(
            'INSERT INTO rule_sets (name, content) VALUES ($1, $2) RETURNING *',
            ['Importerad regelfil', JSON.stringify(data.ruleFileContent)]
        );
        const ruleSet = ruleResult.rows[0];
        const metadata = data.auditMetadata || {};
        const samples = data.samples || [];
        const status = data.auditStatus || 'not_started';
        const result = await query(
            'INSERT INTO audits (rule_set_id, status, metadata, samples, last_updated_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [ruleSet.id, status, JSON.stringify(metadata), JSON.stringify(samples), last_updated_by]
        );
        const audit = result.rows[0];
        const fullState = build_full_state(audit, ruleSet);
        res.status(201).json(fullState);
    } catch (err) {
        console.error('[audits] import error:', err);
        res.status(500).json({ error: 'Kunde inte importera' });
    }
});

router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { metadata, status, samples } = req.body;
        const last_updated_by = req.headers['x-user-name'] || req.headers['x-user-id'] || null;
        const updates = [];
        const values = [];
        let i = 1;
        if (metadata !== undefined) {
            updates.push(`metadata = $${i++}`);
            values.push(JSON.stringify(metadata));
        }
        if (status !== undefined) {
            updates.push(`status = $${i++}`);
            values.push(status);
        }
        if (samples !== undefined) {
            updates.push(`samples = $${i++}`);
            updates.push(`version = version + 1`);
            values.push(JSON.stringify(samples));
        }
        if (last_updated_by !== null) {
            updates.push(`last_updated_by = $${i++}`);
            values.push(last_updated_by);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'Ingen data att uppdatera' });
        }
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);
        const result = await query(
            `UPDATE audits SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
            values
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Granskning hittades inte' });
        }
        const audit = result.rows[0];
        let ruleSet = null;
        if (audit.rule_set_id) {
            const ruleResult = await query('SELECT * FROM rule_sets WHERE id = $1', [audit.rule_set_id]);
            ruleSet = ruleResult.rows[0] || null;
        }
        const fullState = build_full_state(audit, ruleSet);
        res.json(fullState);
    } catch (err) {
        console.error('[audits] PATCH error:', err);
        res.status(500).json({ error: 'Kunde inte uppdatera granskning' });
    }
});

router.patch('/:id/results/:sampleId/:requirementId', async (req, res) => {
    try {
        const { id, sampleId, requirementId } = req.params;
        const { version, result: newResult } = req.body;
        const last_updated_by = req.headers['x-user-name'] || req.headers['x-user-id'] || null;
        const auditResult = await query('SELECT * FROM audits WHERE id = $1', [id]);
        if (auditResult.rows.length === 0) {
            return res.status(404).json({ error: 'Granskning hittades inte' });
        }
        const audit = auditResult.rows[0];
        if (version !== undefined && audit.version !== version) {
            return res.status(409).json({ error: 'Versionskonflikt', serverVersion: audit.version });
        }
        const samples = Array.isArray(audit.samples) ? [...audit.samples] : [];
        let sample = samples.find(s => s.id === sampleId);
        if (!sample) {
            sample = { id: sampleId, requirementResults: {} };
            samples.push(sample);
        }
        if (!sample.requirementResults) sample.requirementResults = {};
        sample.requirementResults[requirementId] = newResult;
        const updateResult = await query(
            'UPDATE audits SET samples = $1, version = version + 1, last_updated_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [JSON.stringify(samples), last_updated_by, id]
        );
        const updated = updateResult.rows[0];
        let ruleSet = null;
        if (updated.rule_set_id) {
            const ruleResult = await query('SELECT * FROM rule_sets WHERE id = $1', [updated.rule_set_id]);
            ruleSet = ruleResult.rows[0] || null;
        }
        const fullState = build_full_state(updated, ruleSet);
        res.json(fullState);
    } catch (err) {
        console.error('[audits] PATCH result error:', err);
        res.status(500).json({ error: 'Kunde inte uppdatera resultat' });
    }
});

export default router;
