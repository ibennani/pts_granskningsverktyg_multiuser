// server/routes/audits.js
import express from 'express';
import { query } from '../db.js';
import { calculate_overall_audit_progress } from '../../js/audit_logic.js';
import { calculateQualityScore } from '../../js/logic/ScoreCalculator.js';
import { validate_saved_audit_file } from '../../js/validation_logic.js';
import { check_json_structure_depth_and_size } from '../../js/utils/json_structure_guard.js';
import { save_backup_for_audit } from '../backup/audit_backup.js';
import { requireAdmin } from '../auth/middleware.js';
import { import_payload_rate_limiter } from '../middleware/rateLimiter.js';
import { attach_export_integrity_server_payload } from '../utils/export_integrity_node.js';
import { build_statistics_from_audit_rows } from '../audit_aggregated_statistics.js';

const router = express.Router();

function count_stuck_in_samples(samples) {
    if (!samples || !Array.isArray(samples)) return 0;
    let n = 0;
    samples.forEach((s) => {
        const results = s?.requirementResults || {};
        Object.values(results).forEach((r) => {
            const t = (r?.stuckProblemDescription || '').trim();
            if (t !== '') n += 1;
        });
    });
    return n;
}

function extract_min_max_timestamps(samples) {
    let minTime = null;
    let maxTime = null;
    if (!samples || !Array.isArray(samples)) return { minTime, maxTime };
    samples.forEach((sample) => {
        const reqResults = sample?.requirementResults || {};
        Object.values(reqResults).forEach((reqResult) => {
            if (reqResult?.lastStatusUpdate) {
                const t = reqResult.lastStatusUpdate;
                if (!minTime || t < minTime) minTime = t;
                if (!maxTime || t > maxTime) maxTime = t;
            }
            Object.values(reqResult?.checkResults || {}).forEach((checkResult) => {
                if (checkResult?.timestamp) {
                    const t = checkResult.timestamp;
                    if (!minTime || t < minTime) minTime = t;
                    if (!maxTime || t > maxTime) maxTime = t;
                }
                Object.values(checkResult?.passCriteria || {}).forEach((pcResult) => {
                    if (pcResult?.timestamp) {
                        const t = pcResult.timestamp;
                        if (!minTime || t < minTime) minTime = t;
                        if (!maxTime || t > maxTime) maxTime = t;
                    }
                });
            });
        });
    });
    return { minTime, maxTime };
}

function count_business_days(startDate, endDate) {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;
    let count = 0;
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    const endNorm = new Date(end);
    endNorm.setHours(0, 0, 0, 0);
    while (d <= endNorm) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) count++;
        d.setDate(d.getDate() + 1);
    }
    return count;
}

export function build_full_state(audit_row, rule_set_row) {
    let ruleFileContent = audit_row?.rule_file_content
        ?? (rule_set_row
            ? (rule_set_row.published_content ?? rule_set_row.content)
            : null);
    if (ruleFileContent && typeof ruleFileContent === 'string') {
        try {
            ruleFileContent = JSON.parse(ruleFileContent);
        } catch (e) {
            console.warn('[audits] build_full_state: Kunde inte parsa rule content för audit', audit_row?.id);
            ruleFileContent = null;
        }
    }
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
        ruleSetId: audit_row.rule_set_id,
        archivedRequirementResults: Array.isArray(audit_row.archived_requirement_results) ? audit_row.archived_requirement_results : [],
        lastRulefileUpdateLog: audit_row.last_rulefile_update_log || null
    };
}

let has_rule_sets_published_column = null;

async function ensure_rule_sets_published_column() {
    if (has_rule_sets_published_column !== null) return has_rule_sets_published_column;
    try {
        const result = await query(
            `SELECT 1 FROM information_schema.columns
             WHERE table_name = 'rule_sets' AND column_name = 'published_content'
             LIMIT 1`
        );
        has_rule_sets_published_column = result.rows.length > 0;
    } catch (err) {
        console.warn('[audits] Kunde inte kontrollera published_content-kolumn på rule_sets:', err.message);
        has_rule_sets_published_column = false;
    }
    return has_rule_sets_published_column;
}

/** Returnerar audit-data UTAN ruleFileContent – regelfilen hämtas separat via rule_set_id. */
function build_audit_state_without_rule_file(audit_row) {
    const samples = audit_row.samples || [];
    return {
        saveFileVersion: '2.1.0',
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
        ruleSetId: audit_row.rule_set_id,
        archivedRequirementResults: Array.isArray(audit_row.archived_requirement_results) ? audit_row.archived_requirement_results : [],
        lastRulefileUpdateLog: audit_row.last_rulefile_update_log || null
    };
}

router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        const hasPublished = await ensure_rule_sets_published_column();
        let sql;
        if (hasPublished) {
            sql = `SELECT a.id, a.rule_set_id, a.rule_file_content, a.status, a.metadata, a.samples, a.version, a.last_updated_by, a.created_at, a.updated_at,
            COALESCE(
                NULLIF(TRIM(COALESCE(a.rule_file_content, COALESCE(r.published_content, r.content))->'metadata'->>'title'), ''),
                r.name
            ) as rule_set_name,
            COALESCE(a.rule_file_content, COALESCE(r.published_content, r.content)) as rule_content
            FROM audits a LEFT JOIN rule_sets r ON a.rule_set_id = r.id`;
        } else {
            sql = `SELECT a.id, a.rule_set_id, a.rule_file_content, a.status, a.metadata, a.samples, a.version, a.last_updated_by, a.created_at, a.updated_at,
            COALESCE(
                NULLIF(TRIM(COALESCE(a.rule_file_content, r.content)->'metadata'->>'title'), ''),
                r.name
            ) as rule_set_name,
            COALESCE(a.rule_file_content, r.content) as rule_content
            FROM audits a LEFT JOIN rule_sets r ON a.rule_set_id = r.id`;
        }
        const params = [];
        if (status) {
            params.push(status);
            sql += ' WHERE a.status = $1';
        }
        sql += ' ORDER BY a.updated_at DESC';
        const result = await query(sql, params);

        const rows = result.rows.map((row) => {
            const out = {
                id: row.id,
                rule_set_id: row.rule_set_id,
                status: row.status,
                metadata: row.metadata || {},
                version: row.version,
                rule_set_name: row.rule_set_name,
                last_updated_by: row.last_updated_by || null,
                created_at: row.created_at,
                updated_at: row.updated_at
            };
            const metadata = row.metadata || {};
            const samples = row.samples;
            const { minTime, maxTime } = extract_min_max_timestamps(samples);
            const firstTs = minTime || metadata.startTime || row.created_at;
            const lastTs = maxTime || metadata.endTime || (row.status === 'locked' ? row.updated_at : null);
            const endForCalc = lastTs || new Date().toISOString();
            out.business_days = firstTs ? count_business_days(firstTs, endForCalc) : null;
            if (row.rule_content && row.samples) {
                try {
                    let rule_content = row.rule_content;
                    if (typeof rule_content === 'string') {
                        rule_content = JSON.parse(rule_content);
                    }
                    const full_state = {
                        ruleFileContent: rule_content,
                        auditStatus: row.status,
                        samples: row.samples
                    };
                    const progress = calculate_overall_audit_progress(full_state);
                    out.progress = progress.total > 0
                        ? Math.round((100 * progress.audited) / progress.total)
                        : null;
                    const score = calculateQualityScore(full_state);
                    out.deficiency_index = score != null && typeof score.totalScore === 'number'
                        ? Math.round(score.totalScore * 10) / 10
                        : null;
                } catch (e) {
                    console.warn('[audits] Beräkning progress/bristindex misslyckades för audit', row.id, ':', e.message);
                    out.progress = null;
                    out.deficiency_index = null;
                }
            } else {
                out.progress = null;
                out.deficiency_index = null;
            }
            return out;
        });

        res.json(rows);
    } catch (err) {
        console.error('[audits] GET list error:', err);
        res.status(500).json({ error: 'Kunde inte hämta granskningar' });
    }
});

router.get('/statistics/summary', async (_req, res) => {
    try {
        const result = await query(
            `SELECT status, metadata, samples, rule_file_content, created_at, updated_at
             FROM audits
             WHERE status IN ('locked', 'archived')
             ORDER BY updated_at DESC`
        );
        const payload = build_statistics_from_audit_rows(result.rows);
        res.json(payload);
    } catch (err) {
        console.error('[audits] GET statistics summary error:', err);
        res.status(500).json({ error: 'Kunde inte hämta statistik' });
    }
});

router.get('/:id/version', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('SELECT version, updated_at FROM audits WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Granskning hittades inte' });
        }
        const row = result.rows[0];
        res.json({ version: row.version, updated_at: row.updated_at });
    } catch (err) {
        console.error('[audits] GET version error:', err);
        res.status(500).json({ error: 'Kunde inte hämta version' });
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
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        if (audit.rule_set_id) {
            const state = build_audit_state_without_rule_file(audit);
            if (process.env.GV_DEBUG_STUCK_SYNC) {
                console.log('[audits] GET', id, 'kört-fast i svar:', count_stuck_in_samples(state.samples));
            }
            res.json(state);
        } else {
            const ruleSet = null;
            const fullState = build_full_state(audit, ruleSet);
            if (process.env.GV_DEBUG_STUCK_SYNC) {
                console.log('[audits] GET', id, 'kört-fast i svar:', count_stuck_in_samples(fullState.samples));
            }
            res.json(fullState);
        }
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
        const with_integrity = attach_export_integrity_server_payload(fullState);
        res.setHeader('Content-Disposition', `attachment; filename="granskning_${id}.json"`);
        res.json(with_integrity);
    } catch (err) {
        console.error('[audits] export error:', err);
        res.status(500).json({ error: 'Kunde inte exportera' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { rule_set_id } = req.body;
        const last_updated_by = req.user ? req.user.name : null;
        if (!rule_set_id) {
            return res.status(400).json({ error: 'rule_set_id krävs' });
        }
        const ruleResult = await query('SELECT * FROM rule_sets WHERE id = $1', [rule_set_id]);
        if (ruleResult.rows.length === 0) {
            return res.status(404).json({ error: 'Regelfil hittades inte' });
        }
        const ruleSet = ruleResult.rows[0];
        const rule_content_for_audit = ruleSet.published_content ?? ruleSet.content;
        const result = await query(
            'INSERT INTO audits (rule_set_id, rule_file_content, status, metadata, samples, last_updated_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [rule_set_id, rule_content_for_audit, 'not_started', '{}', '[]', last_updated_by]
        );
        const audit = result.rows[0];
        const fullState = build_full_state(audit, ruleSet);
        res.status(201).json(fullState);
    } catch (err) {
        console.error('[audits] POST error:', err);
        res.status(500).json({ error: 'Kunde inte skapa granskning' });
    }
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function find_import_conflict_audit_id(data) {
    if (data.auditId && UUID_REGEX.test(data.auditId)) {
        const existingById = await query('SELECT id FROM audits WHERE id = $1', [data.auditId]);
        if (existingById.rows.length > 0) {
            return data.auditId;
        }
    }
    const sample_ids = (data.samples || [])
        .map(s => s?.id)
        .filter(id => id && UUID_REGEX.test(id));
    if (sample_ids.length > 0) {
        const first_sample_id = sample_ids[0];
        const existingBySample = await query(
            `SELECT a.id FROM audits a, jsonb_array_elements(COALESCE(a.samples, '[]'::jsonb)) AS s
             WHERE s->>'id' = $1 LIMIT 1`,
            [first_sample_id]
        );
        if (existingBySample.rows.length > 0) {
            return existingBySample.rows[0].id;
        }
    }
    return null;
}

async function build_existing_audit_summary_for_response(audit_id) {
    const result = await query(
        `SELECT version, updated_at, status, metadata, samples, last_updated_by
         FROM audits WHERE id = $1`,
        [audit_id]
    );
    if (result.rows.length === 0) {
        return null;
    }
    const row = result.rows[0];
    const samples = row.samples;
    const sampleCount = Array.isArray(samples) ? samples.length : 0;
    const meta = row.metadata || {};
    return {
        version: row.version,
        updated_at: row.updated_at,
        status: row.status,
        sampleCount,
        lastUpdatedBy: row.last_updated_by || null,
        metadata: {
            caseNumber: (meta.caseNumber ?? '').toString(),
            actorName: (meta.actorName ?? '').toString()
        }
    };
}

router.post('/import', import_payload_rate_limiter, async (req, res) => {
    try {
        const raw = req.body;
        const replaceExistingAuditId = raw.replaceExistingAuditId;
        const data = { ...raw };
        delete data.replaceExistingAuditId;

        const structure_check = check_json_structure_depth_and_size(data);
        if (!structure_check.ok) {
            const msg = structure_check.reason === 'too_deep'
                ? 'JSON-strukturen är för djupt nästlad.'
                : 'JSON-strukturen är för stor (för många fält eller värden).';
            return res.status(400).json({ error: msg });
        }
        const last_updated_by = req.user ? req.user.name : null;
        const audit_validation = validate_saved_audit_file(data, {
            t: (key) => {
                const map = {
                    error_invalid_saved_audit_file: 'Ogiltig sparad granskningsfil',
                    error_audit_missing_rulefile: 'Saknar regelfilsinnehåll'
                };
                return map[key] || key;
            }
        });
        if (!audit_validation?.isValid) {
            return res.status(400).json({
                error: audit_validation?.message || 'Ogiltig granskningsdata'
            });
        }
        if (!data.ruleFileContent) {
            return res.status(400).json({ error: 'ruleFileContent krävs' });
        }

        const conflict_id = await find_import_conflict_audit_id(data);

        if (replaceExistingAuditId !== undefined && replaceExistingAuditId !== null && replaceExistingAuditId !== '') {
            if (!UUID_REGEX.test(String(replaceExistingAuditId))) {
                return res.status(400).json({ error: 'Ogiltigt värde för replaceExistingAuditId.' });
            }
            if (!conflict_id) {
                return res.status(400).json({
                    error: 'Ingen dubblett att ersätta: granskningen finns inte redan i databasen.'
                });
            }
            if (String(conflict_id) !== String(replaceExistingAuditId)) {
                return res.status(400).json({
                    error: 'Ersättnings-id matchar inte den befintliga granskningen.'
                });
            }

            const metadata = data.auditMetadata || {};
            const samples = data.samples || [];
            const status = data.auditStatus || 'not_started';
            const archived_requirement_results = Array.isArray(data.archivedRequirementResults) ? data.archivedRequirementResults : [];
            const last_rulefile_update_log = data.lastRulefileUpdateLog || null;

            const update_result = await query(
                `UPDATE audits SET
                    rule_set_id = $1,
                    rule_file_content = $2,
                    status = $3,
                    metadata = $4,
                    samples = $5,
                    archived_requirement_results = $6,
                    last_rulefile_update_log = $7,
                    last_updated_by = $8,
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $9
                 RETURNING *`,
                [
                    null,
                    data.ruleFileContent,
                    status,
                    JSON.stringify(metadata),
                    JSON.stringify(samples),
                    JSON.stringify(archived_requirement_results),
                    last_rulefile_update_log ? JSON.stringify(last_rulefile_update_log) : null,
                    last_updated_by,
                    replaceExistingAuditId
                ]
            );
            if (update_result.rows.length === 0) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const audit = update_result.rows[0];
            const fullState = build_full_state(audit, null);
            return res.status(201).json(fullState);
        }

        if (conflict_id) {
            const existingAuditSummary = await build_existing_audit_summary_for_response(conflict_id);
            return res.status(409).json({
                error: 'Granskningen finns redan i databasen.',
                existingAuditId: conflict_id,
                existingAuditSummary: existingAuditSummary || undefined
            });
        }

        const metadata = data.auditMetadata || {};
        const samples = data.samples || [];
        const status = data.auditStatus || 'not_started';
        const archived_requirement_results = Array.isArray(data.archivedRequirementResults) ? data.archivedRequirementResults : [];
        const last_rulefile_update_log = data.lastRulefileUpdateLog || null;
        const result = await query(
            'INSERT INTO audits (rule_set_id, rule_file_content, status, metadata, samples, archived_requirement_results, last_rulefile_update_log, last_updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [
                null,
                data.ruleFileContent,
                status,
                JSON.stringify(metadata),
                JSON.stringify(samples),
                JSON.stringify(archived_requirement_results),
                last_rulefile_update_log ? JSON.stringify(last_rulefile_update_log) : null,
                last_updated_by
            ]
        );
        const audit = result.rows[0];
        const fullState = build_full_state(audit, null);
        res.status(201).json(fullState);
    } catch (err) {
        console.error('[audits] import error:', err);
        res.status(500).json({ error: 'Kunde inte importera' });
    }
});

router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM audits WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Granskning hittades inte' });
        }
        res.status(204).send();
    } catch (err) {
        console.error('[audits] DELETE error:', err);
        res.status(500).json({ error: 'Kunde inte radera granskning' });
    }
});

/**
 * Versionskontrakt (optimistisk låsning):
 * - Klienten skickar expectedVersion = den audit.version den baserar ändringen på.
 * - UPDATE lyckas endast om radens version fortfarande matchar; annars 409 med serverVersion.
 * - Vid lyckad uppdatering ökas version med 1 (som tidigare).
 */
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            metadata,
            status,
            samples,
            ruleFileContent,
            archivedRequirementResults,
            lastRulefileUpdateLog,
            expectedVersion
        } = req.body;
        if (expectedVersion === undefined || expectedVersion === null) {
            return res.status(400).json({ error: 'expectedVersion krävs för att spara granskningen' });
        }
        const expect_num = Number(expectedVersion);
        if (!Number.isFinite(expect_num)) {
            return res.status(400).json({ error: 'expectedVersion måste vara ett tal' });
        }
        const last_updated_by = req.user ? req.user.name : null;
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
            const stuck_count = count_stuck_in_samples(samples);
            if (process.env.GV_DEBUG_STUCK_SYNC) {
                console.log('[GV-Debug] PATCH audit', id, 'samples:', Array.isArray(samples) ? samples.length : 0, 'kört-fast i payload:', stuck_count);
            }
            updates.push(`samples = $${i++}`);
            values.push(JSON.stringify(samples));
        }
        if (ruleFileContent !== undefined) {
            updates.push(`rule_file_content = $${i++}`);
            values.push(JSON.stringify(ruleFileContent));
        }
        if (archivedRequirementResults !== undefined) {
            updates.push(`archived_requirement_results = $${i++}`);
            values.push(JSON.stringify(archivedRequirementResults));
        }
        if (lastRulefileUpdateLog !== undefined) {
            updates.push(`last_rulefile_update_log = $${i++}`);
            values.push(JSON.stringify(lastRulefileUpdateLog));
        }
        updates.push(`version = version + 1`);
        if (last_updated_by !== null) {
            updates.push(`last_updated_by = $${i++}`);
            values.push(last_updated_by);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'Ingen data att uppdatera' });
        }
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        const id_placeholder = i;
        const version_placeholder = i + 1;
        values.push(id);
        values.push(expect_num);
        const result = await query(
            `UPDATE audits SET ${updates.join(', ')} WHERE id = $${id_placeholder} AND version = $${version_placeholder} RETURNING *`,
            values
        );
        if (result.rows.length === 0) {
            const check = await query(
                'SELECT version, last_updated_by FROM audits WHERE id = $1',
                [id]
            );
            if (check.rows.length === 0) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const row = check.rows[0];
            return res.status(409).json({
                error: 'Versionskonflikt',
                serverVersion: Number(row.version),
                lastUpdatedBy: row.last_updated_by ?? null
            });
        }
        const audit = result.rows[0];
        let ruleSet = null;
        if (audit.rule_set_id) {
            const ruleResult = await query('SELECT * FROM rule_sets WHERE id = $1', [audit.rule_set_id]);
            ruleSet = ruleResult.rows[0] || null;
        }
        const fullState = build_full_state(audit, ruleSet);

        if (status === 'locked') {
            setImmediate(() => {
                save_backup_for_audit(fullState, { backup_suffix_key: 'filename_locked_suffix' }).catch((err) => {
                    console.warn('[audits] Säkerhetskopiering vid låsning misslyckades:', err.message);
                });
            });
        }

        res.json(fullState);
    } catch (err) {
        console.error('[audits] PATCH error:', err.message, err.stack);
        res.status(500).json({ error: 'Kunde inte uppdatera granskning' });
    }
});

router.patch('/:id/results/:sampleId/:requirementId', async (req, res) => {
    try {
        const { id, sampleId, requirementId } = req.params;
        const { version, result: newResult } = req.body;
        const last_updated_by = req.user ? req.user.name : null;
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
