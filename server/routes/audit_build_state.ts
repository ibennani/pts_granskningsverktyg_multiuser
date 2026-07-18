/**
 * @fileoverview Bygger fullständigt API-state för en granskningsrad (+ ev. regelfilsrad).
 */

import { type AuditRow, type RuleSetRow } from '../schemas/audit_db_rows.js';
import {
    apply_audit_type_overlay_to_rule_content,
    read_published_rule_content_from_rule_set_row,
    snapshot_lacks_audit_types,
} from '../../shared/audit/audit_type_catalog.js';
import { build_default_published_audit_types_content } from '../../shared/audit/audit_type_rule_set_resolve.js';

export type { AuditRow, RuleSetRow };

export function build_full_state(audit_row: AuditRow, rule_set_row: RuleSetRow | null): Record<string, unknown> {
    let ruleFileContent: unknown =
        audit_row?.rule_file_content ?? (rule_set_row ? (rule_set_row.published_content ?? rule_set_row.content) : null);
    if (ruleFileContent && typeof ruleFileContent === 'string') {
        try {
            ruleFileContent = JSON.parse(ruleFileContent);
        } catch {
            console.warn('[audits] build_full_state: Kunde inte parsa rule content för audit', audit_row?.id);
            ruleFileContent = null;
        }
    }
    if (ruleFileContent) {
        const published_rule_content = read_published_rule_content_from_rule_set_row(rule_set_row);
        ruleFileContent = apply_audit_type_overlay_to_rule_content(
            ruleFileContent,
            published_rule_content
        );
        if (snapshot_lacks_audit_types(ruleFileContent)) {
            ruleFileContent = apply_audit_type_overlay_to_rule_content(
                ruleFileContent,
                build_default_published_audit_types_content()
            );
        }
    }
    const samples = audit_row.samples || [];
    const meta =
        audit_row.metadata && typeof audit_row.metadata === 'object' && !Array.isArray(audit_row.metadata)
            ? (audit_row.metadata as Record<string, unknown>)
            : {};
    return {
        saveFileVersion: '2.1.0',
        ruleFileContent,
        auditMetadata: audit_row.metadata || {},
        auditStatus: audit_row.status,
        created_at: audit_row.created_at ?? null,
        updated_at: audit_row.updated_at ?? null,
        startTime: meta.startTime || null,
        endTime: meta.endTime || null,
        samples,
        deficiencyCounter: 1,
        ruleFileOriginalContentString: null,
        ruleFileOriginalFilename: '',
        version: audit_row.version,
        auditId: audit_row.id,
        ruleSetId: audit_row.rule_set_id,
        archivedRequirementResults: Array.isArray(audit_row.archived_requirement_results)
            ? audit_row.archived_requirement_results
            : [],
        lastRulefileUpdateLog: audit_row.last_rulefile_update_log || null
    };
}

/** Audit-data utan ruleFileContent – regelfilen hämtas separat via rule_set_id. */
export function build_audit_state_without_rule_file(audit_row: AuditRow): Record<string, unknown> {
    const samples = audit_row.samples || [];
    const meta =
        audit_row.metadata && typeof audit_row.metadata === 'object' && !Array.isArray(audit_row.metadata)
            ? (audit_row.metadata as Record<string, unknown>)
            : {};
    return {
        saveFileVersion: '2.1.0',
        auditMetadata: audit_row.metadata || {},
        auditStatus: audit_row.status,
        created_at: audit_row.created_at ?? null,
        updated_at: audit_row.updated_at ?? null,
        startTime: meta.startTime || null,
        endTime: meta.endTime || null,
        samples,
        deficiencyCounter: 1,
        ruleFileOriginalContentString: null,
        ruleFileOriginalFilename: '',
        version: audit_row.version,
        auditId: audit_row.id,
        ruleSetId: audit_row.rule_set_id,
        archivedRequirementResults: Array.isArray(audit_row.archived_requirement_results)
            ? audit_row.archived_requirement_results
            : [],
        lastRulefileUpdateLog: audit_row.last_rulefile_update_log || null
    };
}
