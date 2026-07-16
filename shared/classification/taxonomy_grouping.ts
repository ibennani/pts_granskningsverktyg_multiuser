/**
 * @fileoverview Gemensam logik för taxonomier, kravklassificering och gruppering.
 *
 * UI-vägar (regelfil):
 * - Taxonomier: Regelfil → Klassificeringar → Taxonomier (EditRulefileClassificationsComponent)
 * - Kravkoppling: Regelfil → Klassificeringar → Kravkoppling (matris)
 * - Enskilt krav: Kravredigering → Klassificering (EditRulefileRequirementComponent)
 * - Legacy metadata: Redigera regelfil → Metadata → Taxonomier
 *
 * Bilaga 1: appendix1.groupingTaxonomyId + sektioner kind deficiency_group.
 */
import { resolve_taxonomies } from '../rulefile/rulefile_metadata_vocabularies.js';

export const DEFAULT_WCAG_TAXONOMY_ID = 'wcag22-pour';

export const WCAG_PRINCIPLE_FALLBACK_ORDER = [
    'perceivable',
    'operable',
    'understandable',
    'robust',
] as const;

export type TaxonomyConcept = {
    id: string;
    label: string;
    labelKey?: string;
};

export type TaxonomyDefinition = {
    id: string;
    label?: string;
    version?: string;
    uri?: string;
    concepts?: TaxonomyConcept[];
};

export type RequirementClassification = {
    taxonomyId: string;
    conceptId: string;
};

function norm_id(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

export function resolve_taxonomy_by_id(
    metadata: unknown,
    taxonomy_id: string
): TaxonomyDefinition | null {
    const normalized_id = norm_id(taxonomy_id);
    if (!normalized_id) return null;
    const taxonomies = resolve_taxonomies(metadata) as TaxonomyDefinition[];
    if (!Array.isArray(taxonomies)) return null;
    return taxonomies.find((entry) => norm_id(entry?.id) === normalized_id) ?? null;
}

export function resolve_taxonomy_concepts(
    metadata: unknown,
    taxonomy_id: string,
    t: (key: string) => string
): TaxonomyConcept[] {
    const taxonomy = resolve_taxonomy_by_id(metadata, taxonomy_id);
    if (Array.isArray(taxonomy?.concepts) && taxonomy.concepts.length > 0) {
        return taxonomy.concepts.map((concept) => ({
            id: String(concept.id ?? '').trim(),
            label:
                typeof concept.label === 'string' && concept.label.trim()
                    ? concept.label.trim()
                    : concept.labelKey
                      ? t(concept.labelKey)
                      : String(concept.id ?? ''),
            labelKey: concept.labelKey,
        })).filter((concept) => concept.id);
    }
    if (norm_id(taxonomy_id) === DEFAULT_WCAG_TAXONOMY_ID) {
        return WCAG_PRINCIPLE_FALLBACK_ORDER.map((id) => ({
            id,
            label: t(id),
            labelKey: id,
        }));
    }
    return [];
}

export function get_primary_grouping_taxonomy_id(
    rule_file_content: Record<string, unknown> | null | undefined
): string {
    const metadata = rule_file_content?.metadata as Record<string, unknown> | undefined;
    const primary = metadata?.primaryGroupingTaxonomyId;
    if (typeof primary === 'string' && primary.trim()) {
        return primary.trim();
    }
    const appendix = rule_file_content?.appendix1 as Record<string, unknown> | undefined;
    const appendix_taxonomy = appendix?.groupingTaxonomyId;
    if (typeof appendix_taxonomy === 'string' && appendix_taxonomy.trim()) {
        return appendix_taxonomy.trim();
    }
    return DEFAULT_WCAG_TAXONOMY_ID;
}

export function get_appendix1_grouping_taxonomy_id(
    rule_file_content: Record<string, unknown> | null | undefined
): string {
    const appendix = rule_file_content?.appendix1 as Record<string, unknown> | undefined;
    const appendix_taxonomy = appendix?.groupingTaxonomyId;
    if (typeof appendix_taxonomy === 'string' && appendix_taxonomy.trim()) {
        return appendix_taxonomy.trim();
    }
    return get_primary_grouping_taxonomy_id(rule_file_content);
}

/** Returnerar visningsetiketter för alla begrepp ett krav är kopplat till inom en taxonomi. */
export function get_concept_labels_for_requirement(
    requirement: Record<string, unknown>,
    metadata: unknown,
    taxonomy_id: string,
    t: (key: string) => string
): string[] {
    const concept_ids = get_concept_ids_for_requirement(requirement, taxonomy_id);
    const concepts = resolve_taxonomy_concepts(metadata, taxonomy_id, t);
    const label_by_id = new Map(
        concepts.map((concept) => [norm_id(concept.id), concept.label])
    );
    return concept_ids.map((id) => label_by_id.get(id) || id);
}

/** Sorterar begrepps-id:n enligt taxonomins konceptordning, okända sist. */
export function sort_concept_ids_for_display(
    concept_ids: string[],
    metadata: unknown,
    taxonomy_id: string
): string[] {
    const ordered = resolve_taxonomy_concepts(metadata, taxonomy_id, (key) => key).map((concept) =>
        norm_id(concept.id)
    );
    const order_index = new Map(ordered.map((id, index) => [id, index]));
    return [...new Set(concept_ids.map((id) => norm_id(id)).filter(Boolean))].sort((a, b) => {
        const index_a = order_index.get(a) ?? 9999;
        const index_b = order_index.get(b) ?? 9999;
        if (index_a !== index_b) return index_a - index_b;
        return a.localeCompare(b, 'sv');
    });
}

export function get_concept_ids_for_requirement(
    requirement: Record<string, unknown>,
    taxonomy_id: string
): string[] {
    const normalized_taxonomy_id = norm_id(taxonomy_id);
    const classifications = Array.isArray(requirement.classifications)
        ? requirement.classifications
        : [];
    const ids = (classifications as RequirementClassification[])
        .filter(
            (entry) =>
                norm_id(entry?.taxonomyId) === normalized_taxonomy_id && entry?.conceptId
        )
        .map((entry) => norm_id(String(entry.conceptId)))
        .filter(Boolean);
    return [...new Set(ids)];
}

export function apply_requirement_classifications(
    requirement: Record<string, unknown>,
    taxonomy_id: string,
    concept_ids: string[]
): Record<string, unknown> {
    const normalized_taxonomy_id = String(taxonomy_id ?? '').trim();
    const existing = Array.isArray(requirement.classifications)
        ? (requirement.classifications as RequirementClassification[])
        : [];
    const preserved = existing.filter(
        (entry) => norm_id(entry?.taxonomyId) !== norm_id(normalized_taxonomy_id)
    );
    const unique_concepts = [...new Set(
        concept_ids.map((id) => String(id ?? '').trim()).filter(Boolean)
    )];
    const next_for_taxonomy = unique_concepts.map((concept_id) => ({
        taxonomyId: normalized_taxonomy_id,
        conceptId: concept_id,
    }));
    return {
        ...requirement,
        classifications: [...preserved, ...next_for_taxonomy],
    };
}

export function count_requirements_per_concept(
    requirements: Record<string, unknown> | unknown[] | null | undefined,
    taxonomy_id: string
): Map<string, number> {
    const counts = new Map<string, number>();
    const req_list = normalize_requirements_list(requirements);
    for (const req of req_list) {
        for (const concept_id of get_concept_ids_for_requirement(req, taxonomy_id)) {
            counts.set(concept_id, (counts.get(concept_id) ?? 0) + 1);
        }
    }
    return counts;
}

export function count_unclassified_requirements(
    requirements: Record<string, unknown> | unknown[] | null | undefined,
    taxonomy_id: string
): number {
    const req_list = normalize_requirements_list(requirements);
    return req_list.filter(
        (req) => get_concept_ids_for_requirement(req, taxonomy_id).length === 0
    ).length;
}

function normalize_requirements_list(
    requirements: Record<string, unknown> | unknown[] | null | undefined
): Record<string, unknown>[] {
    if (Array.isArray(requirements)) {
        return requirements.filter(
            (entry): entry is Record<string, unknown> =>
                Boolean(entry) && typeof entry === 'object'
        );
    }
    if (requirements && typeof requirements === 'object') {
        return Object.values(requirements).filter(
            (entry): entry is Record<string, unknown> =>
                Boolean(entry) && typeof entry === 'object'
        );
    }
    return [];
}
