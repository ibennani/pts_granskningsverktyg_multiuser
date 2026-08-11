/**
 * @fileoverview Förvalda innehållstyper i regelfilen (förkryssade vid ny granskningsdel).
 */
import { resolve_content_types } from './rulefile_metadata_vocabularies.js';

type ContentTypeChildLike = {
    id?: string;
    defaultSelected?: boolean;
};

type ContentTypeParentLike = {
    types?: ContentTypeChildLike[];
};

/**
 * Returnerar id för undertyper markerade som förvalda i regelfilen.
 */
export function get_default_content_type_ids(metadata: unknown): string[] {
    const content_types = resolve_content_types(metadata) as ContentTypeParentLike[];
    const ids: string[] = [];

    for (const parent of content_types) {
        const children = Array.isArray(parent.types) ? parent.types : [];
        for (const child of children) {
            if (child.defaultSelected !== true) continue;
            const id = String(child.id ?? '').trim();
            if (id) ids.push(id);
        }
    }

    return ids;
}

/**
 * Initial val av innehållstyper i granskningsdelsformuläret.
 */
export function resolve_initial_content_type_ids(
    effective_sample_data: { selectedContentTypes?: string[] } | null | undefined,
    metadata: unknown,
    is_new_sample: boolean
): string[] {
    if (!is_new_sample) {
        const saved = effective_sample_data?.selectedContentTypes;
        return Array.isArray(saved) ? [...saved] : [];
    }

    if (effective_sample_data && Array.isArray(effective_sample_data.selectedContentTypes)) {
        return [...effective_sample_data.selectedContentTypes];
    }

    return get_default_content_type_ids(metadata);
}
