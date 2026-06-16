/**
 * @file Bygger granskningsinnehåll (stickprov, bedömningar, observationer) för LLM-verktyg.
 */

import { resolve_requirement_title } from './llm_tool_rule_requirements.js';

const OBSERVATION_MAX_CHARS = 500;
const VALID_STATUS_FILTERS = new Set([
    'passed',
    'failed',
    'partially_audited',
    'not_audited',
    'not_applicable'
]);

type SampleShape = {
    id?: string;
    description?: string;
    url?: string;
    pageType?: string;
    requirementResults?: Record<string, Record<string, unknown>>;
};

type RequirementResultOut = {
    requirement_id: string;
    requirement_title: string;
    status: string;
    observation: string | null;
    comment_to_actor: string | null;
};

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

function truncate_text(value: unknown, max_chars: number): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length <= max_chars) return trimmed;
    return `${trimmed.slice(0, max_chars)}…`;
}

function extract_observation_text(result: Record<string, unknown>): string | null {
    return (
        truncate_text(result.observationDetail, OBSERVATION_MAX_CHARS) ||
        truncate_text(result.stuckProblemDescription, OBSERVATION_MAX_CHARS) ||
        null
    );
}

function map_requirement_result(
    requirement_id: string,
    result: Record<string, unknown>,
    rule_file_content: unknown
): RequirementResultOut {
    return {
        requirement_id,
        requirement_title: resolve_requirement_title(rule_file_content, requirement_id),
        status: typeof result.status === 'string' ? result.status : 'unknown',
        observation: extract_observation_text(result),
        comment_to_actor: truncate_text(result.commentToActor, OBSERVATION_MAX_CHARS)
    };
}

function matches_status_filter(status: string, status_filter: string | undefined): boolean {
    if (!status_filter) return true;
    return status === status_filter;
}

function build_sample_content(
    sample: SampleShape,
    rule_file_content: unknown,
    status_filter: string | undefined
): {
    id: string | null;
    description: string;
    url: string | null;
    page_type: string | null;
    requirement_results: RequirementResultOut[];
} {
    const results = sample.requirementResults || {};
    const requirement_results = Object.entries(results)
        .map(([requirement_id, raw]) =>
            map_requirement_result(requirement_id, (raw || {}) as Record<string, unknown>, rule_file_content)
        )
        .filter((row) => matches_status_filter(row.status, status_filter));
    return {
        id: sample.id || null,
        description: sample.description || '',
        url: typeof sample.url === 'string' && sample.url.trim() ? sample.url.trim() : null,
        page_type: typeof sample.pageType === 'string' && sample.pageType.trim() ? sample.pageType.trim() : null,
        requirement_results
    };
}

export function build_audit_content_payload(
    row: Record<string, unknown>,
    options: { sample_id?: string; status_filter?: string } = {}
): Record<string, unknown> {
    const samples = parse_json_value<SampleShape[]>(row.samples) || [];
    const rule_file_content = row.rule_file_content;
    const status_filter =
        typeof options.status_filter === 'string' && VALID_STATUS_FILTERS.has(options.status_filter)
            ? options.status_filter
            : undefined;
    const sample_id = typeof options.sample_id === 'string' ? options.sample_id.trim() : '';
    const filtered_samples = sample_id
        ? samples.filter((s) => String(s.id) === sample_id)
        : samples;
    if (sample_id && filtered_samples.length === 0) {
        throw new Error('Stickprovet hittades inte i granskningen.');
    }
    const metadata = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<
        string,
        unknown
    >;
    const meta_title = typeof metadata.title === 'string' ? metadata.title.trim() : '';
    return {
        entity_type: 'audit',
        audit_id: row.id,
        title: meta_title || row.rule_set_name || 'Namnlös granskning',
        rule_set_id: row.rule_set_id || null,
        rule_set_name: row.rule_set_name || null,
        status: row.status || null,
        sample_count: samples.length,
        samples: filtered_samples.map((sample) => build_sample_content(sample, rule_file_content, status_filter))
    };
}
