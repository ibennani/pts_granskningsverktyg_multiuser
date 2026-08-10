/**
 * @fileoverview Regex-mönster för automatisk innehållstypdetektering från inklistrad HTML.
 */

/** Max storlek för inklistrad HTML vid automatisk innehållstypanalys (5 MiB). */
export const MAX_PASTE_HTML_BYTES = 5 * 1024 * 1024;

export type ContentTypeDetectionPatternRule = {
    id: string;
    pattern: string;
};

/**
 * Kompilerar ett detektionsmönster säkert (skiftlägesokänsligt).
 */
export function compile_content_type_detection_pattern(pattern: string): RegExp | null {
    const trimmed = String(pattern || '').trim();
    if (!trimmed) return null;
    try {
        return new RegExp(trimmed, 'i');
    } catch {
        return null;
    }
}

/**
 * True om mönstret är icke-tomt och giltigt som RegExp.
 */
export function is_valid_content_type_detection_pattern(pattern: unknown): boolean {
    if (typeof pattern !== 'string') return true;
    const trimmed = pattern.trim();
    if (!trimmed) return true;
    return compile_content_type_detection_pattern(trimmed) !== null;
}

type ContentTypeChildLike = {
    id?: string;
    detectionPattern?: string;
};

type ContentTypeGroupLike = {
    types?: ContentTypeChildLike[];
};

type RuleFileLike = {
    metadata?: Record<string, unknown>;
};

/**
 * Samlar undertyp-ID och mönster från regelfilens contentTypes.
 */
export function collect_child_detection_patterns_from_groups(
    groups: ContentTypeGroupLike[] | null | undefined
): ContentTypeDetectionPatternRule[] {
    const rules: ContentTypeDetectionPatternRule[] = [];
    if (!Array.isArray(groups)) return rules;

    for (const group of groups) {
        const children = Array.isArray(group?.types) ? group.types : [];
        for (const child of children) {
            const id = String(child?.id || '').trim();
            const pattern = String(child?.detectionPattern || '').trim();
            if (!id || !pattern) continue;
            if (!compile_content_type_detection_pattern(pattern)) continue;
            rules.push({ id, pattern });
        }
    }
    return rules;
}

/**
 * Returnerar ID:n för undertyper vars mönster matchar HTML-strängen.
 */
export function detect_content_type_ids_from_html(
    html: string,
    rules: ContentTypeDetectionPatternRule[]
): string[] {
    const source = String(html || '');
    if (!source.trim()) return [];

    const detected = new Set<string>();
    for (const rule of rules) {
        const regex = compile_content_type_detection_pattern(rule.pattern);
        if (!regex) continue;
        try {
            if (regex.test(source)) {
                detected.add(rule.id);
            }
        } catch {
            // Ogiltigt eller problematiskt mönster vid körning — hoppa över typen.
        }
    }
    return [...detected].sort();
}
