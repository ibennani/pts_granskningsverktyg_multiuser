/**
 * @fileoverview Taxonomival och legacy POUR→FPTT-mappning i Bilaga 2-export.
 */
import {
    DEFAULT_WCAG_TAXONOMY_ID,
    WCAG_PRINCIPLE_FALLBACK_ORDER,
    get_concept_ids_for_requirement,
    resolve_taxonomy_concepts,
} from '../../shared/classification/taxonomy_grouping.js';
import {
    read_audit_type_id,
    resolve_grouping_taxonomy_id,
} from '../../shared/audit/audit_type_metadata.js';

export const EXPORT_DEFAULT_POUR_TAXONOMY_ID = DEFAULT_WCAG_TAXONOMY_ID;

type TaxonomyTranslate = (key: string) => string;

function norm_taxonomy_id(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

function is_pour_taxonomy_id(taxonomy_id: string): boolean {
    return norm_taxonomy_id(taxonomy_id) === norm_taxonomy_id(EXPORT_DEFAULT_POUR_TAXONOMY_ID);
}

/**
 * Tillsyn → POUR, Marknadskontroll → FPTT, saknat val → POUR.
 */
export function get_export_grouping_taxonomy_id(
    current_audit: Record<string, unknown> | null | undefined
): string {
    const rule_content = current_audit?.ruleFileContent as Record<string, unknown> | undefined;
    const audit_metadata = current_audit?.auditMetadata as Record<string, unknown> | undefined;
    if (read_audit_type_id(audit_metadata)) {
        return resolve_grouping_taxonomy_id(rule_content ?? null, audit_metadata);
    }
    return EXPORT_DEFAULT_POUR_TAXONOMY_ID;
}

function resolve_target_concept_id_for_pour_concept(
    pour_concept_id: string,
    target_concepts: Array<{ id: string }>,
    pour_concepts: Array<{ id: string }>
): string | null {
    const normalized_pour = norm_taxonomy_id(pour_concept_id);
    const direct_match = target_concepts.find(
        (concept) => norm_taxonomy_id(concept.id) === normalized_pour
    );
    if (direct_match) {
        return norm_taxonomy_id(direct_match.id);
    }

    const pour_index = pour_concepts.findIndex(
        (concept) => norm_taxonomy_id(concept.id) === normalized_pour
    );
    if (pour_index >= 0 && target_concepts[pour_index]) {
        return norm_taxonomy_id(target_concepts[pour_index].id);
    }

    const wcag_index = WCAG_PRINCIPLE_FALLBACK_ORDER.findIndex(
        (concept_id) => norm_taxonomy_id(concept_id) === normalized_pour
    );
    if (wcag_index >= 0 && target_concepts[wcag_index]) {
        return norm_taxonomy_id(target_concepts[wcag_index].id);
    }
    return null;
}

function map_pour_concept_ids_to_target_taxonomy(
    pour_concept_ids: string[],
    metadata: unknown,
    target_taxonomy_id: string,
    t: TaxonomyTranslate
): string[] {
    const target_concepts = resolve_taxonomy_concepts(metadata, target_taxonomy_id, t);
    const pour_concepts = resolve_taxonomy_concepts(metadata, EXPORT_DEFAULT_POUR_TAXONOMY_ID, t);
    const mapped = new Set<string>();

    for (const pour_concept_id of pour_concept_ids) {
        const target_id = resolve_target_concept_id_for_pour_concept(
            pour_concept_id,
            target_concepts,
            pour_concepts
        );
        if (target_id) {
            mapped.add(target_id);
        }
    }
    return [...mapped];
}

/**
 * Kravkoppling för export: direkt i vald taxonomi, med POUR-fallback för legacy FPTT-granskningar.
 */
export function get_export_concept_ids_for_requirement(
    requirement: Record<string, unknown>,
    metadata: unknown,
    target_taxonomy_id: string,
    t: TaxonomyTranslate
): string[] {
    const direct_ids = get_concept_ids_for_requirement(requirement, target_taxonomy_id);
    if (direct_ids.length > 0 || is_pour_taxonomy_id(target_taxonomy_id)) {
        return direct_ids;
    }

    const pour_ids = get_concept_ids_for_requirement(requirement, EXPORT_DEFAULT_POUR_TAXONOMY_ID);
    if (pour_ids.length === 0) {
        return direct_ids;
    }

    return map_pour_concept_ids_to_target_taxonomy(pour_ids, metadata, target_taxonomy_id, t);
}
