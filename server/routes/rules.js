// server/routes/rules.js
import express from 'express';
import { query } from '../db.js';
import { broadcast } from '../ws.js';
import { requireAdmin } from '../auth/middleware.js';
import { import_payload_rate_limiter } from '../middleware/rateLimiter.js';
import { check_json_structure_depth_and_size } from '../../shared/json/json_structure_guard.js';
import { parse_part_key } from '../../shared/rulefile/rulefile_part_keys.js';
import { normalize_rulefile_content_object } from '../utils/rulefile_content_utils.js';
import {
    fetch_rule_sets_list,
    fetch_rule_set_version_row,
    fetch_rule_set_by_id,
    fetch_rule_set_for_export,
    fetch_rule_set_by_content_json,
    fetch_active_audits_count_for_rule,
    clear_production_base_id_refs,
    has_rule_sets_published_content_column
} from '../repositories/rule_repository.js';

const router = express.Router();

function broadcast_rules_changed() {
    broadcast({ type: 'rules:changed' });
}

function broadcast_rule_locks_changed(rule_set_id) {
    broadcast({ type: 'rules:locks_changed', ruleSetId: String(rule_set_id) });
}

router.get('/', async (_req, res) => {
    try {
        const result = await fetch_rule_sets_list();
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
        const result = await fetch_rule_set_version_row(id);
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

router.get('/:id/locks', async (req, res) => {
    try {
        const { id } = req.params;
        const now = new Date();
        // Rensa utgångna lease innan listning (best effort)
        await query('DELETE FROM rule_edit_locks WHERE lease_until < CURRENT_TIMESTAMP');
        const result = await query(
            `SELECT rule_set_id, part_key, user_id, user_name, client_lock_id, lease_until, updated_at
             FROM rule_edit_locks
             WHERE rule_set_id = $1 AND lease_until >= CURRENT_TIMESTAMP
             ORDER BY part_key ASC`,
            [id]
        );
        res.json({
            ruleSetId: id,
            now: now.toISOString(),
            locks: result.rows
        });
    } catch (err) {
        console.error('[rules] GET locks error:', err);
        res.status(500).json({ error: 'Kunde inte hämta lås' });
    }
});

router.post('/:id/locks', async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const part_key = String(req.body?.part_key || '');
        const client_lock_id = String(req.body?.client_lock_id || '');
        const requested_ttl_seconds = Number(req.body?.ttl_seconds || 30);

        if (!part_key) return res.status(400).json({ error: 'part_key krävs' });
        if (!client_lock_id) return res.status(400).json({ error: 'client_lock_id krävs' });
        if (!parse_part_key(part_key)) return res.status(400).json({ error: 'Ogiltig part_key' });

        const ttl_seconds = Math.max(10, Math.min(60, Number.isFinite(requested_ttl_seconds) ? requested_ttl_seconds : 30));

        await query('DELETE FROM rule_edit_locks WHERE lease_until < CURRENT_TIMESTAMP');

        const result = await query(
            `INSERT INTO rule_edit_locks (rule_set_id, part_key, user_id, user_name, client_lock_id, lease_until, updated_at)
             VALUES ($1, $2, $3, $4, $5::uuid, CURRENT_TIMESTAMP + ($6 || ' seconds')::interval, CURRENT_TIMESTAMP)
             ON CONFLICT (rule_set_id, part_key) DO UPDATE
                SET user_id = EXCLUDED.user_id,
                    user_name = EXCLUDED.user_name,
                    client_lock_id = EXCLUDED.client_lock_id,
                    lease_until = EXCLUDED.lease_until,
                    updated_at = CURRENT_TIMESTAMP
              WHERE rule_edit_locks.lease_until < CURRENT_TIMESTAMP
                 OR (rule_edit_locks.user_id = EXCLUDED.user_id)
             RETURNING rule_set_id, part_key, user_id, user_name, client_lock_id, lease_until, updated_at`,
            [id, part_key, user.id, user.name, client_lock_id, String(ttl_seconds)]
        );

        if (result.rows.length === 0) {
            const existing = await query(
                `SELECT rule_set_id, part_key, user_id, user_name, client_lock_id, lease_until, updated_at
                 FROM rule_edit_locks WHERE rule_set_id = $1 AND part_key = $2 LIMIT 1`,
                [id, part_key]
            );
            const lock = existing.rows[0] || null;
            return res.status(409).json({ error: 'Fältet är redan låst', lock });
        }

        broadcast_rule_locks_changed(id);
        res.status(201).json({ lock: result.rows[0] });
    } catch (err) {
        console.error('[rules] POST locks error:', err);
        res.status(500).json({ error: 'Kunde inte ta lås' });
    }
});

router.post('/:id/locks/:partKey/heartbeat', async (req, res) => {
    try {
        const { id, partKey } = req.params;
        const user = req.user;
        const part_key = decodeURIComponent(String(partKey || ''));
        const client_lock_id = String(req.body?.client_lock_id || '');
        const requested_ttl_seconds = Number(req.body?.ttl_seconds || 30);

        if (!client_lock_id) return res.status(400).json({ error: 'client_lock_id krävs' });
        if (!parse_part_key(part_key)) return res.status(400).json({ error: 'Ogiltig part_key' });

        const ttl_seconds = Math.max(10, Math.min(60, Number.isFinite(requested_ttl_seconds) ? requested_ttl_seconds : 30));

        const result = await query(
            `UPDATE rule_edit_locks
             SET lease_until = CURRENT_TIMESTAMP + ($5 || ' seconds')::interval,
                 updated_at = CURRENT_TIMESTAMP
             WHERE rule_set_id = $1
               AND part_key = $2
               AND user_id = $3
               AND client_lock_id = $4::uuid
             RETURNING rule_set_id, part_key, user_id, user_name, client_lock_id, lease_until, updated_at`,
            [id, part_key, user.id, client_lock_id, String(ttl_seconds)]
        );
        if (result.rows.length === 0) {
            return res.status(409).json({ error: 'Kan inte förlänga lås (saknas eller ägs av annan)' });
        }
        broadcast_rule_locks_changed(id);
        res.json({ lock: result.rows[0] });
    } catch (err) {
        console.error('[rules] heartbeat error:', err);
        res.status(500).json({ error: 'Kunde inte förlänga lås' });
    }
});

router.delete('/:id/locks/:partKey', async (req, res) => {
    try {
        const { id, partKey } = req.params;
        const user = req.user;
        const part_key = decodeURIComponent(String(partKey || ''));
        const client_lock_id = String(req.query?.client_lock_id || req.body?.client_lock_id || '');

        if (!client_lock_id) return res.status(400).json({ error: 'client_lock_id krävs' });
        if (!parse_part_key(part_key)) return res.status(400).json({ error: 'Ogiltig part_key' });

        const result = await query(
            `DELETE FROM rule_edit_locks
             WHERE rule_set_id = $1
               AND part_key = $2
               AND user_id = $3
               AND client_lock_id = $4::uuid
             RETURNING rule_set_id, part_key`,
            [id, part_key, user.id, client_lock_id]
        );
        if (result.rows.length === 0) {
            return res.status(409).json({ error: 'Kan inte släppa lås (saknas eller ägs av annan)' });
        }
        broadcast_rule_locks_changed(id);
        res.status(204).send();
    } catch (err) {
        console.error('[rules] DELETE lock error:', err);
        res.status(500).json({ error: 'Kunde inte släppa lås' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await fetch_rule_set_by_id(id);
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
        const result = await fetch_rule_set_for_export(id);
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

router.post('/import', import_payload_rate_limiter, async (req, res) => {
    try {
        const structure_check = check_json_structure_depth_and_size(req.body);
        if (!structure_check.ok) {
            const msg = structure_check.reason === 'too_deep'
                ? 'JSON-strukturen är för djupt nästlad.'
                : 'JSON-strukturen är för stor (för många fält eller värden).';
            return res.status(400).json({ error: msg });
        }
        const { name, content } = req.body;
        if (!content || typeof content !== 'object') {
            return res.status(400).json({ error: 'Content krävs' });
        }
        const contentJson = JSON.stringify(content);
        const existing = await fetch_rule_set_by_content_json(contentJson);
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
        const ruleResult = await fetch_rule_set_by_id(id);
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

        const activeCountResult = await fetch_active_audits_count_for_rule(id);
        const inUseCount = parseInt(activeCountResult.rows[0]?.count ?? '0', 10);
        if (inUseCount > 0) {
            return res.status(409).json({
                error: 'Regelfilen används av minst en granskning och kan inte raderas. Radera granskningarna först.',
                inUseCount
            });
        }
        await clear_production_base_id_refs(id);
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

router.patch('/:id/content-part', async (req, res) => {
    try {
        const { id } = req.params;
        const part_key = String(req.body?.part_key || '');
        const base_version = Number(req.body?.base_version);
        const value = req.body?.value;

        if (!part_key) return res.status(400).json({ error: 'part_key krävs' });
        if (!Number.isFinite(base_version)) return res.status(400).json({ error: 'base_version krävs' });

        const parsed = parse_part_key(part_key);
        if (!parsed) return res.status(400).json({ error: 'Ogiltig part_key' });
        if (parsed.kind !== 'infoblock_text') {
            return res.status(400).json({ error: 'Denna part_key stöds inte för patch än' });
        }
        if (typeof value !== 'string') return res.status(400).json({ error: 'value måste vara en sträng' });

        const json_path = ['requirements', parsed.requirement_key, 'infoBlocks', parsed.block_id, 'text'];

        const patch_result = await query(
            `UPDATE rule_sets
             SET content = jsonb_set(
                 content,
                 $2::text[],
                 to_jsonb($3::text),
                 true
             ),
                 content_updated_at = CURRENT_TIMESTAMP,
                 version = version + 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
               AND version = $4
             RETURNING *`,
            [id, json_path, value, base_version]
        );

        if (patch_result.rows.length === 0) {
            const current = await query('SELECT version FROM rule_sets WHERE id = $1', [id]);
            if (current.rows.length === 0) return res.status(404).json({ error: 'Regelfil hittades inte' });
            return res.status(409).json({ error: 'Versionskonflikt', version: current.rows[0].version });
        }

        broadcast_rules_changed();
        res.json(patch_result.rows[0]);
    } catch (err) {
        console.error('[rules] PATCH content-part error:', err);
        res.status(500).json({ error: 'Kunde inte uppdatera del av regelfilen' });
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

        const hasPublished = await has_rule_sets_published_content_column();
        if (!hasPublished) {
            return res.status(400).json({ error: 'Publiceringsstöd saknas för regelfiler i denna databas.' });
        }

        const sourceResult = await fetch_rule_set_by_id(id);
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
        const content_obj = normalize_rulefile_content_object(content);
        if (!content_obj) {
            return res.status(400).json({ error: 'Produktionskopians innehåll kunde inte tolkas som JSON.' });
        }

        const baseResult = await query(
            'SELECT published_content FROM rule_sets WHERE id = $1',
            [base_id]
        );
        const published_obj = baseResult.rows.length > 0
            ? normalize_rulefile_content_object(baseResult.rows[0].published_content)
            : null;
        const current_published_version = published_obj?.metadata?.version
            ? String(published_obj.metadata.version).trim()
            : null;

        const now = new Date();
        const current_year = now.getFullYear();
        const current_month = now.getMonth() + 1;
        const draft_metadata_version = content_obj?.metadata?.version
            ? String(content_obj.metadata.version).trim()
            : '';
        const version_match =
            typeof current_published_version === 'string' && current_published_version
                ? current_published_version.match(/^(\d{4})\.(\d{1,2})\.r(\d+)$/)
                : null;

        let version_str;
        if (draft_metadata_version) {
            // Om arbetskopian redan har ett versionsnummer (t.ex. från uppladdad regelfil),
            // ska publiceringen behålla exakt samma version.
            version_str = draft_metadata_version;
        } else if (version_match) {
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

        const content_with_version = {
            ...content_obj,
            metadata: {
                ...(content_obj.metadata || {}),
                version: version_str
            }
        };

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
