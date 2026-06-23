/**
 * @fileoverview Express-router för granskningar (API under /audits).
 * Laddas via bryggan `audits.js` så Node/tsx inte får cirkulär självimport.
 */

import express from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../auth/middleware.js';
import { import_payload_rate_limiter, media_upload_rate_limiter } from '../middleware/rateLimiter.js';
import { register_audit_media_routes } from './audit_media_routes.js';
import { attach_export_integrity_server_payload } from '../utils/export_integrity_node.js';
import { build_statistics_from_audit_rows } from '../audit_aggregated_statistics.js';
import { parse_audit_part_key } from '../../shared/audit/audit_part_keys.js';
import {
    fetch_audits_index_rows,
    fetch_statistics_audits_locked_archived
} from '../repositories/audit_repository.js';
import { fetch_rule_set_by_id } from '../repositories/rule_repository.js';
import type { Request, Response } from 'express';
import { CreateAuditBodySchema } from '../schemas/audit_create.js';
import {
    AuditLockBodySchema,
    AuditLockHeartbeatBodySchema,
    AuditLockReleaseInputSchema,
    AuditListStatusQuerySchema
} from '../schemas/audit_lock.js';
import { AuditRowSchema, AuditVersionRowSchema, RuleSetRowSchema } from '../schemas/audit_db_rows.js';
import { parse_body, parse_db_row, parse_query, safe_parse_db_row } from '../utils/zod_boundary.js';
import { single_route_param } from '../utils/route_params.js';
import { build_full_state } from './audit_build_state.js';
import { broadcast_audit_locks_changed } from './audit_route_support.js';
import { map_audit_index_row_to_list_item } from './audit_index_row_mapper.js';
import { register_audit_import_route } from './audit_import_routes.js';
import { register_audit_patch_routes } from './audit_patch_routes.js';

type AuthedRequest = express.Request & { user?: { id: string; name: string } };

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
    try {
        const query_params = parse_query(AuditListStatusQuerySchema, req.query, res);
        if (!query_params) {
            return;
        }
        const result = await fetch_audits_index_rows(query_params.status);
        const rows = result.rows.map((row: unknown) => map_audit_index_row_to_list_item(row));
        res.json(rows);
    } catch (err) {
        console.error('[audits] GET list error:', err);
        res.status(500).json({ error: 'Kunde inte hämta granskningar' });
    }
});

router.get('/statistics/summary', async (_req: Request, res: Response) => {
    try {
        const result = await fetch_statistics_audits_locked_archived();
        const payload = build_statistics_from_audit_rows(result.rows);
        res.json(payload);
    } catch (err) {
        console.error('[audits] GET statistics summary error:', err);
        res.status(500).json({ error: 'Kunde inte hämta statistik' });
    }
});

router.get('/:id/version', async (req: Request, res: Response) => {
    try {
        const id = single_route_param(req.params.id);
        const result = await query('SELECT version, updated_at FROM audits WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Granskning hittades inte' });
        }
        const row = parse_db_row(AuditVersionRowSchema, result.rows[0]);
        res.json({ version: row.version, updated_at: row.updated_at });
    } catch (err) {
        console.error('[audits] GET version error:', err);
        res.status(500).json({ error: 'Kunde inte hämta version' });
    }
});

router.get('/:id/locks', async (req: Request, res: Response) => {
    try {
        const id = single_route_param(req.params.id);
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

router.post('/:id/locks', async (req: Request, res: Response) => {
    try {
        const id = single_route_param(req.params.id);
        const user = (req as AuthedRequest).user!;
        const body = parse_body(AuditLockBodySchema, req.body, res);
        if (!body) {
            return;
        }
        const { part_key, client_lock_id, ttl_seconds: requested_ttl_seconds } = body;
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

router.post('/:id/locks/:partKey/heartbeat', async (req: Request, res: Response) => {
    try {
        const id = single_route_param(req.params.id);
        const partKey = single_route_param(req.params.partKey);
        const user = (req as AuthedRequest).user!;
        const part_key = decodeURIComponent(partKey);
        const body = parse_body(AuditLockHeartbeatBodySchema, req.body, res);
        if (!body) {
            return;
        }
        const { client_lock_id, ttl_seconds: requested_ttl_seconds } = body;
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

router.delete('/:id/locks/:partKey', async (req: Request, res: Response) => {
    try {
        const id = single_route_param(req.params.id);
        const partKey = single_route_param(req.params.partKey);
        const user = (req as AuthedRequest).user!;
        const part_key = decodeURIComponent(partKey);
        const release_input = parse_body(AuditLockReleaseInputSchema, {
            client_lock_id: req.query?.client_lock_id || req.body?.client_lock_id
        }, res);
        if (!release_input) {
            return;
        }
        const { client_lock_id } = release_input;
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

router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = single_route_param(req.params.id);
        const auditResult = await query(
            `SELECT id, rule_set_id, rule_file_content, status, metadata, samples, version, last_updated_by, created_at, updated_at::text AS updated_at
             FROM audits WHERE id = $1`,
            [id]
        );
        if (auditResult.rows.length === 0) {
            return res.status(404).json({ error: 'Granskning hittades inte' });
        }
        const audit = parse_db_row(AuditRowSchema, auditResult.rows[0]);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        let ruleSet = null;
        if (audit.rule_set_id) {
            const ruleResult = await fetch_rule_set_by_id(audit.rule_set_id);
            ruleSet = safe_parse_db_row(RuleSetRowSchema, ruleResult.rows[0] || null);
        }
        const fullState = build_full_state(audit, ruleSet);
        res.json(fullState);
    } catch (err) {
        console.error('[audits] GET one error:', err);
        res.status(500).json({ error: 'Kunde inte hämta granskning' });
    }
});

router.get('/:id/export', async (req: Request, res: Response) => {
    try {
        const id = single_route_param(req.params.id);
        const auditResult = await query(
            `SELECT id, rule_set_id, rule_file_content, status, metadata, samples, version, last_updated_by, created_at, updated_at::text AS updated_at
             FROM audits WHERE id = $1`,
            [id]
        );
        if (auditResult.rows.length === 0) {
            return res.status(404).json({ error: 'Granskning hittades inte' });
        }
        const audit = parse_db_row(AuditRowSchema, auditResult.rows[0]);
        let ruleSet = null;
        if (audit.rule_set_id) {
            const ruleResult = await fetch_rule_set_by_id(audit.rule_set_id);
            ruleSet = safe_parse_db_row(RuleSetRowSchema, ruleResult.rows[0] || null);
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

router.post('/', async (req: Request, res: Response) => {
    try {
        const body = parse_body(CreateAuditBodySchema, req.body, res);
        if (!body) {
            return;
        }
        const { rule_set_id } = body;
        const r = req as AuthedRequest;
        const last_updated_by = r.user ? r.user.name : null;
        const ruleResult = await fetch_rule_set_by_id(rule_set_id);
        if (ruleResult.rows.length === 0) {
            return res.status(404).json({ error: 'Regelfil hittades inte' });
        }
        const ruleSet = safe_parse_db_row(RuleSetRowSchema, ruleResult.rows[0]);
        if (!ruleSet) {
            return res.status(500).json({ error: 'Regelfil hittades inte' });
        }
        const rule_content_for_audit = ruleSet.published_content ?? ruleSet.content;
        const result = await query(
            'INSERT INTO audits (rule_set_id, rule_file_content, status, metadata, samples, last_updated_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [rule_set_id, rule_content_for_audit, 'not_started', '{}', '[]', last_updated_by]
        );
        const audit = parse_db_row(AuditRowSchema, result.rows[0]);
        const fullState = build_full_state(audit, ruleSet);
        res.status(201).json(fullState);
    } catch (err) {
        console.error('[audits] POST error:', err);
        res.status(500).json({ error: 'Kunde inte skapa granskning' });
    }
});

register_audit_media_routes(router, media_upload_rate_limiter);

register_audit_import_route(router, import_payload_rate_limiter);

router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
        const id = single_route_param(req.params.id);
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

register_audit_patch_routes(router);

export default router;
