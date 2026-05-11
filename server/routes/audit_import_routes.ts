/**
 * @fileoverview POST /audits/import — validering och insert/ersätt.
 */

import type { IRouter, Request, Response, RequestHandler } from 'express';
import { check_json_structure_depth_and_size } from '../../shared/json/json_structure_guard.js';
import { validate_saved_audit_file } from '../../js/validation_logic.js';
import { query } from '../db.js';
import { audit_import_t } from './audit_route_support.js';
import { build_full_state, type AuditRow } from './audit_build_state.js';
import {
    UUID_REGEX,
    build_existing_audit_summary_for_response,
    find_import_conflict_audit_id
} from './audit_import_internals.js';

type AuthedRequest = Request & { user?: { name?: string | null } };

export function register_audit_import_route(router: IRouter, import_limiter: RequestHandler): void {
    router.post('/import', import_limiter, async (req: Request, res: Response) => {
        try {
            const raw = req.body as Record<string, unknown> & {
                replaceExistingAuditId?: string;
                ruleFileContent?: unknown;
                auditMetadata?: unknown;
                auditStatus?: string;
                samples?: unknown[];
                archivedRequirementResults?: unknown[];
                lastRulefileUpdateLog?: unknown;
            };
            const replaceExistingAuditId = raw.replaceExistingAuditId;
            const data = { ...raw };
            delete data.replaceExistingAuditId;

            const structure_check = check_json_structure_depth_and_size(data);
            if (!structure_check.ok) {
                const msg =
                    structure_check.reason === 'too_deep'
                        ? 'JSON-strukturen är för djupt nästlad.'
                        : 'JSON-strukturen är för stor (för många fält eller värden).';
                return res.status(400).json({ error: msg });
            }
            const r = req as AuthedRequest;
            const last_updated_by = r.user ? r.user.name : null;
            const audit_validation = validate_saved_audit_file(data, {
                t: (key: string, replacements?: Record<string, string | number>) =>
                    audit_import_t(key, replacements || {})
            });
            if (!audit_validation?.isValid) {
                return res.status(400).json({
                    error: audit_validation?.message || 'Ogiltig granskningsdata'
                });
            }
            if (!data.ruleFileContent) {
                return res.status(400).json({ error: 'ruleFileContent krävs' });
            }

            const conflict_id = await find_import_conflict_audit_id(data as never);

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

                const metadata = (data.auditMetadata || {}) as Record<string, unknown>;
                const samples = data.samples || [];
                const status = data.auditStatus || 'not_started';
                const archived_requirement_results = Array.isArray(data.archivedRequirementResults)
                    ? data.archivedRequirementResults
                    : [];
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
                const audit = update_result.rows[0] as AuditRow;
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

            const metadata = (data.auditMetadata || {}) as Record<string, unknown>;
            const samples = data.samples || [];
            const status = data.auditStatus || 'not_started';
            const archived_requirement_results = Array.isArray(data.archivedRequirementResults)
                ? data.archivedRequirementResults
                : [];
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
            const audit = result.rows[0] as AuditRow;
            const fullState = build_full_state(audit, null);
            res.status(201).json(fullState);
        } catch (err) {
            console.error('[audits] import error:', err);
            res.status(500).json({ error: 'Kunde inte importera' });
        }
    });
}
