/**
 * @fileoverview Taxonomival och tillstånd för kravkopplingsmatrisen.
 */
import { normalize_requirements_to_record } from '../../logic/requirement_lookup.js';
import {
    apply_requirement_classifications,
    get_concept_ids_for_requirement,
    get_primary_grouping_taxonomy_id,
    resolve_taxonomy_concepts,
} from '../../logic/requirement_classifications.js';
import { resolve_taxonomies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import { build_mapping_checkbox_key } from './rulefile_requirement_mapping_keys.js';
import type {
    ConceptEntry,
    MappingCtx,
    RequirementRow,
    TaxonomyRow,
} from './rulefile_requirement_mapping_types.js';

export function read_taxonomy_rows(metadata: Record<string, unknown>): TaxonomyRow[] {
    return resolve_taxonomies(metadata) as TaxonomyRow[];
}

export function resolve_default_taxonomy_id(
    taxonomies: TaxonomyRow[],
    rule_file_content: Record<string, unknown>
): string {
    const primary_id = get_primary_grouping_taxonomy_id(rule_file_content);
    const ids = taxonomies
        .map((taxonomy) => String(taxonomy.id ?? '').trim())
        .filter(Boolean);
    if (ids.includes(primary_id)) return primary_id;
    return ids[0] ?? primary_id;
}

export function build_initial_checkbox_state(
    rows: RequirementRow[],
    concepts: ConceptEntry[],
    taxonomy_id: string
): Map<string, boolean> {
    const state = new Map<string, boolean>();
    rows.forEach((row) => {
        const selected = new Set(get_concept_ids_for_requirement(row.requirement, taxonomy_id));
        concepts.forEach((concept) => {
            const map_key = build_mapping_checkbox_key(row.key, concept.id);
            state.set(map_key, selected.has(String(concept.id).trim().toLowerCase()));
        });
    });
    return state;
}

export function build_all_taxonomy_states(
    rows: RequirementRow[],
    metadata: Record<string, unknown>,
    taxonomies: TaxonomyRow[],
    t: (key: string, opts?: Record<string, unknown>) => string
): Map<string, Map<string, boolean>> {
    const states = new Map<string, Map<string, boolean>>();
    taxonomies.forEach((taxonomy) => {
        const taxonomy_id = String(taxonomy.id ?? '').trim();
        if (!taxonomy_id) return;
        const concepts = resolve_taxonomy_concepts(metadata, taxonomy_id, t) as ConceptEntry[];
        if (concepts.length === 0) return;
        states.set(taxonomy_id, build_initial_checkbox_state(rows, concepts, taxonomy_id));
    });
    return states;
}

export function build_taxonomy_select_field(
    ctx: MappingCtx,
    taxonomies: TaxonomyRow[],
    selected_id: string
): { field: HTMLElement; select: HTMLSelectElement } {
    const { Helpers, Translation } = ctx;
    const select_id = `requirement-mapping-taxonomy-${Math.random().toString(36).substring(2, 8)}`;
    const field = Helpers.create_element('div', {
        class_name: ['form-group', 'requirement-mapping-taxonomy-field'],
    });
    field.appendChild(
        Helpers.create_element('label', {
            attributes: { for: select_id },
            text_content: Translation.t('rulefile_classifications_mapping_taxonomy_label'),
        })
    );
    const select = Helpers.create_element('select', {
        class_name: ['form-control', 'dropdown-select'],
        attributes: { id: select_id },
    }) as HTMLSelectElement;
    taxonomies.forEach((taxonomy) => {
        const taxonomy_id = String(taxonomy.id ?? '').trim();
        if (!taxonomy_id) return;
        select.appendChild(
            Helpers.create_element('option', {
                attributes: { value: taxonomy_id },
                text_content: taxonomy.label || taxonomy_id,
            })
        );
    });
    select.value = selected_id;
    field.appendChild(select);
    return { field, select };
}

export function apply_all_taxonomy_states(
    rule_file_content: Record<string, unknown>,
    metadata: Record<string, unknown>,
    taxonomy_states: Map<string, Map<string, boolean>>,
    t: (key: string, opts?: Record<string, unknown>) => string
): Record<string, unknown> {
    const updated = { ...rule_file_content };
    const req_record = normalize_requirements_to_record(updated.requirements);
    for (const [req_key, requirement] of Object.entries(req_record)) {
        let next_requirement = requirement;
        for (const [taxonomy_id, checkbox_state] of taxonomy_states) {
            const concepts = resolve_taxonomy_concepts(metadata, taxonomy_id, t) as ConceptEntry[];
            const concept_ids = concepts
                .filter((concept) => checkbox_state.get(build_mapping_checkbox_key(req_key, concept.id)))
                .map((concept) => concept.id);
            next_requirement = apply_requirement_classifications(
                next_requirement,
                taxonomy_id,
                concept_ids
            );
        }
        req_record[req_key] = next_requirement;
    }
    updated.requirements = req_record;
    return updated;
}
