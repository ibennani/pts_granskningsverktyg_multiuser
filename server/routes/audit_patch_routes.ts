/**
 * @fileoverview PATCH /audits/:id och PATCH …/results/… — optimistisk version och meningsfull updated_at.
 */

import type { IRouter, Request, Response } from 'express';
import { query } from '../db.js';
import { fetch_rule_set_by_id } from '../repositories/rule_repository.js';
import { save_backup_for_audit } from '../backup/audit_backup.js';
import { has_meaningful_audit_patch_change } from '../logic/audit_meaningful_change.js';
import { is_incoming_audit_samples_older_than_existing } from '../logic/audit_incoming_stale_guard.js';
import { build_full_state, type AuditRow } from './audit_build_state.js';
import { broadcast_audits_changed } from './audit_route_support.js';

type AuthedRequest = Request & { user?: { name?: string | null } };

type RuleSetRow = { published_content?: unknown; content?: unknown };

export function register_audit_patch_routes(router: IRouter): void {
    router.patch('/:id', async (req: Request, res: Response) => {
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
            } = req.body as Record<string, unknown>;
            if (expectedVersion === undefined || expectedVersion === null) {
                return res.status(400).json({ error: 'expectedVersion krävs för att spara granskningen' });
            }
            const expect_num = Number(expectedVersion);
            if (!Number.isFinite(expect_num)) {
                return res.status(400).json({ error: 'expectedVersion måste vara ett tal' });
            }
            const r = req as AuthedRequest;
            const last_updated_by = r.user ? r.user.name : null;
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

            const existing_result = await query(
                `SELECT metadata, status, samples, rule_file_content, archived_requirement_results,
                    last_rulefile_update_log, version, last_updated_by
             FROM audits WHERE id = $1`,
                [id]
            );
            if (existing_result.rows.length === 0) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const existing_row = existing_result.rows[0] as Record<string, unknown>;
            if (Number(existing_row.version) !== expect_num) {
                return res.status(409).json({
                    error: 'Versionskonflikt',
                    serverVersion: Number(existing_row.version),
                    lastUpdatedBy: existing_row.last_updated_by ?? null
                });
            }

            if (
                samples !== undefined &&
                is_incoming_audit_samples_older_than_existing(existing_row.samples, samples)
            ) {
                return res.status(409).json({
                    error: 'Inkommande granskning är äldre än versionen på servern',
                    serverVersion: Number(existing_row.version),
                    lastUpdatedBy: existing_row.last_updated_by ?? null
                });
            }

            const bump_updated_at = has_meaningful_audit_patch_change(
                {
                    metadata: existing_row.metadata,
                    status: existing_row.status,
                    samples: existing_row.samples,
                    rule_file_content: existing_row.rule_file_content,
                    archived_requirement_results: existing_row.archived_requirement_results,
                    last_rulefile_update_log: existing_row.last_rulefile_update_log
                },
                {
                    metadata,
                    status,
                    samples,
                    ruleFileContent,
                    archivedRequirementResults,
                    lastRulefileUpdateLog
                }
            );
            updates.push(bump_updated_at ? 'updated_at = CURRENT_TIMESTAMP' : 'updated_at = updated_at');

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
            const audit = result.rows[0] as AuditRow;
            let ruleSet: RuleSetRow | null = null;
            if (audit.rule_set_id) {
                const ruleResult = await fetch_rule_set_by_id(audit.rule_set_id);
                ruleSet = (ruleResult.rows[0] || null) as RuleSetRow | null;
            }
            const fullState = build_full_state(audit, ruleSet);
            broadcast_audits_changed(id);

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
            const { id, sampleId, requirementId } = req.params;
            const { version, result: newResult } = req.body as { version?: number; result: unknown };
            const r = req as AuthedRequest;
            const last_updated_by = r.user ? r.user.name : null;
            const auditResult = await query(
                `SELECT id, rule_set_id, rule_file_content, status, metadata, samples, version, last_updated_by, created_at, updated_at::text AS updated_at
             FROM audits WHERE id = $1`,
                [id]
            );
            if (auditResult.rows.length === 0) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const audit = auditResult.rows[0] as AuditRow & { samples?: unknown[] };
            if (version !== undefined && audit.version !== version) {
                return res.status(409).json({ error: 'Versionskonflikt', serverVersion: audit.version });
            }
            type SampleRow = { id?: string; requirementResults?: Record<string, unknown> };
            const samples: SampleRow[] = Array.isArray(audit.samples) ? [...audit.samples] as SampleRow[] : [];
            let sample = samples.find((s) => s.id === sampleId);
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
            const updated = updateResult.rows[0] as AuditRow;
            let ruleSet: RuleSetRow | null = null;
            if (updated.rule_set_id) {
                const ruleResult = await fetch_rule_set_by_id(updated.rule_set_id);
                ruleSet = (ruleResult.rows[0] || null) as RuleSetRow | null;
            }
            const fullState = build_full_state(updated, ruleSet);
            broadcast_audits_changed(id);
            res.json(fullState);
        } catch (err) {
            console.error('[audits] PATCH result error:', err);
            res.status(500).json({ error: 'Kunde inte uppdatera resultat' });
        }
    });
}
