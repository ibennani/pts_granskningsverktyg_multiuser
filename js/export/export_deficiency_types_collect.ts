/**
 * @fileoverview Samlar unika bristtyper från granskningen grupperade per taxonomi-begrepp.
 */
import {
    DEFAULT_WCAG_TAXONOMY_ID,
    get_appendix1_grouping_taxonomy_id,
    get_concept_ids_for_requirement,
    resolve_taxonomy_concepts,
} from '../../shared/classification/taxonomy_grouping.js';
import { for_each_failed_pass_criterion } from './export_deficiency_traversal.js';

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

const PRIMARY_TEXT_KEYS = ['PrimaryText', 'primaryText', 'primary'] as const;
const SECONDARY_TEXT_KEYS = ['SecondaryText', 'secondaryText', 'secondary'] as const;

function normalize_concept_id(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

function read_string_field(source: Record<string, unknown>, keys: readonly string[]): string {
    for (const key of keys) {
        const value = source[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
}

/** Läser bristtyp enbart från DeficiencyType-objektet (inte bristbeskrivningsmallar). */
function read_deficiency_text_from_record(record: Record<string, unknown>): DeficiencyTypeText | null {
    const nested = record.DeficiencyType;
    if (!nested || typeof nested !== 'object') return null;
    const primary = read_string_field(nested as Record<string, unknown>, PRIMARY_TEXT_KEYS);
    const secondary = read_string_field(nested as Record<string, unknown>, SECONDARY_TEXT_KEYS);
    if (!primary) return null;
    return { primary, secondary };
}

export function read_deficiency_type_node(node: unknown): DeficiencyTypeText | null {
    if (!node || typeof node !== 'object') return null;
    return read_deficiency_text_from_record(node as Record<string, unknown>);
}

/**
 * Löser bristtypstext för visning på kravnivå från requirement.DeficiencyType.
 * Använder inte failureStatementTemplate eller andra bristbeskrivningsfält.
 */
export function resolve_requirement_deficiency_type_display(
    requirement: Record<string, unknown>
): DeficiencyTypeText | null {
    return read_deficiency_type_node(requirement);
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
        const normalized_id = normalize_concept_id(concept_id);
        if (!normalized_id) return;
        const dedupe_key = `${entry.primary}\0${entry.secondary}`;
        if (!groups.has(normalized_id)) groups.set(normalized_id, new Map());
        groups.get(normalized_id)!.set(dedupe_key, entry);
    };

    for_each_failed_pass_criterion(current_audit, ({ req_definition, pc_obj }) => {
        let type = read_deficiency_type_node(pc_obj);
        if (!type) {
            type = read_deficiency_type_node(req_definition);
        }
        if (!type) return;
        const concept_ids = get_concept_ids_for_requirement(req_definition as Record<string, unknown>, taxonomy_id);
        for (const concept_id of concept_ids) {
            add_entry(concept_id, type);
        }
    });

    return order
        .filter((id) => {
            const normalized_id = normalize_concept_id(id);
            return groups.has(normalized_id) && (groups.get(normalized_id)?.size ?? 0) > 0;
        })
        .map((id) => {
            const normalized_id = normalize_concept_id(id);
            return {
                concept_id: id,
                label: label_by_id.get(id) || id,
                types: Array.from(groups.get(normalized_id)!.values()).sort((a, b) =>
                    a.primary.localeCompare(b.primary, 'sv')
                ),
            };
        });
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
