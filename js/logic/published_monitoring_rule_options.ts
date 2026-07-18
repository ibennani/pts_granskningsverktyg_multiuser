/**
 * @fileoverview Bygger alternativ för dropdown "Vad ska granskas?" från publicerade regelfiler.
 */

export type PublishedRuleRow = {
    id: string;
    name?: string;
    monitoring_type_text?: string;
    metadata_version?: string;
    list_as_arbetskopia?: boolean;
    is_published?: boolean;
};

export type MonitoringTypeOption = {
    key: string;
    rule_id: string;
    label: string;
};

type VersionCompareFn = (a: string, b: string) => boolean;

export function is_published_rule_row(row: PublishedRuleRow): boolean {
    const is_arbetskopia =
        row.list_as_arbetskopia === true
        || (row.list_as_arbetskopia !== false && !row.is_published);
    return !is_arbetskopia;
}

export function resolve_monitoring_kind_from_rule_row(
    row: PublishedRuleRow
): 'web' | 'pdf' | 'unknown' {
    const text = (row.monitoring_type_text || row.name || '').trim().toLowerCase();
    if (!text) return 'unknown';
    if (text.includes('pdf')) return 'pdf';
    if (text === 'web' || text.includes('webb') || text.includes('web')) return 'web';
    return 'unknown';
}

export function monitoring_option_label_for_rule_row(
    row: PublishedRuleRow,
    t: (key: string) => string
): string {
    const kind = resolve_monitoring_kind_from_rule_row(row);
    if (kind === 'web') return t('audit_type_filter_webb');
    if (kind === 'pdf') return t('audit_type_filter_pdf');
    return (row.monitoring_type_text || row.name || `Regelfil ${row.id}`).trim();
}

function monitoring_type_dedupe_key(row: PublishedRuleRow): string {
    return (row.monitoring_type_text || row.name || `Regelfil ${row.id}`).trim();
}

export function build_published_monitoring_rule_options(
    rules: PublishedRuleRow[],
    version_greater_than: VersionCompareFn,
    t: (key: string) => string
): MonitoringTypeOption[] {
    const published = (Array.isArray(rules) ? rules : []).filter(is_published_rule_row);
    const type_to_rule = new Map<string, PublishedRuleRow>();

    for (const row of published) {
        const type_key = monitoring_type_dedupe_key(row);
        const existing = type_to_rule.get(type_key);
        if (!existing || version_greater_than(row.metadata_version || '', existing.metadata_version || '')) {
            type_to_rule.set(type_key, row);
        }
    }

    return [...type_to_rule.entries()]
        .map(([key, row]) => ({
            key,
            rule_id: row.id,
            label: monitoring_option_label_for_rule_row(row, t),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'sv'));
}

export function find_monitoring_option_by_key(
    options: MonitoringTypeOption[],
    key: string | null | undefined
): MonitoringTypeOption | null {
    const monitoring_key = String(key ?? '').trim();
    if (!monitoring_key) return null;
    return options.find((option) => option.key === monitoring_key) ?? null;
}

export function find_monitoring_option_by_rule_id(
    options: MonitoringTypeOption[],
    rule_id: string | null | undefined
): MonitoringTypeOption | null {
    const id = String(rule_id ?? '').trim();
    if (!id) return null;
    return options.find((option) => option.rule_id === id) ?? null;
}

export function resolve_selected_monitoring_key(
    options: MonitoringTypeOption[],
    rule_set_id: string | null | undefined
): string {
    const match = find_monitoring_option_by_rule_id(options, rule_set_id);
    if (match) return match.key;
    return options[0]?.key ?? '';
}
