/**
 * @fileoverview PATCH /audits/:id och PATCH …/results/… — optimistisk version och meningsfull updated_at.
 */

import type { IRouter, Request, Response } from 'express';
import { query } from '../db.js';
import { fetch_rule_set_by_id } from '../repositories/rule_repository.js';
import { save_backup_for_audit } from '../backup/audit_backup.js';
import { has_meaningful_audit_patch_change } from '../logic/audit_meaningful_change.js';
import { is_incoming_audit_samples_older_than_existing } from '../logic/audit_incoming_stale_guard.js';
import {
    AuditPatchBodySchema,
    AuditRequirementPatchBodySchema
} from '../schemas/audit_patch.js';
import {
    AuditRowMeaningfulSourceSchema,
    AuditRowSchema,
    RuleSetRowSchema
} from '../schemas/audit_db_rows.js';
import { parse_body, parse_db_row, safe_parse_db_row } from '../utils/zod_boundary.js';
import { single_route_param } from '../utils/route_params.js';
import { build_full_state } from './audit_build_state.js';
import { broadcast_audit_requirement_updated, broadcast_audits_changed } from './audit_route_support.js';
import {
    purge_audit_snapshots_for_sample,
    purge_orphan_audit_snapshots,
} from '../services/audit_snapshot_cleanup_service.js';

type AuthedRequest = Request & { user?: { id?: string | null; name?: string | null } };

export function register_audit_patch_routes(router: IRouter): void {
    router.patch('/:id', async (req: Request, res: Response) => {
        try {
            const id = single_route_param(req.params.id);
            const body = parse_body(AuditPatchBodySchema, req.body, res);
            if (!body) {
                return;
            }
            const {
                metadata,
                status,
                samples,
                ruleSetId,
                ruleFileContent,
                archivedRequirementResults,
                lastRulefileUpdateLog,
                expectedVersion: expect_num
            } = body;
            const r = req as AuthedRequest;
            const last_updated_by = r.user ? (r.user.id || r.user.name || null) : null;
            const updates: string[] = [];
            const values: unknown[] = [];
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
                values.push(JSON.stringify(samples));
            }
            if (ruleSetId !== undefined) {
                const normalized_rule_set_id =
                    ruleSetId === null || ruleSetId === '' ? null : String(ruleSetId).trim();
                updates.push(`rule_set_id = $${i++}`);
                values.push(normalized_rule_set_id);
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

            const existing_result = await query(
                `SELECT metadata, status, samples, rule_file_content, archived_requirement_results,
                    last_rulefile_update_log, version, last_updated_by
             FROM audits WHERE id = $1`,
                [id]
            );
            if (existing_result.rows.length === 0) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const existing_row = safe_parse_db_row(AuditRowMeaningfulSourceSchema, existing_result.rows[0]);
            if (!existing_row) {
                return res.status(500).json({ error: 'Kunde inte läsa granskning från databasen' });
            }
            const existing_version = Number(
                (existing_result.rows[0] as { version?: unknown }).version
            );
            if (existing_version !== expect_num) {
                return res.status(409).json({
                    error: 'Versionskonflikt',
                    serverVersion: existing_version,
                    lastUpdatedBy: (existing_result.rows[0] as { last_updated_by?: string | null }).last_updated_by ?? null
                });
            }

            if (
                samples !== undefined &&
                is_incoming_audit_samples_older_than_existing(existing_row.samples, samples)
            ) {
                return res.status(409).json({
                    error: 'Inkommande granskning är äldre än versionen på servern',
                    serverVersion: existing_version,
                    lastUpdatedBy: (existing_result.rows[0] as { last_updated_by?: string | null }).last_updated_by ?? null
                });
            }

            const bump_updated_at = has_meaningful_audit_patch_change(existing_row, {
                metadata,
                status,
                samples,
                ruleFileContent,
                archivedRequirementResults,
                lastRulefileUpdateLog
            });
            updates.push(bump_updated_at ? 'updated_at = CURRENT_TIMESTAMP' : 'updated_at = updated_at');
            if (bump_updated_at && last_updated_by !== null) {
                updates.push(`last_updated_by = $${i++}`);
                values.push(last_updated_by);
            }

            const id_placeholder = i;
            const version_placeholder = i + 1;
            values.push(id);
            values.push(expect_num);
            const result = await query(
                `UPDATE audits SET ${updates.join(', ')} WHERE id = $${id_placeholder} AND version = $${version_placeholder} RETURNING *`,
                values
            );
            if (result.rows.length === 0) {
                const check = await query('SELECT version, last_updated_by FROM audits WHERE id = $1', [id]);
                if (check.rows.length === 0) {
                    return res.status(404).json({ error: 'Granskning hittades inte' });
                }
                const row = check.rows[0] as { version: number; last_updated_by?: string | null };
                return res.status(409).json({
                    error: 'Versionskonflikt',
                    serverVersion: Number(row.version),
                    lastUpdatedBy: row.last_updated_by ?? null
                });
            }
            const audit = parse_db_row(AuditRowSchema, result.rows[0]);

            if (samples !== undefined) {
                const previous_samples = Array.isArray(existing_row.samples) ? existing_row.samples : [];
                const previous_ids = new Set(
                    previous_samples.map((s: { id?: string }) => String(s?.id ?? '')).filter(Boolean)
                );
                const next_ids = new Set(
                    (Array.isArray(samples) ? samples : [])
                        .map((s: { id?: string }) => String(s?.id ?? ''))
                        .filter(Boolean)
                );
                for (const sample_id of previous_ids) {
                    if (!next_ids.has(sample_id)) {
                        await purge_audit_snapshots_for_sample(id, sample_id);
                    }
                }
                await purge_orphan_audit_snapshots(id, [...next_ids]);
            }

            let ruleSet = null;
            if (audit.rule_set_id) {
                const ruleResult = await fetch_rule_set_by_id(audit.rule_set_id);
                ruleSet = safe_parse_db_row(RuleSetRowSchema, ruleResult.rows[0] || null);
            }
            const fullState = build_full_state(audit, ruleSet);
            broadcast_audits_changed(id, { version: Number(audit.version), changeKind: 'full' });

            if (status === 'locked') {
                setImmediate(() => {
                    save_backup_for_audit(fullState, { backup_suffix_key: 'filename_locked_suffix' }).catch((err: Error) => {
                        console.warn('[audits] Säkerhetskopiering vid låsning misslyckades:', err.message);
                    });
                });
            }

            res.json(fullState);
        } catch (err: unknown) {
            const e = err as Error;
            console.error('[audits] PATCH error:', e.message, e.stack);
            res.status(500).json({ error: 'Kunde inte uppdatera granskning' });
        }
    });

    router.patch('/:id/results/:sampleId/:requirementId', async (req: Request, res: Response) => {
        try {
            const id = single_route_param(req.params.id);
            const sampleId = single_route_param(req.params.sampleId);
            const requirementId = single_route_param(req.params.requirementId);
            const body = parse_body(AuditRequirementPatchBodySchema, req.body, res);
            if (!body) {
                return;
            }
            const { version, result: newResult } = body;
            const r = req as AuthedRequest;
            const last_updated_by = r.user ? (r.user.id || r.user.name || null) : null;
            const auditResult = await query(
                `SELECT id, rule_set_id, rule_file_content, status, metadata, samples, version, last_updated_by, created_at, updated_at::text AS updated_at
             FROM audits WHERE id = $1`,
                [id]
            );
            if (auditResult.rows.length === 0) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const audit = parse_db_row(AuditRowSchema, auditResult.rows[0]);
            if (version !== undefined && audit.version !== version) {
                return res.status(409).json({ error: 'Versionskonflikt', serverVersion: audit.version });
            }
            type SampleRow = { id?: string; requirementResults?: Record<string, unknown> };
            const samples: SampleRow[] = Array.isArray(audit.samples) ? [...(audit.samples as SampleRow[])] : [];
            const existing_index = samples.findIndex((s) => s.id === sampleId);
            let sample: SampleRow;
            if (existing_index >= 0) {
                sample = samples[existing_index];
            } else {
                sample = { id: sampleId, requirementResults: {} };
                samples.push(sample);
            }
            if (!sample.requirementResults) {
                sample.requirementResults = {};
            }
            sample.requirementResults[requirementId] = newResult;
            const updateResult = await query(
                'UPDATE audits SET samples = $1, version = version + 1, last_updated_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
                [JSON.stringify(samples), last_updated_by, id]
            );
            const updated = parse_db_row(AuditRowSchema, updateResult.rows[0]);
            let ruleSet = null;
            if (updated.rule_set_id) {
                const ruleResult = await fetch_rule_set_by_id(updated.rule_set_id);
                ruleSet = safe_parse_db_row(RuleSetRowSchema, ruleResult.rows[0] || null);
            }
            const fullState = build_full_state(updated, ruleSet);
            broadcast_audit_requirement_updated({
                auditId: id,
                version: Number(updated.version),
                sampleId,
                requirementId,
                result: newResult,
                updatedBy: last_updated_by
            });
            res.json(fullState);
        } catch (err) {
            console.error('[audits] PATCH result error:', err);
            res.status(500).json({ error: 'Kunde inte uppdatera resultat' });
        }
    });
}
