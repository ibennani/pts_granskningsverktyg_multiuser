/**
 * @fileoverview Samlar unika bristtyper från granskningen grupperade per WCAG-princip.
 */
import { find_check_def_by_storage_id, find_pass_criterion_def_by_storage_id } from '../logic/entity_id_match.js';
import { for_each_failed_export_pass_criterion } from './export_deficiency_traversal.js';
import { resolve_taxonomies } from '../../shared/rulefile/rulefile_metadata_vocabularies.js';

export const WCAG_PRINCIPLE_ORDER = ['perceivable', 'operable', 'understandable', 'robust'] as const;

export type DeficiencyTypeText = {
    primary: string;
    secondary: string;
};

export type DeficiencyTypesByPrinciple = {
    principle_id: string;
    label: string;
    types: DeficiencyTypeText[];
};

type PrincipleConcept = { id: string; label: string; labelKey?: string };

function norm_taxonomy_string(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

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

export function resolve_wcag_principle_concepts(
    current_audit: Record<string, unknown>,
    t: (key: string) => string
): PrincipleConcept[] {
    const meta = current_audit?.ruleFileContent as Record<string, unknown> | undefined;
    const metadata = meta?.metadata as Record<string, unknown> | undefined;
    const taxonomies = resolve_taxonomies(metadata);
    const pour_taxonomy = Array.isArray(taxonomies)
        ? (taxonomies as Array<{ id?: string; concepts?: PrincipleConcept[] }>).find(
              (entry) => entry?.id === 'wcag22-pour'
          )
        : null;
    const concepts =
        Array.isArray(pour_taxonomy?.concepts) && pour_taxonomy.concepts.length > 0
            ? pour_taxonomy.concepts
            : WCAG_PRINCIPLE_ORDER.map((id) => ({ id, labelKey: id, label: id }));

    return concepts.map((concept) => {
        const label =
            typeof concept.label === 'string' && concept.label.trim()
                ? concept.label.trim()
                : concept.labelKey
                  ? t(concept.labelKey)
                  : concept.id;
        return { id: concept.id, label, labelKey: concept.labelKey };
    });
}

export function get_principle_ids_for_requirement(requirement: Record<string, unknown>): string[] {
    const classifications = Array.isArray(requirement.classifications) ? requirement.classifications : [];
    const ids = (classifications as Array<{ taxonomyId?: string; conceptId?: string }>)
        .filter((entry) => norm_taxonomy_string(entry.taxonomyId) === 'wcag22-pour' && entry.conceptId)
        .map((entry) => norm_taxonomy_string(String(entry.conceptId)))
        .filter(Boolean);
    return [...new Set(ids)];
}

export function collect_deficiency_types_grouped_by_principle(
    current_audit: Record<string, unknown>,
    t: (key: string) => string
): DeficiencyTypesByPrinciple[] {
    const concepts = resolve_wcag_principle_concepts(current_audit, t);
    const order = concepts.map((concept) => concept.id);
    const label_by_id = new Map(concepts.map((concept) => [concept.id, concept.label]));
    const groups = new Map<string, Map<string, DeficiencyTypeText>>();

    const add_entry = (principle_id: string, entry: DeficiencyTypeText) => {
        if (!principle_id) return;
        const dedupe_key = `${entry.primary}\0${entry.secondary}`;
        if (!groups.has(principle_id)) groups.set(principle_id, new Map());
        groups.get(principle_id)!.set(dedupe_key, entry);
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
        const principle_ids = get_principle_ids_for_requirement(req_definition as Record<string, unknown>);
        for (const principle_id of principle_ids) {
            add_entry(principle_id, type);
        }
    });

    return order
        .filter((id) => groups.has(id) && (groups.get(id)?.size ?? 0) > 0)
        .map((id) => ({
            principle_id: id,
            label: label_by_id.get(id) || id,
            types: Array.from(groups.get(id)!.values()).sort((a, b) =>
                a.primary.localeCompare(b.primary, 'sv')
            ),
        }));
}
