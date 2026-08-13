/**
 * @fileoverview CSS-selectorvalidering för innehållstypdetektering i renderad DOM.
 */

/**
 * True om selector-strängen är icke-tom och giltig CSS-syntax.
 */
export function is_valid_content_type_detection_selector(selector: unknown): boolean {
    if (typeof selector !== 'string') return true;
    const trimmed = selector.trim();
    if (!trimmed) return true;
    return try_compile_content_type_detection_selector(trimmed) !== null;
}

/**
 * Försöker kompilera en selector (Node/browser utan DOM).
 */
export function try_compile_content_type_detection_selector(selector: string): string | null {
    const trimmed = String(selector || '').trim();
    if (!trimmed) return null;
    try {
        if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
            document.querySelectorAll(trimmed);
            return trimmed;
        }
        // Node/Jest: enkel syntaxkontroll utan full CSS-parser
        if (/[\x00-\x1f]/.test(trimmed)) return null;
        return trimmed;
    } catch {
        return null;
    }
}

export type ContentTypeDetectionSelectorRule = {
    id: string;
    selector: string;
};

type ContentTypeChildLike = {
    id?: string;
    detectionSelector?: string;
};

type ContentTypeGroupLike = {
    types?: ContentTypeChildLike[];
};

/**
 * Samlar undertyp-ID och selector från regelfilens contentTypes.
 */
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
            if (!try_compile_content_type_detection_selector(selector)) continue;
            rules.push({ id, selector });
        }
    }
    return rules;
}

/**
 * Räknar matchningar för en selector i en redan existerande document (browser/Puppeteer).
 */
export function count_selector_matches_in_document(
    document_ref: { querySelectorAll: (sel: string) => { length: number } },
    selector: string
): number {
    const compiled = try_compile_content_type_detection_selector(selector);
    if (!compiled) return 0;
    try {
        return document_ref.querySelectorAll(compiled).length;
    } catch {
        return 0;
    }
}
