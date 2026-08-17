/**
 * @fileoverview Kontrollerar om det finns en nyare publicerad regelfil än granskningens ögonblicksbild.
 */

import { resolve_effective_rule_set_id_for_audit } from './audit_bound_rule_metadata.js';
import { resolve_canonical_published_rule_row } from './canonical_published_rule_resolve.js';
import type { PublishedRuleRow } from './published_monitoring_rule_options.js';

type VersionCompareFn = (a: string, b: string) => boolean;

/**
 * @returns {{ ruleId: string, version: string } | null}
 */
export function find_newer_rule_for_audit(
    ruleFileContent: unknown,
    rules: PublishedRuleRow[],
    version_greater_than: VersionCompareFn,
    ruleSetId?: string | null,
    audit_metadata?: Record<string, unknown> | null
): { ruleId: string; version: string } | null {
    if (!ruleFileContent || !Array.isArray(rules) || rules.length === 0) return null;

    const audit_version = String(
        (ruleFileContent as { metadata?: { version?: string } })?.metadata?.version ?? ''
    ).trim();
    if (audit_version === '') return null;

    const effective_rule_set_id = resolve_effective_rule_set_id_for_audit({
        ruleSetId,
        auditMetadata: audit_metadata,
    });

    const canonical = resolve_canonical_published_rule_row(rules, version_greater_than, {
        ruleSetId: effective_rule_set_id || null,
        ruleFileContent,
    });
    if (!canonical) return null;

    const server_version = String(canonical.metadata_version ?? '').trim();
    if (server_version && version_greater_than(server_version, audit_version)) {
        return { ruleId: String(canonical.id), version: server_version };
    }
    return null;
}
