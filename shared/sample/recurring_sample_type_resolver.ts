/**
 * @fileoverview Deterministisk mappning från recurring-förslag till befintlig sampletyp i aktiv regelfil.
 */
import { resolve_sample_vocab } from '../rulefile/rulefile_metadata_vocabularies.js';

export type RecurringProposalKind = 'header' | 'menu' | 'footer' | 'cookie' | 'section_navigation' | 'other_recurring';

export type RecurringSampleTarget = {
    sampleCategory: string;
    sampleType: string;
    categoryLabel: string;
    typeLabel: string;
};

type SampleTypeLike = { id?: string; text?: string };
type SampleCategoryLike = {
    id?: string;
    text?: string;
    hasUrl?: boolean;
    categories?: SampleTypeLike[];
};

function norm(value: unknown): string {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

const LABEL_CANDIDATES: Record<RecurringProposalKind, string[]> = {
    header: ['sidhuvud', 'header'],
    menu: ['huvudmeny', 'meny', 'navigation', 'navigering'],
    footer: ['sidfot', 'footer'],
    cookie: ['cookiebanner', 'cookie banner', 'kakbanner', 'samtyckesbanner', 'cookie'],
    section_navigation: ['sektionsnavigation', 'lokal navigation', 'lokal navigering', 'sekundar navigation'],
    other_recurring: ['annat aterkommande innehall', 'aterkommande innehall', 'annat aterkommande'],
};

function type_score(kind: RecurringProposalKind, label: string): number {
    const normalized = norm(label);
    if (!normalized) return 0;
    const candidates = LABEL_CANDIDATES[kind].map(norm);
    let best = 0;
    for (const candidate of candidates) {
        if (normalized === candidate) best = Math.max(best, 100);
        else if (normalized.includes(candidate) || candidate.includes(normalized)) best = Math.max(best, 75);
    }
    return best;
}

export function resolve_recurring_sample_target(
    metadata: unknown,
    kind: RecurringProposalKind
): RecurringSampleTarget | null {
    const categories = resolve_sample_vocab(metadata).sampleCategories as SampleCategoryLike[];
    let best: { score: number; value: RecurringSampleTarget } | null = null;

    for (const category of categories) {
        if (category?.hasUrl === true) continue;
        const category_id = String(category?.id || '').trim();
        if (!category_id) continue;
        for (const type of Array.isArray(category?.categories) ? category.categories : []) {
            const type_id = String(type?.id || '').trim();
            if (!type_id) continue;
            const score = type_score(kind, String(type?.text || ''));
            if (score <= 0) continue;
            const category_bonus = /aterkommande|gemensam/.test(norm(category?.text)) ? 10 : 0;
            const value = {
                sampleCategory: category_id,
                sampleType: type_id,
                categoryLabel: String(category?.text || '').trim(),
                typeLabel: String(type?.text || '').trim(),
            };
            if (!best || score + category_bonus > best.score) best = { score: score + category_bonus, value };
        }
    }
    return best?.value || null;
}
