/**
 * @fileoverview Bygger fullständigt API-state för en granskningsrad (+ ev. regelfilsrad).
 */

type RuleSetRow = {
    published_content?: unknown;
    content?: unknown;
};

export type AuditRow = {
    id: string;
    rule_set_id?: string | null;
    rule_file_content?: unknown;
    status?: string;
    metadata?: Record<string, unknown> & { startTime?: string; endTime?: string };
    samples?: unknown[];
    version?: number;
    created_at?: string | null;
    updated_at?: string | null;
    archived_requirement_results?: unknown;
    last_rulefile_update_log?: unknown;
};

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
    const samples = audit_row.samples || [];
    const meta = audit_row.metadata || {};
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
    const meta = audit_row.metadata || {};
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
