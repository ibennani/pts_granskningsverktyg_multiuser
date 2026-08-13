/**
 * @fileoverview Kategori, sidtyp och dubblettkontroll för återkommande granskningsdelar.
 */
import {
    find_sample_category_by_hints,
    generate_page_type_slug,
    read_page_types_dropdown_state,
    type SampleCategoryRecord,
} from '../../shared/rulefile/page_types_dropdown_sync.js';
import { get_default_content_type_ids } from '../../shared/rulefile/content_type_defaults.js';

const ATERKOMMANDE_MATCH_HINTS = ['återkommande', 'aterkommande'];

const CANDIDATE_TYPE_HINTS: Record<string, string[]> = {
    header: ['sidhuvud', 'header'],
    menu: ['meny', 'huvudmeny', 'navigation'],
    footer: ['sidfot', 'footer', 'bunntekst'],
    cookie: ['cookie', 'informationskapsel', 'samtycke'],
    section_navigation: ['lokal navigering', 'sektionsnavigering', 'sidnavigering'],
    other_recurring: ['övrigt', 'ovrigt', 'annat'],
};

export type RecurringSuggestionLike = {
    candidateType: string;
    structureFingerprint: string;
    evidenceRefs?: { sampleIds?: string[]; captureIds?: string[] };
};

export type RecurringSamplePayload = {
    description: string;
    sampleCategory: string;
    sampleType: string;
    selectedContentTypes: string[];
    recurringComponentType: string;
    recurringStructureFingerprint: string;
    recurringEvidenceRefs: RecurringSuggestionLike['evidenceRefs'];
};

function normalize_match_text(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
}

export function resolve_recurring_sample_category(
    metadata: unknown
): SampleCategoryRecord | null {
    const state = read_page_types_dropdown_state(metadata);
    if (state.aterkommande_category) return state.aterkommande_category;
    const vocab = metadata as { samples?: { sampleCategories?: SampleCategoryRecord[] } } | null;
    const categories = vocab?.samples?.sampleCategories;
    if (!Array.isArray(categories)) return null;
    return find_sample_category_by_hints(categories, ATERKOMMANDE_MATCH_HINTS);
}

export function resolve_recurring_sample_category_id(metadata: unknown): string | null {
    const category = resolve_recurring_sample_category(metadata);
    const id = String(category?.id ?? '').trim();
    return id || null;
}

function find_dropdown_entry_for_candidate(
    category: SampleCategoryRecord | null,
    candidate_type: string
): { id: string; text: string } | null {
    const entries = Array.isArray(category?.categories) ? category.categories : [];
    const hints = CANDIDATE_TYPE_HINTS[candidate_type] || CANDIDATE_TYPE_HINTS.other_recurring;

    for (const entry of entries) {
        const text = normalize_match_text(entry?.text);
        const id = normalize_match_text(entry?.id);
        if (hints.some((hint) => text.includes(hint) || id.includes(hint))) {
            return {
                id: String(entry?.id ?? '').trim() || generate_page_type_slug(String(entry?.text ?? '')),
                text: String(entry?.text ?? '').trim(),
            };
        }
    }
    return null;
}

export function resolve_recurring_sample_type(
    metadata: unknown,
    candidate_type: string,
    fallback_label: string
): { sample_type_id: string; description: string } {
    const category = resolve_recurring_sample_category(metadata);
    const match = find_dropdown_entry_for_candidate(category, candidate_type);
    if (match) {
        return { sample_type_id: match.id, description: match.text };
    }
    const slug = generate_page_type_slug(fallback_label) || candidate_type;
    return { sample_type_id: slug, description: fallback_label };
}

export function recurring_sample_exists(
    samples: Array<Record<string, unknown>> | undefined,
    category_id: string,
    suggestion: RecurringSuggestionLike
): boolean {
    if (!Array.isArray(samples)) return false;
    const fingerprint = String(suggestion.structureFingerprint || '').trim();
    const candidate = String(suggestion.candidateType || '').trim();

    return samples.some((sample) => {
        if (String(sample.sampleCategory ?? '') !== category_id) return false;
        const stored_fp = String(sample.recurringStructureFingerprint ?? '').trim();
        if (fingerprint && stored_fp && stored_fp === fingerprint) return true;
        if (candidate && String(sample.recurringComponentType ?? '') === candidate) {
            const sample_type = String(sample.sampleType ?? '').trim();
            if (sample_type) return true;
        }
        return false;
    });
}

export function build_recurring_sample_payload(
    metadata: unknown,
    suggestion: RecurringSuggestionLike,
    fallback_label: string
): RecurringSamplePayload | null {
    const category_id = resolve_recurring_sample_category_id(metadata);
    if (!category_id) return null;

    const { sample_type_id, description } = resolve_recurring_sample_type(
        metadata,
        suggestion.candidateType,
        fallback_label
    );

    return {
        description,
        sampleCategory: category_id,
        sampleType: sample_type_id,
        selectedContentTypes: get_default_content_type_ids(metadata),
        recurringComponentType: suggestion.candidateType,
        recurringStructureFingerprint: suggestion.structureFingerprint,
        recurringEvidenceRefs: suggestion.evidenceRefs ?? { sampleIds: [], captureIds: [] },
    };
}
