// server/routes/rules.js
import express from 'express';
import { query } from '../db.js';
import { broadcast } from '../ws.js';
import { requireAdmin } from '../auth/middleware.js';

const router = express.Router();

function broadcast_rules_changed() {
    broadcast({ type: 'rules:changed' });
}

let has_published_content_column = null;

async function ensure_published_column_flag() {
    if (has_published_content_column !== null) return has_published_content_column;
    try {
        const result = await query(
            `SELECT 1 FROM information_schema.columns
             WHERE table_name = 'rule_sets' AND column_name = 'published_content'
             LIMIT 1`
        );
        has_published_content_column = result.rows.length > 0;
    } catch (err) {
        console.warn('[rules] Kunde inte kontrollera published_content-kolumn:', err.message);
        has_published_content_column = false;
    }
    return has_published_content_column;
}

router.get('/', async (_req, res) => {
    try {
        const hasPublished = await ensure_published_column_flag();
        const sql = hasPublished
            ? `SELECT id,
                    published_content IS NOT NULL AS is_published,
                    (production_base_id IS NOT NULL OR published_content IS NULL) AS list_as_arbetskopia,
                    COALESCE(
                        NULLIF(TRIM(COALESCE(published_content, content)->'metadata'->>'title'), ''),
                        name
                    ) AS name,
                    COALESCE(
                        NULLIF(TRIM(COALESCE(published_content, content)->'metadata'->>'version'), ''),
                        version::text
                    ) AS version_display,
                    COALESCE(published_content, content)->'metadata'->>'version' AS metadata_version,
                    COALESCE(
                        NULLIF(TRIM(COALESCE(published_content, content)->'metadata'->'monitoringType'->>'text'), ''),
                        NULLIF(TRIM(COALESCE(published_content, content)->'metadata'->'monitoringType'->>'label'), '')
                    ) AS monitoring_type_text,
                    (published_content IS NOT NULL AND content::text <> published_content::text) AS has_draft,
                    CASE
                        WHEN published_content IS NOT NULL AND content::text <> published_content::text
                        THEN content->'metadata'->>'version'
                        ELSE NULL
                    END AS draft_version,
                    version, created_at::text AS created_at, updated_at::text AS updated_at,
                    content_updated_at::text AS content_updated_at,
                    production_base_id
               FROM rule_sets
               ORDER BY updated_at DESC`
            : `SELECT id,
                    false AS is_published,
                    true AS list_as_arbetskopia,
                    COALESCE(NULLIF(TRIM(content->'metadata'->>'title'), ''), name) AS name,
                    COALESCE(NULLIF(TRIM(content->'metadata'->>'version'), ''), version::text) AS version_display,
                    content->'metadata'->>'version' AS metadata_version,
                    COALESCE(
                        NULLIF(TRIM(content->'metadata'->'monitoringType'->>'text'), ''),
                        NULLIF(TRIM(content->'metadata'->'monitoringType'->>'label'), '')
                    ) AS monitoring_type_text,
                    false AS has_draft,
                    NULL AS draft_version,
                    version, created_at::text AS created_at, updated_at::text AS updated_at,
                    content_updated_at::text AS content_updated_at,
                    production_base_id
               FROM rule_sets
               ORDER BY updated_at DESC`;
        const result = await query(sql);
        const rows = result.rows.map((row) => {
            const out = { ...row };
            ['created_at', 'updated_at', 'content_updated_at'].forEach((key) => {
                if (out[key] != null && typeof out[key] === 'string') {
                    const s = out[key].trim();
                    if (s && !/Z$/i.test(s) && !/[+-]\d{2}:?\d{2}$/.test(s)) {
                        const iso = s.replace(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)/, '$1T$2Z');
                        if (iso !== s) out[key] = iso;
                    }
                }
            });
            return out;
        });
        res.json(rows);
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
        const hasPublished = await ensure_published_column_flag();
        const sql = hasPublished
            ? `SELECT id,
                      name,
                      COALESCE(published_content, content) AS content,
                      version,
                      updated_at,
                      (published_content IS NOT NULL) AS is_published
                 FROM rule_sets
                WHERE id = $1`
            : `SELECT id,
                      name,
                      content,
                      version,
                      updated_at,
                      false AS is_published
                 FROM rule_sets
                WHERE id = $1`;
        const result = await query(sql, [id]);
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
        const content_json = JSON.stringify(content);
        const result = await query(
            'INSERT INTO rule_sets (name, content, published_content) VALUES ($1, $2, $2) RETURNING *',
            [ruleName, content_json]
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
            'INSERT INTO rule_sets (name, content, published_content) VALUES ($1, $2, $2) RETURNING *',
            [ruleName, contentJson]
        );
        broadcast_rules_changed();
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[rules] import error:', err);
        res.status(500).json({ error: 'Kunde inte importera' });
    }
});

router.post('/production', async (req, res) => {
    try {
        const { name, content } = req.body;
        if (!content || typeof content !== 'object') {
            return res.status(400).json({ error: 'Content krävs' });
        }
        const title_from_content = content?.metadata?.title?.trim?.();
        const ruleName = title_from_content || name || 'Arbetskopia ' + new Date().toISOString().slice(0, 10);
        const content_json = JSON.stringify(content);
        const result = await query(
            `INSERT INTO rule_sets (name, content, published_content, production_base_id)
             VALUES ($1, $2, NULL, NULL) RETURNING *`,
            [ruleName, content_json]
        );
        broadcast_rules_changed();
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[rules] POST production error:', err);
        res.status(500).json({ error: 'Kunde inte skapa arbetskopia' });
    }
});

router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const ruleResult = await query(
            'SELECT id, production_base_id FROM rule_sets WHERE id = $1',
            [id]
        );
        if (ruleResult.rows.length === 0) {
            return res.status(404).json({ error: 'Regelfil hittades inte' });
        }
        const rule = ruleResult.rows[0];
        const is_arbetskopia = rule.production_base_id != null;

        if (is_arbetskopia) {
            await query(
                'UPDATE audits SET rule_set_id = $1 WHERE rule_set_id = $2',
                [rule.production_base_id, id]
            );
            await query('DELETE FROM rule_sets WHERE id = $1', [id]);
            broadcast_rules_changed();
            return res.status(204).send();
        }

        const activeCountResult = await query(
            `SELECT COUNT(*) AS count FROM audits
             WHERE rule_set_id = $1 AND status IN ('not_started', 'in_progress')`,
            [id]
        );
        const inUseCount = parseInt(activeCountResult.rows[0]?.count ?? '0', 10);
        if (inUseCount > 0) {
            return res.status(409).json({
                error: 'Regelfilen används av minst en granskning och kan inte raderas. Radera granskningarna först.',
                inUseCount
            });
        }
        await query(
            'UPDATE rule_sets SET production_base_id = NULL WHERE production_base_id = $1',
            [id]
        );
        await query('DELETE FROM rule_sets WHERE id = $1', [id]);
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
            const content_with_date = typeof content === 'object' && content !== null
                ? {
                    ...content,
                    metadata: {
                        ...(content.metadata || {}),
                        dateModified: new Date().toISOString()
                    }
                }
                : content;
            updates.push(`content = $${i++}`);
            values.push(JSON.stringify(content_with_date));
            updates.push(`content_updated_at = CURRENT_TIMESTAMP`);
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

// Publicera en regelfil: kopiera nuvarande utkast (content) till published_content.
router.post('/:id/publish', async (req, res) => {
    try {
        const { id } = req.params;
        const selectResult = await query('SELECT content, published_content, version FROM rule_sets WHERE id = $1', [id]);
        if (selectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Regelfil hittades inte' });
        }
        const row = selectResult.rows[0];
        const current_content = row.content;
        const current_published = row.published_content;

        // Om inget utkast skiljer sig från publicerad version finns inget att publicera.
        if (current_published && JSON.stringify(current_published) === JSON.stringify(current_content)) {
            return res.status(400).json({ error: 'Det finns inga ändringar att publicera för denna regelfil.' });
        }

        const updateResult = await query(
            `UPDATE rule_sets
             SET published_content = content,
                 version = version + 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        const updated = updateResult.rows[0];
        broadcast_rules_changed();
        res.json(updated);
    } catch (err) {
        console.error('[rules] PUBLISH error:', err);
        res.status(500).json({ error: 'Kunde inte publicera regelfil' });
    }
});

// Skapa en produktionskopia av en regelfil.
router.post('/:id/copy', async (req, res) => {
    try {
        const { id } = req.params;

        const hasPublished = await ensure_published_column_flag();
        if (!hasPublished) {
            return res.status(400).json({ error: 'Publiceringsstöd saknas för regelfiler i denna databas.' });
        }

        const sourceResult = await query('SELECT * FROM rule_sets WHERE id = $1', [id]);
        if (sourceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Regelfil hittades inte' });
        }
        const source = sourceResult.rows[0];

        const base_content = source.published_content || source.content;
        if (!base_content) {
            return res.status(400).json({ error: 'Regelfilen saknar innehåll att kopiera.' });
        }

        const existingProduction = await query(
            'SELECT * FROM rule_sets WHERE production_base_id = $1 LIMIT 1',
            [id]
        );
        if (existingProduction.rows.length > 0) {
            return res.status(409).json({
                error: 'Produktionskopia finns redan för denna regelfil.',
                existingId: existingProduction.rows[0].id
            });
        }

        const insertResult = await query(
            `INSERT INTO rule_sets (name, content, published_content, version, production_base_id, content_updated_at)
             VALUES ($1, $2, NULL, $3, $4, CURRENT_TIMESTAMP)
             RETURNING *`,
            [
                source.name,
                JSON.stringify(base_content),
                source.version,
                id
            ]
        );
        const created = insertResult.rows[0];
        broadcast_rules_changed();
        res.status(201).json(created);
    } catch (err) {
        console.error('[rules] COPY production error:', err);
        res.status(500).json({ error: 'Kunde inte skapa produktionskopia' });
    }
});

// Publicera en produktionskopia tillbaka till sin basregelfil.
router.post('/:id/publish_production', async (req, res) => {
    try {
        const { id } = req.params;
        const productionResult = await query('SELECT * FROM rule_sets WHERE id = $1', [id]);
        if (productionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Produktionskopia hittades inte' });
        }
        const production = productionResult.rows[0];
        const base_id = production.production_base_id;
        if (!base_id) {
            return res.status(400).json({ error: 'Denna regelfil är inte markerad som produktionskopia.' });
        }

        const content = production.content;
        if (!content) {
            return res.status(400).json({ error: 'Produktionskopian saknar innehåll att publicera.' });
        }

        const baseResult = await query(
            'SELECT published_content FROM rule_sets WHERE id = $1',
            [base_id]
        );
        const current_published_version =
            baseResult.rows.length > 0 && baseResult.rows[0].published_content?.metadata?.version
                ? String(baseResult.rows[0].published_content.metadata.version).trim()
                : null;

        const now = new Date();
        const current_year = now.getFullYear();
        const current_month = now.getMonth() + 1;
        const version_match =
            typeof current_published_version === 'string' && current_published_version
                ? current_published_version.match(/^(\d{4})\.(\d{1,2})\.r(\d+)$/)
                : null;

        let version_str;
        if (version_match) {
            const [, version_year, version_month, release] = version_match;
            const version_year_number = parseInt(version_year, 10);
            const version_month_number = parseInt(version_month, 10);
            if (
                version_year_number === current_year &&
                version_month_number === current_month
            ) {
                version_str = `${current_year}.${current_month}.r${parseInt(release, 10) + 1}`;
            } else {
                version_str = `${current_year}.${current_month}.r1`;
            }
        } else {
            version_str = `${current_year}.${current_month}.r1`;
        }

        const content_with_version = typeof content === 'object' && content !== null
            ? {
                ...content,
                metadata: {
                    ...(content.metadata || {}),
                    version: version_str
                }
            }
            : content;

        const updateBaseResult = await query(
            `UPDATE rule_sets
             SET published_content = $1::jsonb,
                 content = $1::jsonb,
                 version = version + 1,
                 updated_at = CURRENT_TIMESTAMP,
                 content_updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [JSON.stringify(content_with_version), base_id]
        );
        if (updateBaseResult.rows.length === 0) {
            return res.status(404).json({ error: 'Basregelfilen hittades inte' });
        }
        const updatedBase = updateBaseResult.rows[0];

        await query('DELETE FROM rule_sets WHERE id = $1', [id]);

        broadcast_rules_changed();
        res.json({
            base: updatedBase
        });
    } catch (err) {
        console.error('[rules] publish_production error:', err);
        res.status(500).json({ error: 'Kunde inte publicera produktionskopia' });
    }
});

export default router;
