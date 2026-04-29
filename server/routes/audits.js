// server/routes/audits.js
import express from 'express';
import { query } from '../db.js';
import { calculate_overall_audit_progress } from '../../js/audit_logic.ts';
import { calculateQualityScore } from '../../js/logic/ScoreCalculator.js';
import { validate_saved_audit_file } from '../../js/validation_logic.js';
import { check_json_structure_depth_and_size } from '../../js/utils/json_structure_guard.js';
import { save_backup_for_audit } from '../backup/audit_backup.js';
import { requireAdmin } from '../auth/middleware.js';
import { import_payload_rate_limiter } from '../middleware/rateLimiter.js';
import { attach_export_integrity_server_payload } from '../utils/export_integrity_node.js';
import { build_statistics_from_audit_rows } from '../audit_aggregated_statistics.js';
import { parse_audit_part_key } from '../../js/logic/audit_part_keys.js';
import { broadcast } from '../ws.js';
import { count_stuck_in_samples } from '../../shared/audit/audit_metrics.js';
import {
    fetch_audits_index_rows,
    fetch_statistics_audits_locked_archived,
    select_audit_id_exists,
    select_audit_id_by_sample_id,
    fetch_audit_summary_for_import_conflict
} from '../repositories/audit_repository.js';
import { fetch_rule_set_by_id } from '../repositories/rule_repository.js';

const router = express.Router();

function broadcast_audits_changed() {
    broadcast({ type: 'audits:changed' });
}

function broadcast_audit_locks_changed(audit_id) {
    broadcast({ type: 'audits:locks_changed', auditId: String(audit_id) });
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

function normalize_audit_type(rule_content) {
    const m = rule_content?.metadata?.monitoringType;
    const text = typeof m?.text === 'string' ? m.text.trim() : '';
    const typ = typeof m?.type === 'string' ? m.type.trim() : '';
    const raw = (typ || text).toLowerCase();
    if (!raw) return null;
    if (raw.includes('pdf')) return 'pdf';
    if (raw === 'web' || raw.includes('webb') || raw.includes('web')) return 'webb';
    return raw;
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
        created_at: audit_row.created_at ?? null,
        updated_at: audit_row.updated_at ?? null,
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

/** Returnerar audit-data UTAN ruleFileContent – regelfilen hämtas separat via rule_set_id. */
function build_audit_state_without_rule_file(audit_row) {
    const samples = audit_row.samples || [];
    return {
        saveFileVersion: '2.1.0',
        auditMetadata: audit_row.metadata || {},
        auditStatus: audit_row.status,
        created_at: audit_row.created_at ?? null,
        updated_at: audit_row.updated_at ?? null,
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
        const result = await fetch_audits_index_rows(status);

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
                    out.audit_type = normalize_audit_type(rule_content);
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
                    out.audit_type = null;
                }
            } else {
                out.progress = null;
                out.deficiency_index = null;
                out.audit_type = null;
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
        const result = await fetch_statistics_audits_locked_archived();
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

router.get('/:id/locks', async (req, res) => {
    try {
        const { id } = req.params;
        const now = new Date();
        await query('DELETE FROM audit_edit_locks WHERE lease_until < CURRENT_TIMESTAMP');
        const result = await query(
            `SELECT audit_id, part_key, user_id, user_name, client_lock_id, lease_until, updated_at
             FROM audit_edit_locks
             WHERE audit_id = $1 AND lease_until >= CURRENT_TIMESTAMP
             ORDER BY part_key ASC`,
            [id]
        );
        res.json({ auditId: id, now: now.toISOString(), locks: result.rows });
    } catch (err) {
        console.error('[audits] GET locks error:', err);
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
        const parsed = parse_audit_part_key(part_key);
        if (!parsed || String(parsed.audit_id) !== String(id)) return res.status(400).json({ error: 'Ogiltig part_key' });

        const ttl_seconds = Math.max(10, Math.min(60, Number.isFinite(requested_ttl_seconds) ? requested_ttl_seconds : 30));

        await query('DELETE FROM audit_edit_locks WHERE lease_until < CURRENT_TIMESTAMP');

        const result = await query(
            `INSERT INTO audit_edit_locks (audit_id, part_key, user_id, user_name, client_lock_id, lease_until, updated_at)
             VALUES ($1, $2, $3, $4, $5::uuid, CURRENT_TIMESTAMP + ($6 || ' seconds')::interval, CURRENT_TIMESTAMP)
             ON CONFLICT (audit_id, part_key) DO UPDATE
                SET user_id = EXCLUDED.user_id,
                    user_name = EXCLUDED.user_name,
                    client_lock_id = EXCLUDED.client_lock_id,
                    lease_until = EXCLUDED.lease_until,
                    updated_at = CURRENT_TIMESTAMP
              WHERE audit_edit_locks.lease_until < CURRENT_TIMESTAMP
                 OR (audit_edit_locks.user_id = EXCLUDED.user_id)
             RETURNING audit_id, part_key, user_id, user_name, client_lock_id, lease_until, updated_at`,
            [id, part_key, user.id, user.name, client_lock_id, String(ttl_seconds)]
        );
        if (result.rows.length === 0) {
            const existing = await query(
                `SELECT audit_id, part_key, user_id, user_name, client_lock_id, lease_until, updated_at
                 FROM audit_edit_locks WHERE audit_id = $1 AND part_key = $2 LIMIT 1`,
                [id, part_key]
            );
            return res.status(409).json({ error: 'Fältet är redan låst', lock: existing.rows[0] || null });
        }
        broadcast_audit_locks_changed(id);
        res.status(201).json({ lock: result.rows[0] });
    } catch (err) {
        console.error('[audits] POST locks error:', err);
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
        const parsed = parse_audit_part_key(part_key);
        if (!parsed || String(parsed.audit_id) !== String(id)) return res.status(400).json({ error: 'Ogiltig part_key' });

        const ttl_seconds = Math.max(10, Math.min(60, Number.isFinite(requested_ttl_seconds) ? requested_ttl_seconds : 30));

        const result = await query(
            `UPDATE audit_edit_locks
             SET lease_until = CURRENT_TIMESTAMP + ($5 || ' seconds')::interval,
                 updated_at = CURRENT_TIMESTAMP
             WHERE audit_id = $1
               AND part_key = $2
               AND user_id = $3
               AND client_lock_id = $4::uuid
             RETURNING audit_id, part_key, user_id, user_name, client_lock_id, lease_until, updated_at`,
            [id, part_key, user.id, client_lock_id, String(ttl_seconds)]
        );
        if (result.rows.length === 0) {
            return res.status(409).json({ error: 'Kan inte förlänga lås (saknas eller ägs av annan)' });
        }
        broadcast_audit_locks_changed(id);
        res.json({ lock: result.rows[0] });
    } catch (err) {
        console.error('[audits] heartbeat error:', err);
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
        const parsed = parse_audit_part_key(part_key);
        if (!parsed || String(parsed.audit_id) !== String(id)) return res.status(400).json({ error: 'Ogiltig part_key' });

        const result = await query(
            `DELETE FROM audit_edit_locks
             WHERE audit_id = $1
               AND part_key = $2
               AND user_id = $3
               AND client_lock_id = $4::uuid
             RETURNING audit_id, part_key`,
            [id, part_key, user.id, client_lock_id]
        );
        if (result.rows.length === 0) {
            return res.status(409).json({ error: 'Kan inte släppa lås (saknas eller ägs av annan)' });
        }
        broadcast_audit_locks_changed(id);
        res.status(204).send();
    } catch (err) {
        console.error('[audits] DELETE lock error:', err);
        res.status(500).json({ error: 'Kunde inte släppa lås' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const auditResult = await query(
            `SELECT id, rule_set_id, rule_file_content, status, metadata, samples, version, last_updated_by, created_at, updated_at::text AS updated_at
             FROM audits WHERE id = $1`, [id]
        );
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
        const auditResult = await query(
            `SELECT id, rule_set_id, rule_file_content, status, metadata, samples, version, last_updated_by, created_at, updated_at::text AS updated_at
             FROM audits WHERE id = $1`, [id]
        );
        if (auditResult.rows.length === 0) {
            return res.status(404).json({ error: 'Granskning hittades inte' });
        }
        const audit = auditResult.rows[0];
        let ruleSet = null;
        if (audit.rule_set_id) {
            const ruleResult = await fetch_rule_set_by_id(audit.rule_set_id);
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
        const ruleResult = await fetch_rule_set_by_id(rule_set_id);
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
        const existingById = await select_audit_id_exists(data.auditId);
        if (existingById.rows.length > 0) {
            return data.auditId;
        }
    }
    const sample_ids = (data.samples || [])
        .map(s => s?.id)
        .filter(id => id && UUID_REGEX.test(id));
    if (sample_ids.length > 0) {
        const first_sample_id = sample_ids[0];
        const existingBySample = await select_audit_id_by_sample_id(first_sample_id);
        if (existingBySample.rows.length > 0) {
            return existingBySample.rows[0].id;
        }
    }
    return null;
}

async function build_existing_audit_summary_for_response(audit_id) {
    const result = await fetch_audit_summary_for_import_conflict(audit_id);
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
            const ruleResult = await fetch_rule_set_by_id(audit.rule_set_id);
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

router.patch('/:id/content-part', async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const part_key = String(req.body?.part_key || '');
        const base_version = Number(req.body?.base_version);
        const value = req.body?.value;

        if (!part_key) return res.status(400).json({ error: 'part_key krävs' });
        if (!Number.isFinite(base_version)) return res.status(400).json({ error: 'base_version krävs' });
        if (typeof value !== 'string') return res.status(400).json({ error: 'value måste vara en sträng' });

        const parsed = parse_audit_part_key(part_key);
        if (!parsed || String(parsed.audit_id) !== String(id)) return res.status(400).json({ error: 'Ogiltig part_key' });

        // Hämta aktuellt samples och uppdatera minsta möjliga del i Node (v1).
        const row = await query('SELECT id, version, samples, rule_set_id, rule_file_content, status, metadata, archived_requirement_results, last_rulefile_update_log FROM audits WHERE id = $1', [id]);
        if (row.rows.length === 0) return res.status(404).json({ error: 'Granskning hittades inte' });
        const audit = row.rows[0];
        if (Number(audit.version) !== base_version) {
            return res.status(409).json({ error: 'Versionskonflikt', serverVersion: Number(audit.version), lastUpdatedBy: audit.last_updated_by ?? null });
        }

        const samples = Array.isArray(audit.samples) ? JSON.parse(JSON.stringify(audit.samples)) : [];
        const sample = samples.find(s => String(s?.id) === String(parsed.sample_id));
        if (!sample) return res.status(400).json({ error: 'Stickprov hittades inte för part_key' });
        if (!sample.requirementResults) sample.requirementResults = {};
        const req_res = sample.requirementResults[parsed.requirement_id] || {};
        sample.requirementResults[parsed.requirement_id] = req_res;

        if (parsed.kind === 'req_text') {
            req_res[parsed.field] = value;
        } else if (parsed.kind === 'observation_detail') {
            if (!req_res.checkResults) req_res.checkResults = {};
            if (!req_res.checkResults[parsed.check_id]) req_res.checkResults[parsed.check_id] = { passCriteria: {} };
            if (!req_res.checkResults[parsed.check_id].passCriteria) req_res.checkResults[parsed.check_id].passCriteria = {};
            if (!req_res.checkResults[parsed.check_id].passCriteria[parsed.pc_id]) req_res.checkResults[parsed.check_id].passCriteria[parsed.pc_id] = {};
            req_res.checkResults[parsed.check_id].passCriteria[parsed.pc_id].observationDetail = value;
        } else {
            return res.status(400).json({ error: 'Denna part_key stöds inte för patch än' });
        }

        const update = await query(
            `UPDATE audits
             SET samples = $1,
                 version = version + 1,
                 last_updated_by = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 AND version = $4
             RETURNING *`,
            [JSON.stringify(samples), user?.name || null, id, base_version]
        );
        if (update.rows.length === 0) {
            const check = await query('SELECT version, last_updated_by FROM audits WHERE id = $1', [id]);
            if (check.rows.length === 0) return res.status(404).json({ error: 'Granskning hittades inte' });
            return res.status(409).json({ error: 'Versionskonflikt', serverVersion: Number(check.rows[0].version), lastUpdatedBy: check.rows[0].last_updated_by ?? null });
        }

        const updated_audit = update.rows[0];
        let ruleSet = null;
        if (updated_audit.rule_set_id) {
            const ruleResult = await fetch_rule_set_by_id(updated_audit.rule_set_id);
            ruleSet = ruleResult.rows[0] || null;
        }
        const fullState = build_full_state(updated_audit, ruleSet);
        broadcast_audits_changed();
        res.json(fullState);
    } catch (err) {
        console.error('[audits] PATCH content-part error:', err);
        res.status(500).json({ error: 'Kunde inte uppdatera del av granskningen' });
    }
});

router.patch('/:id/results/:sampleId/:requirementId', async (req, res) => {
    try {
        const { id, sampleId, requirementId } = req.params;
        const { version, result: newResult } = req.body;
        const last_updated_by = req.user ? req.user.name : null;
        const auditResult = await query(
            `SELECT id, rule_set_id, rule_file_content, status, metadata, samples, version, last_updated_by, created_at, updated_at::text AS updated_at
             FROM audits WHERE id = $1`, [id]
        );
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
            const ruleResult = await fetch_rule_set_by_id(updated.rule_set_id);
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
