/**
 * @file Synk av sidtypslistor (dropdown) per sampleCategory utan att ändra kategorinamn.
 */

import { resolve_sample_vocab } from './rulefile_metadata_vocabularies.js';

export type SampleCategoryRecord = {
    id?: string;
    text?: string;
    hasUrl?: boolean;
    categories?: Array<{ id?: string; text?: string }>;
};

export type PageTypesDropdownReadState = {
    webbsida_category: SampleCategoryRecord | null;
    aterkommande_category: SampleCategoryRecord | null;
    webbsida_lines: string[];
    aterkommande_lines: string[];
};

export type ApplyDropdownListsInput = {
    webbsida_lines: string[];
    aterkommande_lines: string[] | null;
};

export type ApplyDropdownListsResult =
    | { ok: true }
    | { ok: false; error_key: string; error_context?: Record<string, string> };

const WEBBSIDA_MATCH_HINTS = ['webbsida'];
const ATERKOMMANDE_MATCH_HINTS = ['återkommande', 'aterkommande'];

function normalize_match_text(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
}

export function generate_page_type_slug(value: string): string {
    if (!value) return '';
    return value
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function parse_lines_textarea(raw: string, options: { trim: boolean }): string[] {
    const lines = raw.split('\n');
    if (!options.trim) {
        return lines.filter((line) => line.length > 0);
    }
    return lines.map((line) => line.trim()).filter((line) => line.length > 0);
}

function category_matches_hints(category: SampleCategoryRecord, hints: string[]): boolean {
    const text = normalize_match_text(category.text);
    const id = normalize_match_text(category.id);
    return hints.some((hint) => {
        const normalized_hint = normalize_match_text(hint);
        return text.includes(normalized_hint) || id.includes(normalized_hint);
    });
}

function as_sample_categories(metadata: unknown): SampleCategoryRecord[] {
    const vocab = resolve_sample_vocab(metadata);
    if (!Array.isArray(vocab.sampleCategories)) return [];
    return vocab.sampleCategories as SampleCategoryRecord[];
}

export function find_sample_category_by_hints(
    sample_categories: SampleCategoryRecord[],
    hints: string[]
): SampleCategoryRecord | null {
    const match = sample_categories.find((cat) => category_matches_hints(cat, hints));
    return match ?? null;
}

export function get_dropdown_lines_from_category(category: SampleCategoryRecord | null): string[] {
    if (!category || !Array.isArray(category.categories)) return [];
    return category.categories
        .map((entry) => String(entry?.text || entry?.id || '').trim())
        .filter(Boolean);
}

export function read_page_types_dropdown_state(metadata: unknown): PageTypesDropdownReadState {
    const sample_categories = as_sample_categories(metadata);
    const webbsida_category = find_sample_category_by_hints(sample_categories, WEBBSIDA_MATCH_HINTS);
    const aterkommande_category = find_sample_category_by_hints(sample_categories, ATERKOMMANDE_MATCH_HINTS);

    return {
        webbsida_category,
        aterkommande_category,
        webbsida_lines: get_dropdown_lines_from_category(webbsida_category),
        aterkommande_lines: get_dropdown_lines_from_category(aterkommande_category),
    };
}

export function find_duplicate_line(lines: string[]): string | null {
    const seen = new Set<string>();
    for (const line of lines) {
        const key = normalize_match_text(line);
        if (!key) continue;
        if (seen.has(key)) return line;
        seen.add(key);
    }
    return null;
}

export function build_categories_from_lines(
    lines: string[],
    existing_categories: Array<{ id?: string; text?: string }> = []
): Array<{ id: string; text: string }> {
    return lines.map((text, index) => {
        const existing = existing_categories[index];
        const slug = generate_page_type_slug(text);
        const id = (existing?.id && String(existing.id).trim()) || slug || `typ-${index + 1}`;
        return { id, text };
    });
}

function update_category_dropdown_lines(
    category: SampleCategoryRecord,
    lines: string[]
): SampleCategoryRecord {
    const existing = Array.isArray(category.categories) ? category.categories : [];
    return {
        ...category,
        categories: build_categories_from_lines(lines, existing),
    };
}

export function apply_dropdown_lists_to_metadata(
    metadata: Record<string, unknown>,
    input: ApplyDropdownListsInput,
    options: { require_webbsida_lines?: boolean } = {}
): ApplyDropdownListsResult {
    const sample_categories = as_sample_categories(metadata);
    const webbsida_category = find_sample_category_by_hints(sample_categories, WEBBSIDA_MATCH_HINTS);
    const aterkommande_category = find_sample_category_by_hints(sample_categories, ATERKOMMANDE_MATCH_HINTS);

    if (!webbsida_category) {
        return { ok: false, error_key: 'rulefile_page_types_err_webbsida_category_missing' };
    }

    const webbsida_lines = input.webbsida_lines;
    const aterkommande_lines = input.aterkommande_lines;

    if (options.require_webbsida_lines && webbsida_lines.length === 0) {
        return { ok: false, error_key: 'rulefile_page_types_err_webbsida_list_empty' };
    }

    const webbsida_duplicate = find_duplicate_line(webbsida_lines);
    if (webbsida_duplicate) {
        return {
            ok: false,
            error_key: 'rulefile_page_types_err_duplicate_line',
            error_context: { name: webbsida_duplicate },
        };
    }

    if (aterkommande_lines !== null) {
        const aterkommande_duplicate = find_duplicate_line(aterkommande_lines);
        if (aterkommande_duplicate) {
            return {
                ok: false,
                error_key: 'rulefile_page_types_err_duplicate_line',
                error_context: { name: aterkommande_duplicate },
            };
        }
    }

    const updated_categories = sample_categories.map((category) => {
        if (webbsida_category && category === webbsida_category) {
            return update_category_dropdown_lines(category, webbsida_lines);
        }
        if (
            aterkommande_category &&
            category === aterkommande_category &&
            aterkommande_lines !== null
        ) {
            return update_category_dropdown_lines(category, aterkommande_lines);
        }
        return category;
    });

    if (!metadata.samples || typeof metadata.samples !== 'object' || Array.isArray(metadata.samples)) {
        metadata.samples = {};
    }
    (metadata.samples as Record<string, unknown>).sampleCategories = updated_categories;
    metadata.pageTypes = [...webbsida_lines];

    return { ok: true };
}
