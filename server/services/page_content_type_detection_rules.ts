/**
 * @fileoverview Heuristiska regler för att mappa DOM-signaler till innehållstyp-ID:n.
 */

export type ContentTypeDetectionRule = {
    /** Nyckelord som matchas mot tillåtna innehållstyp-ID:n. */
    id_signals: string[];
    /** CSS-selectors som indikerar att signalen finns på sidan. */
    selectors: string[];
};

/** Regler för v1 — id_signals matchas med word-boundary-liknande logik mot allowed IDs. */
export const CONTENT_TYPE_DETECTION_RULES: ContentTypeDetectionRule[] = [
    {
        id_signals: ['form'],
        selectors: ['form', 'input:not([type="hidden"])', 'select', 'textarea'],
    },
    {
        id_signals: ['tabell', 'table'],
        selectors: ['table', '[role="table"]', '[role="grid"]'],
    },
    {
        id_signals: ['video'],
        selectors: ['video', 'iframe[src*="youtube"]', 'iframe[src*="vimeo"]', 'iframe[src*="youtu.be"]'],
    },
    {
        id_signals: ['audio', 'ljud'],
        selectors: ['audio', '[role="audio"]'],
    },
    {
        id_signals: ['bild', 'image', 'img'],
        selectors: ['img', 'picture', 'svg', '[role="img"]'],
    },
    {
        id_signals: ['nav', 'navigation'],
        selectors: ['nav', '[role="navigation"]'],
    },
    {
        id_signals: ['aria'],
        selectors: ['[aria-label]', '[aria-labelledby]', '[aria-describedby]'],
    },
    {
        id_signals: ['dialog', 'modal'],
        selectors: ['[role="dialog"]', '[aria-modal="true"]'],
    },
    {
        id_signals: ['carousel', 'slider'],
        selectors: ['.swiper', '[class*="carousel"]', '[class*="slider"]'],
    },
];

/**
 * True om innehållstyp-ID matchar ett signal-nyckelord utan falska substring-träffar (t.ex. information ≠ form).
 */
export function content_type_id_matches_signal(content_type_id: string, signal: string): boolean {
    const id_lower = String(content_type_id || '').toLowerCase();
    const signal_lower = String(signal || '').toLowerCase();
    if (!id_lower || !signal_lower) return false;
    if (id_lower === signal_lower) return true;
    if (id_lower === `${signal_lower}s`) return true;

    const parts = id_lower.split(/[-_]/);
    if (parts.some((part) => part === signal_lower || part === `${signal_lower}s`)) {
        return true;
    }
    if (id_lower.startsWith(`${signal_lower}-`) || id_lower.startsWith(`${signal_lower}_`)) {
        return true;
    }
    if (id_lower.endsWith(`-${signal_lower}`) || id_lower.endsWith(`_${signal_lower}`)) {
        return true;
    }
    if (id_lower.includes(`-${signal_lower}-`) || id_lower.includes(`_${signal_lower}_`)) {
        return true;
    }
    return false;
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
