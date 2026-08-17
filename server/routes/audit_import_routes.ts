/**
 * @fileoverview POST /audits/import — validering och insert/ersätt.
 */

import type { IRouter, Request, Response, RequestHandler } from 'express';
import { check_json_structure_depth_and_size } from '../../shared/json/json_structure_guard.js';
import { validate_saved_audit_file } from '../../js/validation_logic.js';
import { query } from '../db.js';
import { AuditImportBodySchema, validate_replace_existing_audit_id } from '../schemas/audit_import.js';
import { AuditRowSchema } from '../schemas/audit_db_rows.js';
import { parse_body, parse_db_row } from '../utils/zod_boundary.js';
import { audit_import_t } from './audit_route_support.js';
import { build_full_state } from './audit_build_state.js';
import {
    build_existing_audit_summary_for_response,
    find_import_conflict_audit_id
} from './audit_import_internals.js';

type AuthedRequest = Request & { user?: { id?: string | null; name?: string | null } };

function resolve_import_rule_set_id(
    rule_set_id: unknown,
    metadata: Record<string, unknown>
): string | null {
    const from_body = rule_set_id !== null && rule_set_id !== undefined ? String(rule_set_id).trim() : '';
    if (from_body) return from_body;
    const bound = metadata.boundRuleSetId;
    if (bound !== null && bound !== undefined && String(bound).trim() !== '') {
        return String(bound).trim();
    }
    return null;
}

export function register_audit_import_route(router: IRouter, import_limiter: RequestHandler): void {
    router.post('/import', import_limiter, async (req: Request, res: Response) => {
        try {
            const raw = parse_body(AuditImportBodySchema, req.body, res);
            if (!raw) {
                return;
            }
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
            const last_updated_by = r.user ? (r.user.id || r.user.name || null) : null;
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

            const conflict_id = await find_import_conflict_audit_id({
                auditId: typeof data.auditId === 'string' ? data.auditId : undefined,
                samples: Array.isArray(data.samples)
                    ? (data.samples as Array<{ id?: string }>)
                    : undefined
            });

            if (replaceExistingAuditId !== undefined && replaceExistingAuditId !== null && replaceExistingAuditId !== '') {
                const validated_replace_id = validate_replace_existing_audit_id(replaceExistingAuditId);
                if (!validated_replace_id) {
                    return res.status(400).json({ error: 'Ogiltigt värde för replaceExistingAuditId.' });
                }
                if (!conflict_id) {
                    return res.status(400).json({
                        error: 'Ingen dubblett att ersätta: granskningen finns inte redan i databasen.'
                    });
                }
                if (String(conflict_id) !== String(validated_replace_id)) {
                    return res.status(400).json({
                        error: 'Ersättnings-id matchar inte den befintliga granskningen.'
                    });
                }

                const metadata =
                    data.auditMetadata && typeof data.auditMetadata === 'object' && !Array.isArray(data.auditMetadata)
                        ? (data.auditMetadata as Record<string, unknown>)
                        : {};
                const rule_set_id = resolve_import_rule_set_id(data.ruleSetId, metadata);
                const samples = Array.isArray(data.samples) ? data.samples : [];
                const status = typeof data.auditStatus === 'string' ? data.auditStatus : 'not_started';
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
                        rule_set_id,
                        data.ruleFileContent,
                        status,
                        JSON.stringify(metadata),
                        JSON.stringify(samples),
                        JSON.stringify(archived_requirement_results),
                        last_rulefile_update_log ? JSON.stringify(last_rulefile_update_log) : null,
                        last_updated_by,
                        validated_replace_id
                    ]
                );
                if (update_result.rows.length === 0) {
                    return res.status(404).json({ error: 'Granskning hittades inte' });
                }
                const audit = parse_db_row(AuditRowSchema, update_result.rows[0]);
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

            const metadata =
                data.auditMetadata && typeof data.auditMetadata === 'object' && !Array.isArray(data.auditMetadata)
                    ? (data.auditMetadata as Record<string, unknown>)
                    : {};
            const rule_set_id = resolve_import_rule_set_id(data.ruleSetId, metadata);
            const samples = Array.isArray(data.samples) ? data.samples : [];
            const status = typeof data.auditStatus === 'string' ? data.auditStatus : 'not_started';
            const archived_requirement_results = Array.isArray(data.archivedRequirementResults)
                ? data.archivedRequirementResults
                : [];
            const last_rulefile_update_log = data.lastRulefileUpdateLog || null;
            const result = await query(
                'INSERT INTO audits (rule_set_id, rule_file_content, status, metadata, samples, archived_requirement_results, last_rulefile_update_log, last_updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [
                    rule_set_id,
                    data.ruleFileContent,
                    status,
                    JSON.stringify(metadata),
                    JSON.stringify(samples),
                    JSON.stringify(archived_requirement_results),
                    last_rulefile_update_log ? JSON.stringify(last_rulefile_update_log) : null,
                    last_updated_by
                ]
            );
            const audit = parse_db_row(AuditRowSchema, result.rows[0]);
            const fullState = build_full_state(audit, null);
            res.status(201).json(fullState);
        } catch (err) {
            console.error('[audits] import error:', err);
            res.status(500).json({ error: 'Kunde inte importera' });
        }
    });
}
