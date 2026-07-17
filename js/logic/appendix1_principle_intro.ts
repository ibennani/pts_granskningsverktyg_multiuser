/**
 * @fileoverview Bilaga 1 introduktionstexter per princip (taxonomibegrepp) och granskningsöverstyrningar.
 */
import {
    DEFAULT_WCAG_TAXONOMY_ID,
    resolve_taxonomy_by_id,
} from '../../shared/classification/taxonomy_grouping.js';
import default_sections_json from '../../shared/report_templates/appendix1_default_sv.json';
import type { Appendix1AuditSlice, Appendix1SectionDefinition } from './appendix1_sections_types.js';
import { parse_appendix1_sections_raw } from './appendix1_sections_migrate.js';

export type Appendix1PrincipleIntroOverrides = Record<string, string>;

type TaxonomyConceptRaw = {
    id?: string;
    label?: string;
    appendix1Intro?: string;
};

type TaxonomyRaw = {
    id?: string;
    concepts?: TaxonomyConceptRaw[];
};

function norm_id(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

function read_default_concept_intros(): Map<string, string> {
    const template = default_sections_json as { sections?: Appendix1SectionDefinition[] };
    const sections = Array.isArray(template.sections) ? template.sections : [];
    const result = new Map<string, string>();
    for (const section of sections) {
        if (section.kind !== 'deficiency_group' || !section.conceptId) continue;
        const content = typeof section.content === 'string' ? section.content : '';
        if (content.trim()) {
            result.set(norm_id(section.conceptId), content);
        }
    }
    return result;
}

const DEFAULT_CONCEPT_INTROS = read_default_concept_intros();

export function read_concept_appendix1_intro(
    metadata: unknown,
    taxonomy_id: string,
    concept_id: string
): string {
    const taxonomy = resolve_taxonomy_by_id(metadata, taxonomy_id) as TaxonomyRaw | null;
    const normalized_concept_id = norm_id(concept_id);
    const concepts = Array.isArray(taxonomy?.concepts) ? taxonomy.concepts : [];
    const match = concepts.find((concept) => norm_id(concept.id) === normalized_concept_id);
    if (typeof match?.appendix1Intro === 'string') {
        return match.appendix1Intro;
    }
    return DEFAULT_CONCEPT_INTROS.get(normalized_concept_id) ?? '';
}

export function read_audit_principle_intro_overrides(
    audit_metadata: { appendix1PrincipleIntroOverrides?: unknown } | null | undefined
): Appendix1PrincipleIntroOverrides {
    const raw = audit_metadata?.appendix1PrincipleIntroOverrides;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {};
    }
    const result: Appendix1PrincipleIntroOverrides = {};
    for (const [concept_id, value] of Object.entries(raw as Record<string, unknown>)) {
        const id = String(concept_id ?? '').trim();
        if (!id || typeof value !== 'string') continue;
        result[id] = value;
    }
    return result;
}

function read_legacy_deficiency_section_intro_override(
    audit_metadata: Appendix1AuditSlice['auditMetadata'] | null | undefined,
    concept_id: string
): string | undefined {
    const overrides_raw = audit_metadata?.appendix1SectionOverrides;
    if (!overrides_raw || typeof overrides_raw !== 'object') return undefined;
    const sections = parse_appendix1_sections_raw(
        Array.isArray(overrides_raw)
            ? overrides_raw
            : Object.entries(overrides_raw as Record<string, unknown>).map(([id, entry]) => {
                  if (!entry || typeof entry !== 'object') return null;
                  return { ...(entry as Record<string, unknown>), id };
              })
    );
    const match = sections.find(
        (section) =>
            section.kind === 'deficiency_group'
            && norm_id(section.conceptId) === norm_id(concept_id)
    );
    if (!match || typeof match.content !== 'string') return undefined;
    return match.content;
}

export function resolve_principle_intro_content(
    audit: Appendix1AuditSlice | null | undefined,
    rule_file_content: Record<string, unknown> | null | undefined,
    taxonomy_id: string,
    concept_id: string
): string {
    const overrides = read_audit_principle_intro_overrides(audit?.auditMetadata);
    if (Object.prototype.hasOwnProperty.call(overrides, concept_id)) {
        return overrides[concept_id] ?? '';
    }

    const legacy = read_legacy_deficiency_section_intro_override(audit?.auditMetadata, concept_id);
    if (legacy !== undefined) {
        return legacy;
    }

    return read_concept_appendix1_intro(rule_file_content?.metadata, taxonomy_id, concept_id);
}

export function apply_resolved_principle_intros_to_sections(
    sections: Appendix1SectionDefinition[],
    audit: Appendix1AuditSlice | null | undefined,
    rule_file_content: Record<string, unknown> | null | undefined,
    taxonomy_id: string
): Appendix1SectionDefinition[] {
    return sections.map((section) => {
        if (section.kind !== 'deficiency_group' || !section.conceptId) {
            return section;
        }
        return {
            ...section,
            content: resolve_principle_intro_content(
                audit,
                rule_file_content,
                taxonomy_id,
                section.conceptId
            ),
        };
    });
}

export function strip_deficiency_section_content(
    sections: Appendix1SectionDefinition[]
): Appendix1SectionDefinition[] {
    return sections.map((section) => {
        if (section.kind !== 'deficiency_group') return section;
        return { ...section, content: '' };
    });
}

function ensure_taxonomies_array(
    metadata: Record<string, unknown>
): TaxonomyRaw[] {
    if (!Array.isArray(metadata.taxonomies)) {
        metadata.taxonomies = [];
    }
    return metadata.taxonomies as TaxonomyRaw[];
}

function find_or_create_taxonomy(
    taxonomies: TaxonomyRaw[],
    taxonomy_id: string
): TaxonomyRaw {
    const normalized_id = norm_id(taxonomy_id);
    let taxonomy = taxonomies.find((entry) => norm_id(entry.id) === normalized_id);
    if (!taxonomy) {
        taxonomy = { id: taxonomy_id, concepts: [] };
        taxonomies.push(taxonomy);
    }
    if (!Array.isArray(taxonomy.concepts)) {
        taxonomy.concepts = [];
    }
    return taxonomy;
}

function set_concept_appendix1_intro(
    taxonomy: TaxonomyRaw,
    concept_id: string,
    intro: string
): void {
    const normalized_concept_id = norm_id(concept_id);
    const concepts = taxonomy.concepts ?? [];
    let concept = concepts.find((entry) => norm_id(entry.id) === normalized_concept_id);
    if (!concept) {
        concept = { id: concept_id, label: concept_id };
        concepts.push(concept);
    }
    concept.appendix1Intro = intro;
    taxonomy.concepts = concepts;
}

/**
 * Migrerar deficiency_group-innehåll från appendix1.sections till metadata.taxonomies[].concepts[].appendix1Intro.
 */
function read_stored_concept_appendix1_intro(
    metadata: unknown,
    taxonomy_id: string,
    concept_id: string
): string {
    const taxonomy = resolve_taxonomy_by_id(metadata, taxonomy_id) as TaxonomyRaw | null;
    const normalized_concept_id = norm_id(concept_id);
    const concepts = Array.isArray(taxonomy?.concepts) ? taxonomy.concepts : [];
    const match = concepts.find((concept) => norm_id(concept.id) === normalized_concept_id);
    return typeof match?.appendix1Intro === 'string' ? match.appendix1Intro : '';
}

export function migrate_deficiency_intro_content_to_taxonomy(
    rule_file_content: Record<string, unknown>,
    deficiency_sections: Appendix1SectionDefinition[],
    grouping_taxonomy_id: string
): void {
    const metadata =
        rule_file_content.metadata && typeof rule_file_content.metadata === 'object'
            ? (rule_file_content.metadata as Record<string, unknown>)
            : {};
    rule_file_content.metadata = metadata;

    const taxonomies = ensure_taxonomies_array(metadata);
    const taxonomy = find_or_create_taxonomy(taxonomies, grouping_taxonomy_id);

    for (const section of deficiency_sections) {
        if (section.kind !== 'deficiency_group' || !section.conceptId) continue;
        const content = typeof section.content === 'string' ? section.content.trim() : '';
        if (!content) continue;
        const existing = read_stored_concept_appendix1_intro(
            metadata,
            grouping_taxonomy_id,
            section.conceptId
        );
        if (!existing.trim()) {
            set_concept_appendix1_intro(taxonomy, section.conceptId, section.content);
        }
    }

    for (const [concept_id, intro] of DEFAULT_CONCEPT_INTROS.entries()) {
        const existing = read_stored_concept_appendix1_intro(metadata, grouping_taxonomy_id, concept_id);
        if (!existing.trim()) {
            set_concept_appendix1_intro(taxonomy, concept_id, intro);
        }
    }

    if (!String(taxonomy.id ?? '').trim()) {
        taxonomy.id = grouping_taxonomy_id || DEFAULT_WCAG_TAXONOMY_ID;
    }
}

export function merge_concept_intros_into_metadata(
    rule_file_content: Record<string, unknown>,
    taxonomy_id: string,
    concept_intros: Record<string, string>
): void {
    const trimmed_taxonomy_id = taxonomy_id.trim();
    if (!trimmed_taxonomy_id) return;

    const metadata =
        rule_file_content.metadata && typeof rule_file_content.metadata === 'object'
            ? (rule_file_content.metadata as Record<string, unknown>)
            : {};
    rule_file_content.metadata = metadata;

    const taxonomies = ensure_taxonomies_array(metadata);
    const taxonomy = find_or_create_taxonomy(taxonomies, trimmed_taxonomy_id);

    for (const [concept_id, intro] of Object.entries(concept_intros)) {
        const id = String(concept_id ?? '').trim();
        if (!id) continue;
        set_concept_appendix1_intro(taxonomy, id, typeof intro === 'string' ? intro : '');
    }
}
