/**
 * @fileoverview Förslagsmönster för detectionPattern utifrån undertypens id/text.
 * Används vid seed av regelfil och som referens i dokumentation — inte vid runtime-gissning.
 */

type SuggestInput = {
    id?: string;
    text?: string;
};

/** Signal → regex-mönster (första matchande signal vinner). */
const SIGNAL_PATTERN_DEFAULTS: Array<{ signals: string[]; pattern: string }> = [
    {
        signals: ['rubrik', 'heading', 'headings', 'h-rubrik'],
        pattern: String.raw`<h[1-6][\s/>]|role\s*=\s*["']heading["']`,
    },
    {
        signals: ['bild', 'bilder', 'image', 'images', 'img', 'grafik', 'picture'],
        pattern: String.raw`<img[\s/>]|<picture[\s/>]|role\s*=\s*["']img["']`,
    },
    {
        signals: ['tabell', 'tabeller', 'table', 'tables'],
        pattern: String.raw`<table[\s/>]|role\s*=\s*["'](?:table|grid)["']`,
    },
    {
        signals: ['form', 'formular', 'forms'],
        pattern: String.raw`<form[\s/>]|role\s*=\s*["']form["']`,
    },
    {
        signals: ['video', 'rorlig', 'rörlig'],
        pattern: String.raw`<video[\s/>]|youtube\.com|youtu\.be|vimeo\.com`,
    },
    {
        signals: ['audio', 'ljud'],
        pattern: String.raw`<audio[\s/>]|role\s*=\s*["']audio["']`,
    },
    {
        signals: ['nav', 'navigation', 'navigering'],
        pattern: String.raw`<nav[\s/>]|role\s*=\s*["']navigation["']`,
    },
    {
        signals: ['list', 'lista', 'listor'],
        pattern: String.raw`<ul[\s/>]|<ol[\s/>]|role\s*=\s*["'](?:list|listbox)["']`,
    },
    {
        signals: ['search', 'sok', 'sök'],
        pattern: String.raw`role\s*=\s*["']search["']|type\s*=\s*["']search["']`,
    },
    {
        signals: ['dialog', 'modal'],
        pattern: String.raw`<dialog[\s/>]|role\s*=\s*["']dialog["']|aria-modal\s*=\s*["']true["']`,
    },
    {
        signals: ['iframe', 'embed', 'inbaddat', 'inbäddat'],
        pattern: String.raw`<iframe[\s/>]|<embed[\s/>]|<object[\s/>]`,
    },
    {
        signals: ['aria'],
        pattern: String.raw`aria-[a-z]+=`,
    },
    {
        signals: ['carousel', 'slider', 'karusell'],
        pattern: String.raw`carousel|slider|karusell|swiper`,
    },
    {
        signals: ['main'],
        pattern: String.raw`<main[\s/>]|role\s*=\s*["']main["']`,
    },
    {
        signals: ['link', 'lank', 'länk', 'länkar'],
        pattern: String.raw`<a[\s/>]`,
    },
    {
        signals: ['button', 'knapp', 'knappar'],
        pattern: String.raw`<button[\s/>]|role\s*=\s*["']button["']`,
    },
];

function token_matches_signal(token: string, signal: string): boolean {
    if (!token || !signal) return false;
    if (token === signal) return true;
    if (token.startsWith(`${signal}-`) || token.endsWith(`-${signal}`)) return true;
    if (token.includes(`-${signal}-`) || token.includes(`_${signal}_`)) return true;
    if (signal.length >= 3 && token.startsWith(signal)) return true;
    return false;
}

function matches_any_signal(id: string, text: string, signals: string[]): boolean {
    const id_lower = id.toLowerCase();
    const text_lower = text.toLowerCase();
    const id_parts = id_lower.split(/[-_]/);

    return signals.some((signal) => {
        const signal_lower = signal.toLowerCase();
        if (text_lower.includes(signal_lower)) return true;
        if (token_matches_signal(id_lower, signal_lower)) return true;
        return id_parts.some((part) => token_matches_signal(part, signal_lower));
    });
}

/**
 * Föreslår detectionPattern för en undertyp utifrån id och text.
 * Returnerar tom sträng om ingen träff.
 */
export function suggest_detection_pattern_for_content_type(input: SuggestInput): string {
    const id = String(input?.id || '').trim();
    const text = String(input?.text || '').trim();
    if (!id && !text) return '';

    for (const entry of SIGNAL_PATTERN_DEFAULTS) {
        if (matches_any_signal(id, text, entry.signals)) {
            return entry.pattern;
        }
    }
    return '';
}

type ContentTypeChildSeed = {
    id?: string;
    text?: string;
    description?: string;
    detectionPattern?: string;
};

type ContentTypeGroupSeed = {
    id?: string;
    text?: string;
    description?: string;
    types?: ContentTypeChildSeed[];
};

/**
 * Fyller i saknade detectionPattern på alla undertyper i en regelfilskopia.
 */
export function seed_detection_patterns_in_content_types(
    content_types: ContentTypeGroupSeed[] | null | undefined
): ContentTypeGroupSeed[] {
    if (!Array.isArray(content_types)) return [];

    return content_types.map((group) => {
        const types = Array.isArray(group?.types) ? group.types : [];
        return {
            ...group,
            types: types.map((child) => {
                const existing = String(child?.detectionPattern || '').trim();
                if (existing) return { ...child };
                const suggested = suggest_detection_pattern_for_content_type({
                    id: child?.id,
                    text: child?.text,
                });
                if (!suggested) return { ...child };
                return { ...child, detectionPattern: suggested };
            }),
        };
    });
}
