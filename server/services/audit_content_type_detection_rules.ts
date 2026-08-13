/**
 * @fileoverview Hämtar DOM-selectorregler från den regelfilssnapshot som hör till en granskning.
 */
import { query } from '../db.js';
import {
    collect_child_detection_selectors_from_groups,
    type ContentTypeDetectionSelectorRule,
} from '../../shared/rulefile/content_type_detection_selector.js';

type RuleFileLike = {
    metadata?: {
        contentTypes?: unknown;
    };
};

function parse_rule_file_content(value: unknown): RuleFileLike | null {
    if (!value) return null;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' ? parsed as RuleFileLike : null;
        } catch {
            return null;
        }
    }
    return typeof value === 'object' ? value as RuleFileLike : null;
}

export async function get_audit_content_type_detection_rules(
    audit_id: string
): Promise<ContentTypeDetectionSelectorRule[]> {
    const result = await query('SELECT rule_file_content FROM audits WHERE id = $1', [audit_id]);
    if (result.rows.length === 0) return [];
    const rule_file = parse_rule_file_content(result.rows[0]?.rule_file_content);
    const groups = rule_file?.metadata?.contentTypes;
    return collect_child_detection_selectors_from_groups(Array.isArray(groups) ? groups : []);
}
