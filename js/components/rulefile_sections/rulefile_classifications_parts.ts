/**
 * @fileoverview Delparametrar (part) för Klassificeringar-hubben i regelfilsredigering.
 */

export const CLASSIFICATION_PARTS = [
    'deficiency_types',
    'audit_types',
    'taxonomy',
    'mapping',
] as const;

export type ClassificationPartId = (typeof CLASSIFICATION_PARTS)[number];

/** Delar som öppnas direkt i redigeringsläge utan mellanliggande visningsvy. */
export const CLASSIFICATION_PARTS_DIRECT_TO_EDIT = [
    'deficiency_types',
    'audit_types',
    'mapping',
] as const satisfies readonly ClassificationPartId[];

export function classification_part_opens_directly_in_edit(part: ClassificationPartId): boolean {
    return (CLASSIFICATION_PARTS_DIRECT_TO_EDIT as readonly string[]).includes(part);
}

const PART_TITLE_KEYS: Record<ClassificationPartId, string> = {
    deficiency_types: 'rulefile_classifications_hub_deficiency_types_title',
    audit_types: 'rulefile_classifications_hub_audit_types_title',
    taxonomy: 'rulefile_classifications_hub_taxonomy_title',
    mapping: 'rulefile_classifications_hub_mapping_title',
};

const PART_DESC_KEYS: Record<ClassificationPartId, string> = {
    deficiency_types: 'rulefile_classifications_hub_deficiency_types_desc',
    audit_types: 'rulefile_classifications_hub_audit_types_desc',
    taxonomy: 'rulefile_classifications_hub_taxonomy_desc',
    mapping: 'rulefile_classifications_hub_mapping_desc',
};

const PART_EDIT_ARIA_KEYS: Record<ClassificationPartId, string> = {
    deficiency_types: 'rulefile_classifications_edit_deficiency_types_aria',
    audit_types: 'rulefile_classifications_edit_audit_types_aria',
    taxonomy: 'rulefile_classifications_edit_taxonomy_aria',
    mapping: 'rulefile_classifications_edit_mapping_aria',
};

/** Normaliserar part från router-param. */
export function normalize_classification_part_param(value: unknown): ClassificationPartId | '' {
    const raw = String(value ?? '').trim();
    if ((CLASSIFICATION_PARTS as readonly string[]).includes(raw)) {
        return raw as ClassificationPartId;
    }
    return '';
}

export function get_classification_part_title_key(part: ClassificationPartId): string {
    return PART_TITLE_KEYS[part];
}

export function get_classification_part_desc_key(part: ClassificationPartId): string {
    return PART_DESC_KEYS[part];
}

export function get_classification_part_edit_aria_key(part: ClassificationPartId): string {
    return PART_EDIT_ARIA_KEYS[part];
}
