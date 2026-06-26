/**
 * @fileoverview Heuristiska regler för att mappa DOM-signaler till innehållstyp-ID:n.
 */

export type ContentTypeDetectionRule = {
    /** Nyckelord som matchas mot tillåtna innehållstyp-ID:n. */
    id_signals: string[];
    /** CSS-selectors som indikerar att signalen finns på sidan. */
    selectors: string[];
};

/** Synonyma stammar — signal och regelfils-ID inom samma grupp matchar varandra. */
const ID_SIGNAL_STEM_GROUPS: string[][] = [
    ['form', 'formular', 'forms'],
    ['tabell', 'tabeller', 'table', 'tables'],
    ['video', 'rorlig', 'rörlig'],
    ['audio', 'ljud'],
    ['bild', 'bilder', 'image', 'images', 'img', 'grafik'],
    ['nav', 'navigation', 'navigering'],
    ['dialog', 'modal'],
    ['carousel', 'slider', 'karusell'],
    ['aria'],
    ['list', 'lista', 'listor'],
    ['search', 'sok', 'sök'],
    ['iframe', 'embed', 'inbaddat', 'inbäddat'],
    ['map', 'karta'],
    ['canvas'],
];

/** Regler för v1 — id_signals matchas med word-boundary-liknande logik mot allowed IDs. */
export const CONTENT_TYPE_DETECTION_RULES: ContentTypeDetectionRule[] = [
    {
        id_signals: ['form', 'formular'],
        selectors: ['form', '[role="form"]', 'input:not([type="hidden"])', 'select', 'textarea'],
    },
    {
        id_signals: ['tabell', 'tabeller', 'table'],
        selectors: ['table', '[role="table"]', '[role="grid"]'],
    },
    {
        id_signals: ['video', 'rorlig', 'rörlig'],
        selectors: [
            'video',
            'iframe[src*="youtube"]',
            'iframe[src*="vimeo"]',
            'iframe[src*="youtu.be"]',
            'embed[type="video"]',
            'object[type="video"]',
        ],
    },
    {
        id_signals: ['audio', 'ljud'],
        selectors: ['audio', '[role="audio"]', 'embed[type="audio"]'],
    },
    {
        id_signals: ['bild', 'bilder', 'image', 'img', 'grafik'],
        selectors: ['img', 'picture', 'svg', '[role="img"]', 'canvas', 'map', 'figure'],
    },
    {
        id_signals: ['nav', 'navigation', 'navigering'],
        selectors: ['nav', '[role="navigation"]', 'header nav', 'footer nav'],
    },
    {
        id_signals: ['aria'],
        selectors: ['[aria-label]', '[aria-labelledby]', '[aria-describedby]'],
    },
    {
        id_signals: ['dialog', 'modal'],
        selectors: ['[role="dialog"]', '[aria-modal="true"]', 'dialog'],
    },
    {
        id_signals: ['carousel', 'slider', 'karusell'],
        selectors: ['.swiper', '[class*="carousel"]', '[class*="slider"]', '[class*="karusell"]'],
    },
    {
        id_signals: ['list', 'lista', 'listor'],
        selectors: ['ul', 'ol', '[role="list"]', '[role="listbox"]'],
    },
    {
        id_signals: ['search', 'sok', 'sök'],
        selectors: ['[role="search"]', 'input[type="search"]', 'form[role="search"]'],
    },
    {
        id_signals: ['iframe', 'embed', 'inbaddat', 'inbäddat'],
        selectors: ['iframe:not([src*="youtube"]):not([src*="vimeo"]):not([src*="youtu.be"])', 'embed', 'object'],
    },
    {
        id_signals: ['main'],
        selectors: ['main', '[role="main"]'],
    },
];

function stems_for_signal(signal: string): string[] {
    const signal_lower = String(signal || '').toLowerCase();
    if (!signal_lower) return [];
    for (const group of ID_SIGNAL_STEM_GROUPS) {
        if (group.some((stem) => stem === signal_lower)) {
            return group;
        }
    }
    return [signal_lower];
}

function id_matches_single_stem(id_lower: string, stem: string): boolean {
    if (!id_lower || !stem) return false;
    if (id_lower === stem) return true;
    if (id_lower === `${stem}s`) return true;

    const parts = id_lower.split(/[-_]/);
    if (parts.some((part) => part === stem || part === `${stem}s`)) {
        return true;
    }
    if (id_lower.startsWith(`${stem}-`) || id_lower.startsWith(`${stem}_`)) {
        return true;
    }
    if (id_lower.endsWith(`-${stem}`) || id_lower.endsWith(`_${stem}`)) {
        return true;
    }
    if (id_lower.includes(`-${stem}-`) || id_lower.includes(`_${stem}_`)) {
        return true;
    }
    if (stem.length >= 3 && id_lower.startsWith(stem)) {
        if (id_lower.length === stem.length) return true;
        const next = id_lower[stem.length];
        if (next === 's' || next === '-' || next === '_') return true;
        if (/[a-z]/.test(next)) return true;
    }
    return false;
}

/**
 * True om innehållstyp-ID matchar ett signal-nyckelord utan falska substring-träffar (t.ex. information ≠ form).
 */
export function content_type_id_matches_signal(content_type_id: string, signal: string): boolean {
    const id_lower = String(content_type_id || '').toLowerCase();
    if (!id_lower) return false;

    const stems = stems_for_signal(signal);
    return stems.some((stem) => id_matches_single_stem(id_lower, stem));
}

/**
 * Returnerar tillåtna ID:n som matchar en regel vars signal triggats i DOM.
 */
export function map_dom_hits_to_content_type_ids(
    allowed_content_type_ids: string[],
    triggered_signals: string[]
): string[] {
    const allowed_set = new Set(allowed_content_type_ids);
    const detected = new Set<string>();

    for (const rule of CONTENT_TYPE_DETECTION_RULES) {
        const rule_triggered = rule.id_signals.some((signal) => triggered_signals.includes(signal));
        if (!rule_triggered) continue;

        for (const allowed_id of allowed_content_type_ids) {
            if (!allowed_set.has(allowed_id)) continue;
            const matches = rule.id_signals.some((signal) => content_type_id_matches_signal(allowed_id, signal));
            if (matches) {
                detected.add(allowed_id);
            }
        }
    }

    return [...detected].sort();
}

/** Serialiserbar regel för page.evaluate — endast selectors + signal. */
export type SerializableDetectionRule = {
    signal: string;
    selectors: string[];
};

export function get_serializable_detection_rules(): SerializableDetectionRule[] {
    return CONTENT_TYPE_DETECTION_RULES.flatMap((rule) =>
        rule.id_signals.map((signal) => ({ signal, selectors: rule.selectors }))
    );
}
