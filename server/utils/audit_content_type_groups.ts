/**
 * @fileoverview Läser innehållstypgrupper från granskningens regelfil för snapshot-analys.
 */
import { query } from '../db.js';
import { resolve_content_types } from '../../shared/rulefile/rulefile_metadata_vocabularies.js';
import {
    apply_detection_patterns_to_content_types,
    resolve_rulefile_monitoring_kind,
} from '../../shared/rulefile/content_type_detection_pattern_rulefile_apply.js';

function parse_rule_file_content(raw: unknown): Record<string, unknown> | null {
    if (!raw) return null;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw) as unknown;
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? (parsed as Record<string, unknown>)
                : null;
        } catch {
            return null;
        }
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as Record<string, unknown>;
    }
    return null;
}

export async function load_content_type_groups_for_audit(audit_id: string): Promise<unknown[]> {
    const result = await query('SELECT rule_file_content FROM audits WHERE id = $1', [audit_id]);
    if (!result.rows.length) return [];
    const rule = parse_rule_file_content(result.rows[0].rule_file_content);
    if (!rule) return [];
    const metadata = rule.metadata;
    const groups = resolve_content_types(metadata) as Parameters<
        typeof apply_detection_patterns_to_content_types
    >[0];
    if (!groups) {
        return [];
    }
    if (resolve_rulefile_monitoring_kind(metadata) === 'pdf') {
        return groups;
    }
    return apply_detection_patterns_to_content_types(groups, 'web');
}
