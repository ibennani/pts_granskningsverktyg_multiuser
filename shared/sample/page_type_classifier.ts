/**
 * @fileoverview Deterministisk klassificering av URL-baserade granskningsdelar.
 * Ingen AI används. Resultatet är ett förslag som alltid kan ändras av granskaren.
 */

export type PageTypeKind =
    | 'home'
    | 'search_results'
    | 'product'
    | 'accessibility_information'
    | 'terms'
    | 'contact'
    | 'article_or_information'
    | 'unknown';

export type PageTypeClassifierInput = {
    requestedUrl?: string | null;
    finalUrl?: string | null;
    pageTitle?: string | null;
    h1Texts?: string[] | null;
    jsonLdTypes?: string[] | null;
    repeatedCardCount?: number | null;
    hasPriceSignal?: boolean;
    hasProductIdentifierSignal?: boolean;
    hasSearchLandmark?: boolean;
};

export type PageTypeClassification = {
    kind: PageTypeKind;
    score: number;
    confidence: 'high' | 'medium' | 'low' | 'none';
    reasons: string[];
    alternatives: Array<{ kind: PageTypeKind; score: number }>;
};

function normalize(value: unknown): string {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function safe_url(raw: unknown): URL | null {
    const value = String(raw ?? '').trim();
    if (!value) return null;
    try {
        return new URL(value);
    } catch {
        return null;
    }
}

function add_score(
    scores: Map<PageTypeKind, { score: number; reasons: string[] }>,
    kind: PageTypeKind,
    points: number,
    reason: string
): void {
    const current = scores.get(kind) || { score: 0, reasons: [] };
    current.score += points;
    if (!current.reasons.includes(reason)) current.reasons.push(reason);
    scores.set(kind, current);
}

function text_contains_any(text: string, terms: string[]): boolean {
    return terms.some((term) => text.includes(normalize(term)));
}

export function classify_page_type(input: PageTypeClassifierInput): PageTypeClassification {
    const scores = new Map<PageTypeKind, { score: number; reasons: string[] }>();
    const final_url = safe_url(input.finalUrl) || safe_url(input.requestedUrl);
    const title = normalize(input.pageTitle);
    const h1 = normalize((input.h1Texts || []).join(' '));
    const title_h1 = `${title} ${h1}`.trim();
    const path = normalize(final_url?.pathname || '');
    const query_keys = new Set<string>();
    final_url?.searchParams.forEach((_value, key) => query_keys.add(normalize(key)));

    if (final_url && (final_url.pathname === '/' || final_url.pathname === '')) {
        add_score(scores, 'home', 90, 'origin-root-url');
        if (!final_url.search) add_score(scores, 'home', 10, 'no-query-string');
    }

    const json_types = (input.jsonLdTypes || []).map(normalize);
    if (json_types.some((type) => type === 'product' || type.endsWith('/product'))) {
        add_score(scores, 'product', 100, 'json-ld-product');
    }
    if (input.hasProductIdentifierSignal) add_score(scores, 'product', 25, 'product-identifier');
    if (input.hasPriceSignal) add_score(scores, 'product', 15, 'price-signal');
    if (text_contains_any(path, ['/produkt', '/product', '/p/'])) add_score(scores, 'product', 25, 'product-url-pattern');

    const search_path = text_contains_any(path, ['/sok', '/search', '/sök']);
    const search_query = ['q', 'query', 'search', 'sok', 'sök'].some((key) => query_keys.has(normalize(key)));
    if (search_path) add_score(scores, 'search_results', 55, 'search-url-path');
    if (search_query) add_score(scores, 'search_results', 35, 'search-query-parameter');
    if (input.hasSearchLandmark) add_score(scores, 'search_results', 10, 'search-landmark');
    if ((input.repeatedCardCount || 0) >= 3 && (search_path || search_query)) {
        add_score(scores, 'search_results', 15, 'repeated-result-cards');
    }
    if (text_contains_any(title_h1, ['sökresultat', 'sokresultat', 'visar resultat', 'search results'])) {
        add_score(scores, 'search_results', 25, 'search-result-title');
    }

    const accessibility_terms = [
        'tillgänglighetsredogörelse',
        'tillganglighetsredogorelse',
        'digital tillgänglighet',
        'digital tillganglighet',
        'accessibility statement',
        'accessibility',
    ];
    if (text_contains_any(path, ['tillganglighet', 'tillgänglighet', 'accessibility'])) {
        add_score(scores, 'accessibility_information', 65, 'accessibility-url-pattern');
    }
    if (text_contains_any(title_h1, accessibility_terms)) {
        add_score(scores, 'accessibility_information', 45, 'accessibility-title-or-heading');
    }

    const terms_terms = ['köpvillkor', 'kopvillkor', 'allmänna villkor', 'allmanna villkor', 'terms and conditions', 'terms of service'];
    if (text_contains_any(path, ['kopvillkor', 'köpvillkor', 'terms', 'villkor'])) {
        add_score(scores, 'terms', 60, 'terms-url-pattern');
    }
    if (text_contains_any(title_h1, terms_terms)) {
        add_score(scores, 'terms', 45, 'terms-title-or-heading');
    }

    if (text_contains_any(path, ['/kontakt', '/contact']) || text_contains_any(title_h1, ['kontakta oss', 'kontakt', 'contact us'])) {
        add_score(scores, 'contact', 70, 'contact-signal');
    }

    if (scores.size === 0 && (title || h1)) {
        add_score(scores, 'article_or_information', 30, 'generic-titled-page');
    }

    const ranked = [...scores.entries()]
        .map(([kind, value]) => ({ kind, score: Math.min(100, value.score), reasons: value.reasons }))
        .sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind));

    const winner = ranked[0];
    if (!winner || winner.score < 45) {
        return {
            kind: 'unknown',
            score: winner?.score || 0,
            confidence: 'none',
            reasons: winner?.reasons || [],
            alternatives: ranked.slice(0, 3).map(({ kind, score }) => ({ kind, score })),
        };
    }

    const second = ranked[1];
    const margin = second ? winner.score - second.score : winner.score;
    let confidence: PageTypeClassification['confidence'] = 'low';
    if (winner.score >= 85 && margin >= 20) confidence = 'high';
    else if (winner.score >= 65 && margin >= 10) confidence = 'medium';

    // Vid otydlig konkurrens väljs ingen typ automatiskt.
    if (second && margin < 8) {
        return {
            kind: 'unknown',
            score: winner.score,
            confidence: 'none',
            reasons: ['ambiguous-classification', ...winner.reasons],
            alternatives: ranked.slice(0, 3).map(({ kind, score }) => ({ kind, score })),
        };
    }

    return {
        kind: winner.kind,
        score: winner.score,
        confidence,
        reasons: winner.reasons,
        alternatives: ranked.slice(1, 4).map(({ kind, score }) => ({ kind, score })),
    };
}

export type SampleTypeOption = { id?: string; text?: string };

const KIND_LABEL_HINTS: Record<PageTypeKind, string[]> = {
    home: ['startsida', 'start', 'home'],
    search_results: ['sökresultat', 'sokresultat', 'sök', 'search results'],
    product: ['produktinformation', 'produktsida', 'produkt', 'product'],
    accessibility_information: ['tillgänglighetsinformation', 'tillganglighetsinformation', 'tillgänglighet', 'accessibility'],
    terms: ['köpvillkor', 'kopvillkor', 'villkor', 'terms'],
    contact: ['kontakt', 'contact'],
    article_or_information: ['informationssida', 'information', 'artikel', 'article'],
    unknown: [],
};

/** Mappar intern klassificering mot de typer som faktiskt finns i aktiv regelfil. */
export function resolve_sample_type_id_for_classification(
    classification: PageTypeClassification,
    options: SampleTypeOption[]
): string | null {
    if (classification.kind === 'unknown' || classification.confidence === 'none') return null;
    const hints = KIND_LABEL_HINTS[classification.kind].map(normalize);
    for (const option of options) {
        const id = String(option?.id || '').trim();
        const text = normalize(option?.text);
        if (!id || !text) continue;
        if (hints.some((hint) => text === hint || text.includes(hint))) return id;
    }
    return null;
}
