/**
 * Bygger samma datastruktur som statistik-API:t `monitoring_sampletype_chart`
 * för aktuell granskning (median bristindex per stickprovstyp).
 */
import { calculateQualityScore } from './ScoreCalculator.js';

/** Samma sentinel som server/audit_aggregated_statistics.js */
export const MONITORING_LABEL_FALLBACK_SENTINEL = '__GV_STATS_MONITORING_FALLBACK__';

export type SampleTypeChartRow = {
    sample_type_id: string;
    sample_type_label: string;
    median_deficiency: number;
};

export type MonitoringSampleTypeChartSection = {
    monitoring_type_label: string;
    sample_types: SampleTypeChartRow[];
};

function median_sorted(values: number[]): number | null {
    if (!values.length) return null;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    if (s.length % 2 === 1) return s[mid];
    return (s[mid - 1] + s[mid]) / 2;
}

function sample_type_key(sample: { sampleType?: unknown } | null | undefined): string {
    const raw = sample?.sampleType;
    if (typeof raw !== 'string') return '';
    return raw.trim();
}

function resolve_sample_type_label(rule_content: Record<string, unknown> | null, sample_type_id: string): string {
    const id = String(sample_type_id || '').trim();
    if (!id) return '';
    const meta = rule_content?.metadata as Record<string, unknown> | undefined;
    const cats =
        (meta?.vocabularies as { sampleTypes?: { sampleCategories?: unknown[] } } | undefined)?.sampleTypes
            ?.sampleCategories ||
        (meta?.samples as { sampleCategories?: unknown[] } | undefined)?.sampleCategories ||
        [];
    if (Array.isArray(cats)) {
        for (const cat of cats) {
            const subs = Array.isArray((cat as { categories?: unknown[] })?.categories)
                ? (cat as { categories: unknown[] }).categories
                : [];
            for (const sub of subs) {
                const sub_obj = sub as { id?: unknown; text?: unknown };
                if (String(sub_obj?.id || '').trim() === id) {
                    const text = typeof sub_obj?.text === 'string' ? sub_obj.text.trim() : '';
                    if (text) return text;
                }
            }
        }
    }
    return id;
}

/**
 * Visningsetikett för övervakningstyp (samma logik som get_monitoring_type_label på servern).
 */
export function get_monitoring_type_label_for_audit(rule_content: Record<string, unknown> | null): string {
    if (!rule_content || typeof rule_content !== 'object') return MONITORING_LABEL_FALLBACK_SENTINEL;
    const meta = rule_content.metadata as { monitoringType?: unknown } | undefined;
    const m = meta?.monitoringType;
    if (!m || typeof m !== 'object') return MONITORING_LABEL_FALLBACK_SENTINEL;
    const mo = m as { text?: unknown; type?: unknown };
    const text = typeof mo.text === 'string' ? mo.text.trim() : '';
    const typ = typeof mo.type === 'string' ? mo.type.trim() : '';
    if (text) return text;
    if (typ) return typ;
    return MONITORING_LABEL_FALLBACK_SENTINEL;
}

/**
 * @returns Samma form som `monitoring_sampletype_chart` från statistik-API:t; tom array om inget kan visas.
 */
export function build_sampletype_chart_sections_from_audit_state(state: Record<string, unknown> | null): MonitoringSampleTypeChartSection[] {
    const rule = state?.ruleFileContent as Record<string, unknown> | null | undefined;
    if (!rule?.requirements || typeof rule.requirements !== 'object') return [];

    const samples = state?.samples;
    if (!Array.isArray(samples) || samples.length === 0) return [];

    /** sampleType-id → bristindex per stickprov */
    const by_type = new Map<string, number[]>();

    for (const sample of samples) {
        const st = sample_type_key(sample as { sampleType?: unknown });
        if (!st) continue;
        const one = calculateQualityScore({ ruleFileContent: rule, samples: [sample] }) as
            | { totalScore?: number }
            | null
            | undefined;
        const v =
            one && typeof one.totalScore === 'number' && !Number.isNaN(one.totalScore) ? one.totalScore : null;
        if (v === null) continue;
        if (!by_type.has(st)) by_type.set(st, []);
        by_type.get(st)!.push(v);
    }

    const rows: SampleTypeChartRow[] = [];
    for (const [type_id, values] of by_type.entries()) {
        const med = median_sorted(values);
        if (med === null) continue;
        rows.push({
            sample_type_id: type_id,
            sample_type_label: resolve_sample_type_label(rule, type_id),
            median_deficiency: Math.round(med * 10) / 10
        });
    }

    rows.sort((a, b) => {
        if (b.median_deficiency !== a.median_deficiency) return b.median_deficiency - a.median_deficiency;
        return String(a.sample_type_label || '').localeCompare(String(b.sample_type_label || ''), 'sv');
    });

    if (rows.length === 0) return [];

    const monitoring_label = get_monitoring_type_label_for_audit(rule);
    return [{ monitoring_type_label: monitoring_label, sample_types: rows }];
}
