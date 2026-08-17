/**
 * @fileoverview Metadatafält för vilken publicerad regelfil en granskning är bunden till.
 */

export const AUDIT_METADATA_BOUND_RULE_SET_ID_KEY = 'boundRuleSetId';
export const AUDIT_METADATA_BOUND_RULE_VERSION_KEY = 'boundRuleVersion';

type MetadataLike = Record<string, unknown> | null | undefined;

export function read_bound_rule_set_id_from_metadata(metadata: MetadataLike): string {
    const raw = metadata?.[AUDIT_METADATA_BOUND_RULE_SET_ID_KEY];
    return raw !== null && raw !== undefined ? String(raw).trim() : '';
}

export function read_bound_rule_version_from_metadata(metadata: MetadataLike): string {
    const raw = metadata?.[AUDIT_METADATA_BOUND_RULE_VERSION_KEY];
    return raw !== null && raw !== undefined ? String(raw).trim() : '';
}

export function resolve_effective_rule_set_id_for_audit(state: {
    ruleSetId?: string | null;
    auditMetadata?: MetadataLike;
} | null | undefined): string {
    const from_state = String(state?.ruleSetId ?? '').trim();
    if (from_state) return from_state;
    return read_bound_rule_set_id_from_metadata(state?.auditMetadata);
}

export function with_bound_rule_metadata(
    metadata: Record<string, unknown>,
    rule_set_id: string,
    version: string
): Record<string, unknown> {
    return {
        ...metadata,
        [AUDIT_METADATA_BOUND_RULE_SET_ID_KEY]: rule_set_id,
        [AUDIT_METADATA_BOUND_RULE_VERSION_KEY]: version,
    };
}
