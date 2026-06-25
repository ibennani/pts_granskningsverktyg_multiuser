/**
 * @fileoverview Ren logik för innehållstyp-detektering i stickprovsformuläret (testbar).
 */

type ContentTypeGroup = {
    types?: Array<{ id?: string }>;
};

type RuleFileLike = {
    metadata?: {
        vocabularies?: { contentTypes?: ContentTypeGroup[] };
        contentTypes?: ContentTypeGroup[];
    };
};

export function collect_allowed_content_type_ids(rule_file: RuleFileLike | null | undefined): string[] {
    const groups =
        rule_file?.metadata?.vocabularies?.contentTypes ||
        rule_file?.metadata?.contentTypes ||
        [];
    const ids = new Set<string>();
    for (const group of groups) {
        for (const child of group.types || []) {
            const id = String(child?.id || '').trim();
            if (id) ids.add(id);
        }
    }
    return [...ids].sort();
}

export function should_apply_detected_content_types(selected_ids: string[]): boolean {
    return selected_ids.length === 0;
}

export function count_newly_applied_ids(selected_ids: string[], detected_ids: string[]): number {
    const selected_set = new Set(selected_ids);
    return detected_ids.filter((id) => !selected_set.has(id)).length;
}
