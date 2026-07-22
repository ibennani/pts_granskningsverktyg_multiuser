/**
 * @fileoverview Granskningstyp (Tillsyn/Marknadskontroll) på granskning och koppling till taxonomi.
 */

import {
    resolve_audit_types,
    type RulefileAuditType,
} from '../rulefile/rulefile_audit_types.js';
import { DEFAULT_WCAG_TAXONOMY_ID } from '../classification/taxonomy_grouping.js';
import { resolve_effective_rule_file_for_audit_types } from './audit_type_catalog.js';

export {
    apply_audit_type_overlay_to_rule_content,
    merge_audit_types_into_rule_metadata,
    resolve_available_audit_types_for_audit,
    resolve_effective_rule_file_for_audit_types,
    snapshot_lacks_audit_types,
} from './audit_type_catalog.js';

function rule_file_for_audit_types(
    rule_file_content: unknown,
    published_rule_content?: unknown | null
): unknown {
    if (published_rule_content === undefined) {
        return rule_file_content;
    }
    return resolve_effective_rule_file_for_audit_types(rule_file_content, published_rule_content);
}

export type AuditMetadataAuditTypeFields = {
    auditTypeId?: string;
    auditTypeLabel?: string;
};

export type Appendix1ByAuditTypeEntry = {
    bodyText?: string;
    bodyTextByTaxonomy?: Record<string, string>;
};

export function has_audit_type_id(
    audit_metadata: AuditMetadataAuditTypeFields | null | undefined
): boolean {
    return Boolean(String(audit_metadata?.auditTypeId ?? '').trim());
}

/**
 * Granskningstyp får väljas tills auditTypeId sparats.
 * Tomt auditTypeId ger dropdown även under pågående granskning (äldre granskningar).
 * Arkiverade granskningar tillåter inte val.
 */
export function audit_type_field_editable(
    audit_metadata: AuditMetadataAuditTypeFields | null | undefined,
    audit_status: string | null | undefined = undefined
): boolean {
    if (audit_status === 'archived') {
        return false;
    }
    return !has_audit_type_id(audit_metadata);
}

/** @deprecated Använd audit_type_field_editable – lås styrs av auditTypeId, inte status. */
export function audit_type_editable_for_status(audit_status: string | null | undefined): boolean {
    return audit_status === 'not_started';
}

export function resolve_available_audit_types(
    rule_file_content: unknown,
    published_rule_content?: unknown | null
): RulefileAuditType[] {
    return resolve_audit_types(
        (rule_file_for_audit_types(rule_file_content, published_rule_content) as { metadata?: unknown } | null)
            ?.metadata
    );
}

export function resolve_audit_type_entry(
    rule_file_content: unknown,
    audit_metadata: AuditMetadataAuditTypeFields | null | undefined,
    published_rule_content?: unknown | null
): RulefileAuditType | null {
    const types = resolve_available_audit_types(rule_file_content, published_rule_content);
    const id = String(audit_metadata?.auditTypeId ?? '').trim();
    if (!id) return null;
    return types.find((row) => row.id === id) ?? null;
}

export function resolve_grouping_taxonomy_id(
    rule_file_content: unknown,
    audit_metadata: AuditMetadataAuditTypeFields | null | undefined,
    published_rule_content?: unknown | null
): string {
    const entry = resolve_audit_type_entry(
        rule_file_content,
        audit_metadata,
        published_rule_content
    );
    if (entry?.taxonomyId?.trim()) {
        return entry.taxonomyId.trim();
    }
    const appendix1 = (rule_file_content as { appendix1?: { groupingTaxonomyId?: unknown } } | null)
        ?.appendix1;
    const raw = appendix1?.groupingTaxonomyId;
    if (typeof raw === 'string' && raw.trim()) {
        return raw.trim();
    }
    return DEFAULT_WCAG_TAXONOMY_ID;
}

export function apply_audit_type_selection(
    audit_metadata: Record<string, unknown>,
    rule_file_content: unknown,
    audit_type_id: string,
    published_rule_content?: unknown | null
): boolean {
    const types = resolve_available_audit_types(rule_file_content, published_rule_content);
    const match = types.find((row) => row.id === String(audit_type_id ?? '').trim());
    if (!match) return false;
    audit_metadata.auditTypeId = match.id;
    audit_metadata.auditTypeLabel = match.label;
    return true;
}

export function apply_single_audit_type_if_unique(
    audit_metadata: Record<string, unknown>,
    rule_file_content: unknown,
    published_rule_content?: unknown | null
): boolean {
    if (has_audit_type_id(audit_metadata)) return false;
    const types = resolve_available_audit_types(rule_file_content, published_rule_content);
    if (types.length !== 1) return false;
    audit_metadata.auditTypeId = types[0].id;
    audit_metadata.auditTypeLabel = types[0].label;
    return true;
}

export function read_audit_type_label(
    audit_metadata: AuditMetadataAuditTypeFields | null | undefined
): string {
    return String(audit_metadata?.auditTypeLabel ?? '').trim();
}

export function read_audit_type_id(
    audit_metadata: AuditMetadataAuditTypeFields | null | undefined
): string {
    return String(audit_metadata?.auditTypeId ?? '').trim();
}

/**
 * Visningsetikett för granskningstyp: regelfil (via auditTypeId) före sparad auditTypeLabel.
 */
export function resolve_audit_type_display_label(
    audit_metadata: AuditMetadataAuditTypeFields | null | undefined,
    rule_file_content?: unknown | null,
    published_rule_content?: unknown | null
): string {
    const id = read_audit_type_id(audit_metadata);
    if (id && rule_file_content) {
        const entry = resolve_audit_type_entry(
            rule_file_content,
            audit_metadata,
            published_rule_content
        );
        const from_rule = typeof entry?.label === 'string' ? entry.label.trim() : '';
        if (from_rule) return from_rule;
    }
    const stored = read_audit_type_label(audit_metadata);
    if (stored) return stored;
    if (id) return id;
    return '';
}

export function read_appendix1_by_audit_type(
    appendix1: unknown,
    audit_type_id: string | null | undefined
): Appendix1ByAuditTypeEntry | null {
    if (!appendix1 || typeof appendix1 !== 'object') return null;
    const id = String(audit_type_id ?? '').trim();
    if (!id) return null;
    const by_type = (appendix1 as Record<string, unknown>).byAuditType;
    if (!by_type || typeof by_type !== 'object') return null;
    const entry = (by_type as Record<string, unknown>)[id];
    if (!entry || typeof entry !== 'object') return null;
    return entry as Appendix1ByAuditTypeEntry;
}

export function merge_appendix1_with_audit_type_override(
    appendix1: unknown,
    audit_type_id: string | null | undefined
): Record<string, unknown> | null {
    if (!appendix1 || typeof appendix1 !== 'object') return null;
    const base = { ...(appendix1 as Record<string, unknown>) };
    const override = read_appendix1_by_audit_type(appendix1, audit_type_id);
    if (!override) return base;
    if (override.bodyText !== undefined) {
        base.bodyText = override.bodyText;
    }
    if (override.bodyTextByTaxonomy) {
        const existing =
            base.bodyTextByTaxonomy && typeof base.bodyTextByTaxonomy === 'object'
                ? (base.bodyTextByTaxonomy as Record<string, string>)
                : {};
        base.bodyTextByTaxonomy = { ...existing, ...override.bodyTextByTaxonomy };
    }
    return base;
}
