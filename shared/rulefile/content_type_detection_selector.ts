/**
 * @fileoverview CSS-selectorregler för automatisk innehållstypdetektering mot renderad DOM.
 */

export type ContentTypeDetectionSelectorRule = {
    id: string;
    selector: string;
};

/**
 * Validerar syntaxen på en CSS-selector utan att vara beroende av DOM.
 * Den slutliga valideringen görs alltid i webbläsaren med querySelector.
 * Här fångas de vanligaste uppenbara felen så att regelfilseditorn kan ge tidig återkoppling.
 */
export function is_valid_content_type_detection_selector(selector: unknown): boolean {
    if (typeof selector !== 'string') return true;
    const trimmed = selector.trim();
    if (!trimmed) return true;

    // Kontrollera balansering av parenteser/hakparenteser/citat. Full CSS-parser finns avsiktligt inte här.
    let square = 0;
    let round = 0;
    let quote: '"' | "'" | null = null;
    let escaped = false;
    for (const ch of trimmed) {
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if (quote) {
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === '[') square += 1;
        if (ch === ']') square -= 1;
        if (ch === '(') round += 1;
        if (ch === ')') round -= 1;
        if (square < 0 || round < 0) return false;
    }
    if (quote || square !== 0 || round !== 0) return false;
    if (/[,>+~]\s*$/.test(trimmed)) return false;
    return true;
}

type ContentTypeChildLike = {
    id?: string;
    detectionSelector?: string;
};

type ContentTypeGroupLike = {
    types?: ContentTypeChildLike[];
};

/** Samlar undertyp-ID och selector från regelfilens contentTypes. */
export function collect_child_detection_selectors_from_groups(
    groups: ContentTypeGroupLike[] | null | undefined
): ContentTypeDetectionSelectorRule[] {
    const rules: ContentTypeDetectionSelectorRule[] = [];
    if (!Array.isArray(groups)) return rules;

    for (const group of groups) {
        const children = Array.isArray(group?.types) ? group.types : [];
        for (const child of children) {
            const id = String(child?.id || '').trim();
            const selector = String(child?.detectionSelector || '').trim();
            if (!id || !selector) continue;
            if (!is_valid_content_type_detection_selector(selector)) continue;
            rules.push({ id, selector });
        }
    }
    return rules;
}
