/**
 * @fileoverview Platshållare för granskningsdelar i Bilaga 1 (export).
 */
import { resolve_recurring_sample_category_id } from './recurring_sample_resolver.js';

type SampleLike = Record<string, unknown>;

export type Appendix1SamplePlaceholderValues = {
    auditSampleCount: string;
    auditSampleList: string;
    recurringSampleList: string;
};

function read_sample_label(sample: SampleLike): string {
    const description = String(sample.description ?? '').trim();
    if (description) return description;
    return String(sample.url ?? '').trim();
}

export function format_swedish_prose_list(items: string[]): string {
    const unique = [...new Set(items.map((item) => item.trim()).filter(Boolean))];
    if (unique.length === 0) return '';
    if (unique.length === 1) return unique[0];
    if (unique.length === 2) return `${unique[0]} och ${unique[1]}`;
    return `${unique.slice(0, -1).join(', ')} och ${unique[unique.length - 1]}`;
}

function normalize_samples(raw: unknown): SampleLike[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((entry) => entry && typeof entry === 'object') as SampleLike[];
}

function partition_audit_samples(
    samples: SampleLike[],
    recurring_category_id: string | null
): { regular: string[]; recurring: string[] } {
    const regular: string[] = [];
    const recurring: string[] = [];
    for (const sample of samples) {
        const label = read_sample_label(sample);
        if (!label) continue;
        const category_id = String(sample.sampleCategory ?? '').trim();
        if (recurring_category_id && category_id === recurring_category_id) {
            recurring.push(label);
        } else {
            regular.push(label);
        }
    }
    return { regular, recurring };
}

export function build_appendix1_sample_placeholder_values(
    audit: Record<string, unknown> | null | undefined
): Appendix1SamplePlaceholderValues {
    const samples = normalize_samples(audit?.samples);
    const recurring_category_id = resolve_recurring_sample_category_id(
        (audit?.ruleFileContent as { metadata?: unknown } | null | undefined)?.metadata
    );
    const { regular, recurring } = partition_audit_samples(samples, recurring_category_id);
    const total_count = regular.length + recurring.length;

    return {
        auditSampleCount: String(total_count),
        auditSampleList: format_swedish_prose_list(regular) || 'inga registrerade granskningsdelar',
        recurringSampleList: format_swedish_prose_list(recurring) || 'inga',
    };
}
