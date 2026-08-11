/**
 * @fileoverview Data för Bilaga 1 visningsläge: taxonomirubriker, inledningar och bristtyper.
 */
import {
    collect_deficiency_types_grouped_by_taxonomy,
    type DeficiencyTypeText,
} from '../export/export_deficiency_types_collect.js';
import {
    generate_deficiency_sections_from_taxonomy,
    read_rulefile_appendix1_grouping_taxonomy_id,
    resolve_audit_grouping_taxonomy_id,
} from './appendix1_sections.js';
import type { Appendix1SectionDefinition } from './appendix1_sections_types.js';
import { apply_resolved_principle_intros_to_sections } from './appendix1_principle_intro.js';

export type Appendix1DeficiencyViewData = {
    deficiency_sections: Appendix1SectionDefinition[];
    deficiency_types_by_concept: Map<string, DeficiencyTypeText[]>;
};

function build_deficiency_types_map(
    audit: Record<string, unknown>,
    taxonomy_id: string,
    t: (key: string) => string
): Map<string, DeficiencyTypeText[]> {
    const groups = collect_deficiency_types_grouped_by_taxonomy(audit, taxonomy_id, t);
    return new Map(groups.map((group) => [group.concept_id, group.types]));
}

/**
 * Löser 3.x-sektioner och bristtyper för granskningens översikt.
 */
export function resolve_appendix1_deficiency_view_data_for_audit(
    audit: Record<string, unknown>,
    t: (key: string) => string
): Appendix1DeficiencyViewData {
    const rule_file = (audit.ruleFileContent as Record<string, unknown>) || {};
    const taxonomy_id = resolve_audit_grouping_taxonomy_id(audit);
    const rule_file_with_taxonomy = {
        ...rule_file,
        appendix1: {
            ...(rule_file.appendix1 as Record<string, unknown> | undefined),
            groupingTaxonomyId: taxonomy_id,
        },
    };
    const sections = generate_deficiency_sections_from_taxonomy(rule_file_with_taxonomy, t);
    return {
        deficiency_sections: apply_resolved_principle_intros_to_sections(
            sections,
            audit,
            rule_file,
            taxonomy_id
        ),
        deficiency_types_by_concept: build_deficiency_types_map(audit, taxonomy_id, t),
    };
}

/**
 * Löser 3.x-sektioner för regelfilöversikt utan granskningsspecifika bristtyper.
 */
export function resolve_appendix1_deficiency_view_data_for_rulefile(
    rule_file: Record<string, unknown>,
    t: (key: string) => string
): Appendix1DeficiencyViewData {
    const taxonomy_id = read_rulefile_appendix1_grouping_taxonomy_id(rule_file);
    const sections = generate_deficiency_sections_from_taxonomy(rule_file, t);
    return {
        deficiency_sections: apply_resolved_principle_intros_to_sections(
            sections,
            null,
            rule_file,
            taxonomy_id
        ),
        deficiency_types_by_concept: new Map(),
    };
}
