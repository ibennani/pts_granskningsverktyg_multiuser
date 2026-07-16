/**
 * @fileoverview Samlar unika bristtyper från granskningen grupperade per taxonomi-begrepp.
 */
import {
    DEFAULT_WCAG_TAXONOMY_ID,
    get_appendix1_grouping_taxonomy_id,
    get_concept_ids_for_requirement,
    resolve_taxonomy_concepts,
} from '../../shared/classification/taxonomy_grouping.js';
import { find_check_def_by_storage_id, find_pass_criterion_def_by_storage_id } from '../logic/entity_id_match.js';
import { for_each_failed_export_pass_criterion } from './export_deficiency_traversal.js';

export const WCAG_PRINCIPLE_ORDER = ['perceivable', 'operable', 'understandable', 'robust'] as const;

export type DeficiencyTypeText = {
    primary: string;
    secondary: string;
};

export type DeficiencyTypesByConcept = {
    concept_id: string;
    label: string;
    types: DeficiencyTypeText[];
};

/** @deprecated Använd DeficiencyTypesByConcept. */
export type DeficiencyTypesByPrinciple = DeficiencyTypesByConcept;

export function read_deficiency_type_node(node: unknown): DeficiencyTypeText | null {
    const deficiency_type = (node as { DeficiencyType?: { PrimaryText?: unknown; SecondaryText?: unknown } })
        ?.DeficiencyType;
    if (!deficiency_type) return null;
    const primary = typeof deficiency_type.PrimaryText === 'string' ? deficiency_type.PrimaryText.trim() : '';
    const secondary =
        typeof deficiency_type.SecondaryText === 'string' ? deficiency_type.SecondaryText.trim() : '';
    if (!primary) return null;
    return { primary, secondary };
}

/** @deprecated Använd resolve_taxonomy_concepts med get_appendix1_grouping_taxonomy_id. */
export function resolve_wcag_principle_concepts(
    current_audit: Record<string, unknown>,
    t: (key: string) => string
): Array<{ id: string; label: string; labelKey?: string }> {
    const rule_file = current_audit?.ruleFileContent as Record<string, unknown> | undefined;
    const taxonomy_id = get_appendix1_grouping_taxonomy_id(rule_file);
    return resolve_taxonomy_concepts(rule_file?.metadata, taxonomy_id, t);
}

/**
 * @deprecated Använd get_concept_ids_for_requirement med aktuell groupingTaxonomyId.
 */
export function get_principle_ids_for_requirement(requirement: Record<string, unknown>): string[] {
    return get_concept_ids_for_requirement(requirement, DEFAULT_WCAG_TAXONOMY_ID);
}

export function collect_deficiency_types_grouped_by_taxonomy(
    current_audit: Record<string, unknown>,
    taxonomy_id: string,
    t: (key: string) => string
): DeficiencyTypesByConcept[] {
    const rule_file = current_audit?.ruleFileContent as Record<string, unknown> | undefined;
    const concepts = resolve_taxonomy_concepts(rule_file?.metadata, taxonomy_id, t);
    const order = concepts.map((concept) => concept.id);
    const label_by_id = new Map(concepts.map((concept) => [concept.id, concept.label]));
    const groups = new Map<string, Map<string, DeficiencyTypeText>>();

    const add_entry = (concept_id: string, entry: DeficiencyTypeText) => {
        if (!concept_id) return;
        const dedupe_key = `${entry.primary}\0${entry.secondary}`;
        if (!groups.has(concept_id)) groups.set(concept_id, new Map());
        groups.get(concept_id)!.set(dedupe_key, entry);
    };

    for_each_failed_export_pass_criterion(current_audit, ({ req_definition, check_id, pc_id, pc_obj }) => {
        let type = read_deficiency_type_node(pc_obj);
        if (!type) {
            const req = req_definition as Record<string, unknown>;
            const checks = Array.isArray(req.checks) ? req.checks : [];
            const check_def = find_check_def_by_storage_id(
                checks as Array<{ id?: unknown; key?: unknown; passCriteria?: unknown[] }>,
                check_id
            );
            const pc_def = find_pass_criterion_def_by_storage_id(
                check_def?.passCriteria as Array<{ id?: unknown; key?: unknown }> | undefined,
                pc_id
            );
            type = read_deficiency_type_node(pc_def);
        }
        if (!type) return;
        const concept_ids = get_concept_ids_for_requirement(req_definition as Record<string, unknown>, taxonomy_id);
        for (const concept_id of concept_ids) {
            add_entry(concept_id, type);
        }
    });

    return order
        .filter((id) => groups.has(id) && (groups.get(id)?.size ?? 0) > 0)
        .map((id) => ({
            concept_id: id,
            label: label_by_id.get(id) || id,
            types: Array.from(groups.get(id)!.values()).sort((a, b) =>
                a.primary.localeCompare(b.primary, 'sv')
            ),
        }));
}

export function collect_deficiency_types_grouped_by_principle(
    current_audit: Record<string, unknown>,
    t: (key: string) => string
): DeficiencyTypesByConcept[] {
    const rule_file = current_audit?.ruleFileContent as Record<string, unknown> | undefined;
    const taxonomy_id = get_appendix1_grouping_taxonomy_id(rule_file);
    const groups = collect_deficiency_types_grouped_by_taxonomy(current_audit, taxonomy_id, t);
    return groups.map((group) => ({
        ...group,
        principle_id: group.concept_id,
    })) as Array<DeficiencyTypesByConcept & { principle_id: string }>;
}
