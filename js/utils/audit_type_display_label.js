/**
 * @fileoverview Visningsetikett för granskningstyp (regelfil före sparad etikett).
 */
import { resolve_audit_type_display_label } from '../../shared/audit/audit_type_metadata.js';

/**
 * @param {{ granskningstyp_id?: string, granskningstyp_label?: string, metadata?: { auditTypeId?: string, auditTypeLabel?: string }, ruleFileContent?: unknown, rule_file_content?: unknown }} row
 * @param {unknown} [rule_file_content]
 * @returns {string}
 */
export function audit_row_granskningstyp_display_label(row, rule_file_content = undefined) {
    const metadata = {
        auditTypeId: String(row?.granskningstyp_id || row?.metadata?.auditTypeId || '').trim(),
        auditTypeLabel: String(row?.metadata?.auditTypeLabel || '').trim(),
    };
    const rule =
        rule_file_content !== undefined
            ? rule_file_content
            : row?.ruleFileContent ?? row?.rule_file_content ?? null;
    const resolved = resolve_audit_type_display_label(metadata, rule);
    if (resolved) return resolved;
    return String(row?.granskningstyp_label || '').trim();
}

/**
 * @param {{ auditTypeId?: string, auditTypeLabel?: string }} audit_metadata
 * @param {unknown} rule_file_content
 * @returns {string}
 */
export function audit_metadata_granskningstyp_display_label(audit_metadata, rule_file_content) {
    return resolve_audit_type_display_label(audit_metadata, rule_file_content);
}
