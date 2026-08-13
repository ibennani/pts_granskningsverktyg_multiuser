/**
 * @fileoverview Deterministisk sidtypsklassificering mot regelfilens sample types.
 */
import { resolve_sample_vocab } from '../rulefile/rulefile_metadata_vocabularies.js';

export type SamplePageTypeCandidate = {
    typeId: string;
    label: string;
    score: number;
    reasons: string[];
};

export type SamplePageTypeClassification = {
    suggestedTypeId: string | null;
    score: number;
    confidence: number;
    reasons: string[];
    alternatives: SamplePageTypeCandidate[];
};

const LOW_CONFIDENCE_THRESHOLD = 0.45;

type ClassifyInput = {
    final_url: string;
    page_title?: string;
    h1_text?: string;
    html?: string;
    rule_file_content?: unknown;
};

function normalize_text(value: unknown): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
}

function parse_url_parts(url: string): { path: string; query: Record<string, string> } {
    try {
        const parsed = new URL(url);
        const query: Record<string, string> = {};
        parsed.searchParams.forEach((v, k) => {
            query[k.toLowerCase()] = v;
        });
        return { path: parsed.pathname || '/', query };
    } catch {
        return { path: '/', query: {} };
    }
}

type SampleCategoryLike = {
    categories?: Array<{ id?: string; text?: string }>;
};

function resolve_metadata_from_rule_file(rule_file_content: unknown): unknown {
    if (
        rule_file_content &&
        typeof rule_file_content === 'object' &&
        !Array.isArray(rule_file_content) &&
        'metadata' in rule_file_content
    ) {
        const meta = (rule_file_content as { metadata?: unknown }).metadata;
        if (meta && typeof meta === 'object') {
            return meta;
        }
    }
    return rule_file_content;
}

function collect_sample_types(rule_file_content: unknown): Array<{ id: string; label: string }> {
    const vocab = resolve_sample_vocab(resolve_metadata_from_rule_file(rule_file_content));
    const types: Array<{ id: string; label: string }> = [];
    for (const cat of vocab.sampleCategories ?? []) {
        const category = cat as SampleCategoryLike;
        for (const child of category.categories ?? []) {
            const id = String(child.id || '').trim();
            const label = String(child.text || '').trim();
            if (id) types.push({ id, label: label || id });
        }
    }
    return types;
}

function score_homepage(url: string): { score: number; reasons: string[] } {
    const { path } = parse_url_parts(url);
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0 || (segments.length === 1 && segments[0] === 'index.html')) {
        return { score: 0.9, reasons: ['URL är webbplatsens rot'] };
    }
    return { score: 0, reasons: [] };
}

function score_search(url: string, title: string, h1: string): { score: number; reasons: string[] } {
    const { path, query } = parse_url_parts(url);
    const path_norm = normalize_text(path);
    const reasons: string[] = [];
    let score = 0;
    if (/(^|\/)(sok|sök|search)(\/|$)/i.test(path)) {
        score += 0.7;
        reasons.push('URL-path tyder på sökresultat');
    }
    if (query.q || query.query || query.search || query.sok) {
        score += 0.5;
        reasons.push('URL har sökparameter');
    }
    if (normalize_text(title).includes('sok') || normalize_text(h1).includes('sok')) {
        score += 0.2;
        reasons.push('Titel eller huvudrubrik tyder på sökning');
    }
    return { score: Math.min(score, 1), reasons };
}

function score_product(html: string): { score: number; reasons: string[] } {
    const source = String(html || '');
    if (!source.trim()) return { score: 0, reasons: [] };
    if (/"@type"\s*:\s*"Product"/i.test(source)) {
        return { score: 0.95, reasons: ['Strukturerad data med Product hittades'] };
    }
    if (/\b(sku|gtin|offers?)\b/i.test(source) && /<button|add-to-cart|varukorg/i.test(source)) {
        return { score: 0.6, reasons: ['Produktrelaterade signaler i HTML'] };
    }
    return { score: 0, reasons: [] };
}

function score_keyword_page(
    title: string,
    h1: string,
    url: string,
    keywords: string[],
    reason_label: string
): { score: number; reasons: string[] } {
    const blob = normalize_text(`${title} ${h1} ${url}`);
    const hit = keywords.some((k) => blob.includes(normalize_text(k)));
    return hit ? { score: 0.75, reasons: [reason_label] } : { score: 0, reasons: [] };
}

function map_label_to_type(
    types: Array<{ id: string; label: string }>,
    label_hints: string[]
): string | null {
    const hints = label_hints.map((h) => normalize_text(h));
    for (const typ of types) {
        const label = normalize_text(typ.label);
        const id = normalize_text(typ.id);
        if (hints.some((h) => label.includes(h) || id.includes(h))) {
            return typ.id;
        }
    }
    return null;
}

/**
 * Klassificerar sidtyp med vägd evidens mot regelfilens tillgängliga typer.
 */
export function classify_sample_page_type(input: ClassifyInput): SamplePageTypeClassification {
    const types = collect_sample_types(input.rule_file_content);
    const title = String(input.page_title || '');
    const h1 = String(input.h1_text || '');
    const html = String(input.html || '');
    const url = String(input.final_url || '');

    const candidates: SamplePageTypeCandidate[] = [];

    const home = score_homepage(url);
    const home_id = map_label_to_type(types, ['start', 'hem', 'homepage', 'startsida']);
    if (home_id && home.score > 0) {
        candidates.push({ typeId: home_id, label: types.find((t) => t.id === home_id)?.label || home_id, score: home.score, reasons: home.reasons });
    }

    const search = score_search(url, title, h1);
    const search_id = map_label_to_type(types, ['sok', 'sök', 'search', 'sökresultat']);
    if (search_id && search.score > 0) {
        candidates.push({ typeId: search_id, label: types.find((t) => t.id === search_id)?.label || search_id, score: search.score, reasons: search.reasons });
    }

    const product = score_product(html);
    const product_id = map_label_to_type(types, ['produkt', 'product']);
    if (product_id && product.score > 0) {
        candidates.push({ typeId: product_id, label: types.find((t) => t.id === product_id)?.label || product_id, score: product.score, reasons: product.reasons });
    }

    const a11y = score_keyword_page(title, h1, url, ['tillganglighet', 'tillgänglighet', 'accessibility'], 'Nyckelord för tillgänglighetsinformation');
    const a11y_id = map_label_to_type(types, ['tillgang', 'accessibility', 'tillgänglig']);
    if (a11y_id && a11y.score > 0) {
        candidates.push({ typeId: a11y_id, label: types.find((t) => t.id === a11y_id)?.label || a11y_id, score: a11y.score, reasons: a11y.reasons });
    }

    const terms = score_keyword_page(title, h1, url, ['kopvillkor', 'köpvillkor', 'villkor', 'terms'], 'Nyckelord för köpvillkor');
    const terms_id = map_label_to_type(types, ['villkor', 'terms', 'kopvillkor', 'köpvillkor']);
    if (terms_id && terms.score > 0) {
        candidates.push({ typeId: terms_id, label: types.find((t) => t.id === terms_id)?.label || terms_id, score: terms.score, reasons: terms.reasons });
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const confidence = best?.score ?? 0;

    if (!best || confidence < LOW_CONFIDENCE_THRESHOLD) {
        return {
            suggestedTypeId: null,
            score: best?.score ?? 0,
            confidence,
            reasons: best?.reasons ?? [],
            alternatives: candidates.slice(0, 5),
        };
    }

    return {
        suggestedTypeId: best.typeId,
        score: best.score,
        confidence,
        reasons: best.reasons,
        alternatives: candidates.filter((c) => c.typeId !== best.typeId).slice(0, 4),
    };
}
