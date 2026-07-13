/**
 * @fileoverview Ren logik för innehållstyp-detektering i granskningsdelsformuläret (testbar).
 */

import { resolve_content_types } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';

type ContentTypeGroup = {
    id?: string;
    types?: Array<{ id?: string }>;
};

type RuleFileLike = {
    metadata?: Record<string, unknown>;
};

export function collect_allowed_content_type_ids(rule_file: RuleFileLike | null | undefined): string[] {
    const groups = resolve_content_types(rule_file?.metadata) as ContentTypeGroup[];
    const ids = new Set<string>();
    for (const group of groups) {
        const child_types = group.types || [];
        if (child_types.length === 0) {
            const parent_id = String(group.id || '').trim();
            if (parent_id) ids.add(parent_id);
            continue;
        }
        for (const child of child_types) {
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
