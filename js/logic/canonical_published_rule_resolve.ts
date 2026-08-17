/**
 * @fileoverview Härleder vilken publicerad regelfil som är canonical för en granskning.
 */

import { resolve_monitoring_kind_from_rule_content } from '../../shared/audit/audit_type_rule_set_resolve.js';
import {
    build_published_monitoring_rule_options,
    find_monitoring_option_by_key,
    is_published_rule_row,
    resolve_monitoring_kind_from_rule_row,
    type PublishedRuleRow,
} from './published_monitoring_rule_options.js';

type VersionCompareFn = (a: string, b: string) => boolean;

function read_monitoring_text(rule_file_content: unknown): string {
    const meta = (rule_file_content as { metadata?: { monitoringType?: { text?: unknown } } } | null)?.metadata;
    return String(meta?.monitoringType?.text ?? '').trim();
}

function find_rule_row_by_id(rules: PublishedRuleRow[], rule_id: string): PublishedRuleRow | null {
    const id = String(rule_id ?? '').trim();
    if (!id) return null;
    return rules.find((row) => String(row.id) === id) ?? null;
}

/**
 * Returnerar den regelfilsrad som granskningen ska jämföras mot vid «finns nyare publicerad?».
 */
export function resolve_canonical_published_rule_row(
    rules: PublishedRuleRow[],
    version_greater_than: VersionCompareFn,
    options: {
        ruleSetId?: string | null;
        ruleFileContent?: unknown;
    } = {}
): PublishedRuleRow | null {
    const list = Array.isArray(rules) ? rules : [];
    if (list.length === 0) return null;

    const explicit_id = String(options.ruleSetId ?? '').trim();
    if (explicit_id) {
        const direct = find_rule_row_by_id(list, explicit_id);
        if (direct) return direct;
    }

    const monitoring_text = read_monitoring_text(options.ruleFileContent);
    const picker_options = build_published_monitoring_rule_options(
        list,
        version_greater_than,
        (key) => key
    );

    if (monitoring_text) {
        const by_text = find_monitoring_option_by_key(picker_options, monitoring_text);
        if (by_text) {
            return find_rule_row_by_id(list, by_text.rule_id);
        }
    }

    const kind = resolve_monitoring_kind_from_rule_content(options.ruleFileContent);
    if (kind !== 'unknown') {
        for (const option of picker_options) {
            const row = find_rule_row_by_id(list, option.rule_id);
            if (row && resolve_monitoring_kind_from_rule_row(row) === kind) {
                return row;
            }
        }
    }

    return null;
}

export function is_canonical_published_rule_row(row: PublishedRuleRow | null | undefined): boolean {
    if (!row) return false;
    return is_published_rule_row(row);
}
