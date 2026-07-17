/**
 * @fileoverview Gemensamma nycklar och lookup för taxonomier i Klassificeringar.
 */
import { resolve_taxonomies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import { resolve_taxonomy_by_id } from '../../logic/requirement_classifications.js';

export type TaxonomyRow = {
    id?: string;
    label?: string;
    concepts?: unknown[];
};

export function taxonomy_row_key(taxonomy: TaxonomyRow, index: number): string {
    return String(taxonomy.id ?? '').trim() || `taxonomy-${index + 1}`;
}

export function taxonomy_display_name(
    taxonomy: TaxonomyRow,
    t: (key: string, opts?: Record<string, unknown>) => string
): string {
    const label = String(taxonomy.label ?? '').trim();
    if (label) return label;
    const id = String(taxonomy.id ?? '').trim();
    if (id) return id;
    return t('rulefile_metadata_untitled_item');
}

export function find_taxonomy_by_key(
    metadata: Record<string, unknown>,
    key: string
): { taxonomy: TaxonomyRow; index: number } | null {
    const normalized_key = String(key ?? '').trim().toLowerCase();
    if (!normalized_key) return null;

    const by_id = resolve_taxonomy_by_id(metadata, key);
    if (by_id) {
        const taxonomies = resolve_taxonomies(metadata) as TaxonomyRow[];
        const index = taxonomies.findIndex(
            (row) => String(row?.id ?? '').trim().toLowerCase() === normalized_key
        );
        return { taxonomy: by_id as TaxonomyRow, index: index >= 0 ? index : 0 };
    }

    const taxonomies = resolve_taxonomies(metadata) as TaxonomyRow[];
    const fallback_index = taxonomies.findIndex(
        (row, index) => taxonomy_row_key(row, index).toLowerCase() === normalized_key
    );
    if (fallback_index < 0) return null;
    return { taxonomy: taxonomies[fallback_index]!, index: fallback_index };
}

export function taxonomy_list_route_params(): Record<string, string> {
    return { section: 'classifications', part: 'taxonomy' };
}

export function taxonomy_detail_route_params(taxonomy_key: string): Record<string, string> {
    return { ...taxonomy_list_route_params(), taxonomyId: taxonomy_key };
}

export function taxonomy_edit_route_params(taxonomy_key?: string): Record<string, string> {
    if (taxonomy_key) {
        return { ...taxonomy_detail_route_params(taxonomy_key), edit: 'true' };
    }
    return { ...taxonomy_list_route_params(), edit: 'true' };
}

export function taxonomy_create_route_params(): Record<string, string> {
    return taxonomy_edit_route_params();
}
