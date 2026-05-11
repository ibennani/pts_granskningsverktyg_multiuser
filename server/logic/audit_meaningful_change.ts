/**
 * @fileoverview Avgör om en gransknings-PATCH innebär meningsfull innehållsändring
 * (allt utom audit_edit_log i metadata) för styrning av updated_at.
 */

import { isDeepStrictEqual } from 'node:util';

const AUDIT_EDIT_LOG_KEY = 'audit_edit_log';

/** Rå rad från databasen (jsonb kan redan vara objekt). */
export type AuditRowMeaningfulSource = {
    metadata: unknown;
    status: unknown;
    samples: unknown;
    rule_file_content: unknown;
    archived_requirement_results: unknown;
    last_rulefile_update_log: unknown;
};

/** Inkommande PATCH-kropp (snake_case i DB, camelCase från klient). */
export type AuditPatchBodySlice = {
    metadata?: unknown;
    status?: unknown;
    samples?: unknown;
    ruleFileContent?: unknown;
    archivedRequirementResults?: unknown;
    lastRulefileUpdateLog?: unknown;
};

function parse_json_if_string<T>(value: unknown): T | null {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }
    return value as T;
}

function normalize_metadata_for_compare(metadata: unknown): Record<string, unknown> {
    const parsed = parse_json_if_string<Record<string, unknown>>(metadata);
    const base =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? { ...parsed }
            : {};
    delete base[AUDIT_EDIT_LOG_KEY];
    return base;
}

function normalize_json_value(value: unknown): unknown {
    const parsed = parse_json_if_string(value);
    return parsed === null || parsed === undefined ? null : parsed;
}

/**
 * Normaliserade fält som ska jämföras (metadata utan audit_edit_log).
 */
export function meaningful_audit_content_slice(row: AuditRowMeaningfulSource): {
    metadata: Record<string, unknown>;
    status: string | null;
    samples: unknown;
    rule_file_content: unknown;
    archived_requirement_results: unknown;
    last_rulefile_update_log: unknown;
} {
    return {
        metadata: normalize_metadata_for_compare(row.metadata),
        status: row.status === null || row.status === undefined ? null : String(row.status),
        samples: normalize_json_value(row.samples),
        rule_file_content: normalize_json_value(row.rule_file_content),
        archived_requirement_results: normalize_json_value(row.archived_requirement_results),
        last_rulefile_update_log: normalize_json_value(row.last_rulefile_update_log)
    };
}

/**
 * Slår ihop befintlig rad med fält som PATCH uttryckligen skickar.
 */
export function merge_audit_patch_into_row(
    current: AuditRowMeaningfulSource,
    patch: AuditPatchBodySlice
): AuditRowMeaningfulSource {
    return {
        metadata: patch.metadata !== undefined ? patch.metadata : current.metadata,
        status: patch.status !== undefined ? patch.status : current.status,
        samples: patch.samples !== undefined ? patch.samples : current.samples,
        rule_file_content:
            patch.ruleFileContent !== undefined ? patch.ruleFileContent : current.rule_file_content,
        archived_requirement_results:
            patch.archivedRequirementResults !== undefined
                ? patch.archivedRequirementResults
                : current.archived_requirement_results,
        last_rulefile_update_log:
            patch.lastRulefileUpdateLog !== undefined
                ? patch.lastRulefileUpdateLog
                : current.last_rulefile_update_log
    };
}

/**
 * True om något meningsfullt (exkl. enbart audit_edit_log) ändrats efter merge.
 */
export function has_meaningful_audit_patch_change(
    before_row: AuditRowMeaningfulSource,
    patch: AuditPatchBodySlice
): boolean {
    const after_row = merge_audit_patch_into_row(before_row, patch);
    const before_slice = meaningful_audit_content_slice(before_row);
    const after_slice = meaningful_audit_content_slice(after_row);
    return !isDeepStrictEqual(before_slice, after_slice);
}
