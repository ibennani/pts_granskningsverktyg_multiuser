/**
 * @fileoverview Overlay av granskningstyper från publicerad regelfil när ögonblicksbild saknar auditTypes.
 */

import { resolve_audit_types } from '../rulefile/rulefile_audit_types.js';

function as_metadata_record(metadata: unknown): Record<string, unknown> {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return {};
    }
    return { ...(metadata as Record<string, unknown>) };
}

export function snapshot_lacks_audit_types(rule_file_content: unknown): boolean {
    const metadata = (rule_file_content as { metadata?: unknown } | null)?.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return true;
    }
    const audit_types = (metadata as { auditTypes?: unknown }).auditTypes;
    if (!Array.isArray(audit_types) || audit_types.length === 0) {
        return true;
    }
    return false;
}

/**
 * Fyller i metadata.auditTypes från publicerad regelfil endast om ögonblicksbilden saknar arrayen.
 */
export function merge_audit_types_into_rule_metadata(
    snapshot_metadata: unknown,
    published_metadata: unknown
): Record<string, unknown> {
    const merged = as_metadata_record(snapshot_metadata);
    if (Array.isArray(merged.auditTypes) && merged.auditTypes.length > 0) {
        return merged;
    }
    const published = as_metadata_record(published_metadata);
    if (Array.isArray(published.auditTypes)) {
        return { ...merged, auditTypes: published.auditTypes };
    }
    return merged;
}

export function parse_rule_content_value(raw: unknown): unknown | null {
    if (!raw) return null;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }
    if (typeof raw === 'object') {
        return raw;
    }
    return null;
}

export function read_published_rule_content_from_rule_set_row(rule_set_row: unknown): unknown | null {
    if (!rule_set_row || typeof rule_set_row !== 'object') {
        return null;
    }
    const row = rule_set_row as { published_content?: unknown; content?: unknown };
    return parse_rule_content_value(row.published_content ?? row.content);
}

/**
 * Shallow copy av regelfilsinnehåll med mergad metadata för typval och taxonomi.
 */
export function resolve_effective_rule_file_for_audit_types(
    rule_file_content: unknown,
    published_rule_content?: unknown | null
): unknown {
    if (!rule_file_content || typeof rule_file_content !== 'object') {
        return rule_file_content;
    }
    if (!published_rule_content || typeof published_rule_content !== 'object') {
        return rule_file_content;
    }
    if (!snapshot_lacks_audit_types(rule_file_content)) {
        return rule_file_content;
    }
    const snapshot = rule_file_content as Record<string, unknown>;
    const published = published_rule_content as Record<string, unknown>;
    return {
        ...snapshot,
        metadata: merge_audit_types_into_rule_metadata(snapshot.metadata, published.metadata),
    };
}

export function apply_audit_type_overlay_to_rule_content(
    rule_file_content: unknown,
    published_rule_content: unknown | null | undefined
): unknown {
    return resolve_effective_rule_file_for_audit_types(rule_file_content, published_rule_content);
}

export function resolve_available_audit_types_for_audit(
    rule_file_content: unknown,
    published_rule_content?: unknown | null
): ReturnType<typeof resolve_audit_types> {
    const effective = resolve_effective_rule_file_for_audit_types(
        rule_file_content,
        published_rule_content
    );
    return resolve_audit_types((effective as { metadata?: unknown } | null)?.metadata);
}
