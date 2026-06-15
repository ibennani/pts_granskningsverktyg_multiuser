/**
 * @file Sammanfattningar av granskningar och regelfiler för LLM-verktyg.
 */

function parse_json_value<T>(value: unknown): T | null {
    if (value == null) return null;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }
    return value as T;
}

type SampleRow = {
    id?: string;
    description?: string;
    requirementResults?: Record<string, Record<string, unknown>>;
};

export function summarize_requirement_results(results: Record<string, Record<string, unknown>> | undefined) {
    const counts: Record<string, number> = {};
    if (!results || typeof results !== 'object') {
        return { total: 0, by_status: counts };
    }
    for (const entry of Object.values(results)) {
        const status = typeof entry?.status === 'string' ? entry.status : 'unknown';
        counts[status] = (counts[status] || 0) + 1;
    }
    return { total: Object.keys(results).length, by_status: counts };
}

export function summarize_samples(samples_raw: unknown) {
    const samples = parse_json_value<SampleRow[]>(samples_raw) || [];
    return samples.map((sample) => ({
        id: sample.id || null,
        description: sample.description || '',
        requirement_summary: summarize_requirement_results(sample.requirementResults)
    }));
}

export function count_requirements_in_rule_content(rule_content_raw: unknown): number | null {
    const rule_content = parse_json_value<Record<string, unknown>>(rule_content_raw);
    if (!rule_content) return null;
    const requirements = rule_content.requirements;
    if (Array.isArray(requirements)) return requirements.length;
    if (requirements && typeof requirements === 'object') {
        return Object.keys(requirements).length;
    }
    return null;
}

export function trim_tool_json(payload: unknown, max_chars = 12_000): string {
    const text = JSON.stringify(payload);
    if (text.length <= max_chars) return text;
    return `${text.slice(0, max_chars)}…`;
}
