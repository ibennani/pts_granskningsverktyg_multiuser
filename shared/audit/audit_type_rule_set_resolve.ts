/**
 * @fileoverview Härleder regelfilskoppling för granskningstyp-overlay när rule_set_id saknas.
 */

export type MonitoringKind = 'web' | 'pdf' | 'unknown';

export type PublishedRuleRowLike = {
    id: string;
    name?: string;
    monitoring_type_text?: string;
    list_as_arbetskopia?: boolean;
    is_published?: boolean;
    published_content?: unknown;
    content?: unknown;
};

export function resolve_monitoring_kind_from_rule_content(rule_file_content: unknown): MonitoringKind {
    const meta = (rule_file_content as { metadata?: Record<string, unknown> } | null)?.metadata;
    if (!meta || typeof meta !== 'object') {
        return 'unknown';
    }
    const monitoring_type = meta.monitoringType as { type?: unknown; text?: unknown; label?: unknown } | undefined;
    const type_raw = typeof monitoring_type?.type === 'string' ? monitoring_type.type.trim().toLowerCase() : '';
    if (type_raw === 'web' || type_raw === 'pdf') {
        return type_raw;
    }
    const text = String(
        monitoring_type?.text ?? monitoring_type?.label ?? meta.title ?? ''
    )
        .trim()
        .toLowerCase();
    if (!text) return 'unknown';
    if (text.includes('pdf')) return 'pdf';
    if (text.includes('webb') || text.includes('web') || text.includes('webbplats')) return 'web';
    return 'unknown';
}

export function resolve_monitoring_kind_from_rule_row(row: PublishedRuleRowLike): MonitoringKind {
    const text = (row.monitoring_type_text || row.name || '').trim().toLowerCase();
    if (!text) return 'unknown';
    if (text.includes('pdf')) return 'pdf';
    if (text === 'web' || text.includes('webb') || text.includes('web')) return 'web';
    return 'unknown';
}

export function read_rule_set_id_candidates(
    audit_rule_set_id: unknown,
    rule_file_content: unknown
): string[] {
    const ids: string[] = [];
    const push_id = (raw: unknown) => {
        const id = String(raw ?? '').trim();
        if (!id || ids.includes(id)) return;
        ids.push(id);
    };
    push_id(audit_rule_set_id);
    const meta = (rule_file_content as { metadata?: { ruleSetId?: unknown } } | null)?.metadata;
    push_id(meta?.ruleSetId);
    return ids;
}

export function is_published_rule_set_row(row: PublishedRuleRowLike): boolean {
    if (row.published_content == null && row.content == null) {
        return false;
    }
    const is_arbetskopia =
        row.list_as_arbetskopia === true
        || (row.list_as_arbetskopia !== false && row.is_published === false);
    return !is_arbetskopia;
}

export function pick_published_rule_row_by_monitoring_kind(
    rule_rows: PublishedRuleRowLike[],
    kind: MonitoringKind
): PublishedRuleRowLike | null {
    if (kind === 'unknown' || !Array.isArray(rule_rows)) {
        return null;
    }
    const matches = rule_rows.filter((row) => {
        if (!is_published_rule_set_row(row)) return false;
        return resolve_monitoring_kind_from_rule_row(row) === kind;
    });
    if (matches.length === 0) return null;
    return matches[0];
}

export function build_default_published_audit_types_content(): { metadata: { auditTypes: unknown[] } } {
    return {
        metadata: {
            auditTypes: [
                { id: 'tillsyn-lptt', label: 'Tillsyn, LPTT', taxonomyId: 'wcag22-pour' },
                {
                    id: 'marknadskontroll-lptt',
                    label: 'Marknadskontroll LPTT',
                    taxonomyId: 'fptt-bilaga-2',
                },
            ],
        },
    };
}
