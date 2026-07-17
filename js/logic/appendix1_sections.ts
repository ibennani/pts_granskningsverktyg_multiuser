/**
 * @fileoverview Bilaga 1-sektioner: schema, defaults, resolve och platshållare.
 */
import { DEFAULT_WCAG_TAXONOMY_ID, resolve_taxonomy_concepts } from '../../shared/classification/taxonomy_grouping.js';
import {
    combine_content_sections_to_body_text,
    parse_body_text_to_content_sections,
    read_appendix1_body_text_by_taxonomy_from_appendix1,
    read_appendix1_body_text_from_appendix1,
    replace_introduction_in_body_text,
    sanitize_appendix1_body_text,
} from './appendix1_body_text.js';
import {
    apply_resolved_principle_intros_to_sections,
    resolve_principle_intro_content,
    strip_deficiency_section_content,
} from './appendix1_principle_intro.js';
import {
    APPENDIX1_SECTION_KEYS,
    get_default_appendix1_body_text,
    get_default_appendix1_sections,
    get_default_appendix1_sections_list,
} from './appendix1_sections_defaults.js';
import {
    LEGACY_SECTION_CONCEPT_ID,
    dedupe_appendix1_sections_by_id,
    migrate_appendix1_sections_object_to_array,
    normalize_section_definition,
    parse_appendix1_sections_raw,
} from './appendix1_sections_migrate.js';
import { normalize_rulefile_appendix1 } from './appendix1_sections_normalize.js';
import { read_audit_appendix1_summary_text } from './appendix1_summary_legacy.js';
import {
    Appendix1AuditSlice,
    Appendix1PlaceholderContext,
    Appendix1RulefileSlice,
    Appendix1Section,
    Appendix1SectionDefinition,
    Appendix1SectionKey,
    Appendix1SectionsMap,
    Appendix1TocEntry,
} from './appendix1_sections_types.js';

export {
    combine_content_sections_to_body_text,
    parse_body_text_to_content_sections,
    replace_introduction_in_body_text,
    sanitize_appendix1_body_text,
} from './appendix1_body_text.js';

export type {
    Appendix1AuditSlice,
    Appendix1PlaceholderContext,
    Appendix1RulefileSlice,
    Appendix1Section,
    Appendix1SectionDefinition,
    Appendix1SectionKey,
    Appendix1SectionsMap,
    Appendix1TocEntry,
} from './appendix1_sections_types.js';

export {
    APPENDIX1_SECTION_KEYS,
    get_default_appendix1_body_text,
    get_default_appendix1_sections,
    get_default_appendix1_sections_list,
} from './appendix1_sections_defaults.js';

export { normalize_section_definition, dedupe_appendix1_sections_by_id } from './appendix1_sections_migrate.js';
export {
    LEGACY_SECTION_CONCEPT_ID,
    migrate_appendix1_sections_object_to_array,
} from './appendix1_sections_migrate.js';

export { normalize_rulefile_appendix1 } from './appendix1_sections_normalize.js';

export {
    read_concept_appendix1_intro,
    read_audit_principle_intro_overrides,
    resolve_principle_intro_content,
} from './appendix1_principle_intro.js';

/**
 * @deprecated Använd conceptId på sektion (kind deficiency_group) i stället.
 */
export const APPENDIX1_SECTION_PRINCIPLE_ID: Partial<Record<Appendix1SectionKey, string>> =
    LEGACY_SECTION_CONCEPT_ID;

function is_deficiency_section(section: Appendix1SectionDefinition): boolean {
    return section.kind === 'deficiency_group' || Boolean(LEGACY_SECTION_CONCEPT_ID[section.id]);
}

function filter_deficiency_sections(sections: Appendix1SectionDefinition[]): Appendix1SectionDefinition[] {
    return sections.filter(is_deficiency_section);
}

function merge_deficiency_sections_by_id(
    base: Appendix1SectionDefinition[],
    overrides: Appendix1SectionDefinition[]
): Appendix1SectionDefinition[] {
    const deficiency_overrides = filter_deficiency_sections(overrides);
    const override_by_id = new Map(deficiency_overrides.map((section) => [section.id, section]));
    const seen = new Set<string>();
    const merged = base.map((section) => {
        seen.add(section.id);
        const override = override_by_id.get(section.id);
        const merged_section = override ? { ...section, ...override, id: section.id } : section;
        return { ...merged_section, content: '' };
    });
    for (const section of deficiency_overrides) {
        if (!seen.has(section.id)) {
            merged.push({ ...section, content: '' });
            seen.add(section.id);
        }
    }
    return dedupe_appendix1_sections_by_id(merged).filter(is_deficiency_section);
}

function build_content_sections_from_body_text(
    body_text: string,
    default_sections: Appendix1SectionDefinition[]
): Appendix1SectionDefinition[] {
    const parsed = parse_body_text_to_content_sections(body_text, default_sections);
    if (parsed.length > 0) return parsed;
    return default_sections.filter((section) => section.kind !== 'deficiency_group');
}

function definition_to_legacy_section(definition: Appendix1SectionDefinition): Appendix1Section {
    return {
        title: definition.title,
        content: definition.content,
        format: definition.format,
    };
}

function sections_list_to_map(sections: Appendix1SectionDefinition[]): Appendix1SectionsMap {
    const merged = merge_sections_by_id(get_default_appendix1_sections_list(), sections);
    const result = {} as Appendix1SectionsMap;
    for (const key of APPENDIX1_SECTION_KEYS) {
        const section = merged.find((entry) => entry.id === key);
        if (section) {
            result[key] = definition_to_legacy_section(section);
        }
    }
    return result;
}

function merge_sections_by_id(
    base: Appendix1SectionDefinition[],
    overrides: Appendix1SectionDefinition[]
): Appendix1SectionDefinition[] {
    const override_by_id = new Map(overrides.map((section) => [section.id, section]));
    const seen = new Set<string>();
    const merged = base.map((section) => {
        seen.add(section.id);
        const override = override_by_id.get(section.id);
        return override ? { ...section, ...override, id: section.id } : section;
    });
    for (const section of overrides) {
        if (!seen.has(section.id)) {
            merged.push(section);
            seen.add(section.id);
        }
    }
    return dedupe_appendix1_sections_by_id(merged);
}

function read_sections_from_appendix1(appendix1: unknown): Appendix1SectionDefinition[] {
    if (!appendix1 || typeof appendix1 !== 'object') return [];
    return parse_appendix1_sections_raw((appendix1 as Record<string, unknown>).sections);
}

export function read_rulefile_appendix1_body_text(
    rule_file_content: Appendix1RulefileSlice | null | undefined,
    taxonomy_id?: string
): string {
    const defaults = get_default_appendix1_sections_list();
    const from_file = read_sections_from_appendix1(rule_file_content?.appendix1);
    const resolved_taxonomy_id =
        String(taxonomy_id ?? read_rulefile_appendix1_grouping_taxonomy_id(rule_file_content)).trim();
    const body_text = read_appendix1_body_text_from_appendix1(
        rule_file_content?.appendix1,
        get_default_appendix1_body_text(),
        from_file.length > 0 ? from_file : defaults,
        resolved_taxonomy_id
    );
    return sanitize_appendix1_body_text(body_text, defaults);
}

export function read_rulefile_appendix1_body_text_by_taxonomy(
    rule_file_content: Appendix1RulefileSlice | null | undefined,
    taxonomy_ids: string[] = []
): Record<string, string> {
    const defaults = get_default_appendix1_sections_list();
    const from_file = read_sections_from_appendix1(rule_file_content?.appendix1);
    const fallback = read_rulefile_appendix1_body_text(rule_file_content);
    const by_taxonomy = read_appendix1_body_text_by_taxonomy_from_appendix1(
        rule_file_content?.appendix1,
        fallback || get_default_appendix1_body_text(),
        from_file.length > 0 ? from_file : defaults,
        taxonomy_ids
    );
    const sanitized: Record<string, string> = {};
    for (const [taxonomy_id, body_text] of Object.entries(by_taxonomy)) {
        sanitized[taxonomy_id] = sanitize_appendix1_body_text(body_text, defaults);
    }
    return sanitized;
}

function read_rulefile_deficiency_sections_list(
    rule_file_content: Appendix1RulefileSlice | null | undefined
): Appendix1SectionDefinition[] {
    const default_groups = get_default_appendix1_sections_list().filter(is_deficiency_section);
    const from_file = filter_deficiency_sections(read_sections_from_appendix1(rule_file_content?.appendix1));
    if (from_file.length === 0) return strip_deficiency_section_content(default_groups);
    return merge_deficiency_sections_by_id(default_groups, from_file);
}

export function read_rulefile_appendix1_sections_list(
    rule_file_content: Appendix1RulefileSlice | null | undefined
): Appendix1SectionDefinition[] {
    const defaults = get_default_appendix1_sections_list();
    const content_sections = build_content_sections_from_body_text(
        read_rulefile_appendix1_body_text(rule_file_content),
        defaults
    );
    const taxonomy_id = read_rulefile_appendix1_grouping_taxonomy_id(rule_file_content);
    const deficiency_sections = apply_resolved_principle_intros_to_sections(
        read_rulefile_deficiency_sections_list(rule_file_content),
        null,
        rule_file_content as Record<string, unknown> | null | undefined,
        taxonomy_id
    );
    return dedupe_appendix1_sections_by_id([...content_sections, ...deficiency_sections]);
}

/** Slår ihop brödtext och bristgrupper till den sektionslista som ska sparas i regelfilen. */
export function build_rulefile_appendix1_persisted_sections(
    body_text: string,
    deficiency_sections: Appendix1SectionDefinition[]
): Appendix1SectionDefinition[] {
    const defaults = get_default_appendix1_sections_list();
    const content_sections = build_content_sections_from_body_text(body_text, defaults);
    const stripped_deficiency = strip_deficiency_section_content(deficiency_sections);
    return dedupe_appendix1_sections_by_id([...content_sections, ...stripped_deficiency]);
}

/** @deprecated Använd read_rulefile_appendix1_sections_list. */
export function read_rulefile_appendix1_sections(
    rule_file_content: Appendix1RulefileSlice | null | undefined
): Appendix1SectionsMap {
    return sections_list_to_map(read_rulefile_appendix1_sections_list(rule_file_content));
}

function read_audit_section_overrides(
    audit_metadata: { appendix1SectionOverrides?: unknown } | null | undefined
): Appendix1SectionDefinition[] {
    if (!audit_metadata?.appendix1SectionOverrides) return [];
    return read_sections_from_appendix1({ sections: audit_metadata.appendix1SectionOverrides });
}

export function resolve_appendix1_body_text(
    audit: Appendix1AuditSlice | null | undefined
): string {
    const taxonomy_id = read_rulefile_appendix1_grouping_taxonomy_id(audit?.ruleFileContent ?? undefined);
    let body_text = read_rulefile_appendix1_body_text(audit?.ruleFileContent ?? undefined, taxonomy_id);
    const defaults = get_default_appendix1_sections_list();

    if (audit?.auditMetadata && Object.prototype.hasOwnProperty.call(audit.auditMetadata, 'appendix1SummaryText')) {
        body_text = replace_introduction_in_body_text(
            body_text,
            read_audit_appendix1_summary_text(audit.auditMetadata),
            defaults
        );
    }

    return body_text;
}

export function resolve_appendix1_sections_list(
    audit: Appendix1AuditSlice | null | undefined
): Appendix1SectionDefinition[] {
    const defaults = get_default_appendix1_sections_list();
    let content_sections = build_content_sections_from_body_text(
        resolve_appendix1_body_text(audit),
        defaults
    );
    const taxonomy_id = read_rulefile_appendix1_grouping_taxonomy_id(audit?.ruleFileContent ?? undefined);
    let deficiency_sections = read_rulefile_deficiency_sections_list(audit?.ruleFileContent ?? undefined);

    if (audit?.auditMetadata && Object.prototype.hasOwnProperty.call(audit.auditMetadata, 'appendix1SectionOverrides')) {
        const overrides = read_audit_section_overrides(audit.auditMetadata);
        const content_overrides = overrides.filter((section) => !is_deficiency_section(section));
        if (content_overrides.length > 0) {
            content_sections = merge_sections_by_id(content_sections, content_overrides);
        }
        deficiency_sections = merge_deficiency_sections_by_id(deficiency_sections, overrides);
    }

    deficiency_sections = apply_resolved_principle_intros_to_sections(
        deficiency_sections,
        audit,
        audit?.ruleFileContent as Record<string, unknown> | null | undefined,
        taxonomy_id
    );

    return dedupe_appendix1_sections_by_id([...content_sections, ...deficiency_sections]);
}

/** @deprecated Använd resolve_appendix1_sections_list. */
export function resolve_appendix1_sections(
    audit: Appendix1AuditSlice | null | undefined
): Appendix1SectionsMap {
    return sections_list_to_map(resolve_appendix1_sections_list(audit));
}

export function read_rulefile_appendix1_cover_image(
    rule_file_content: Appendix1RulefileSlice | null | undefined
): string {
    const raw = rule_file_content?.appendix1?.coverImage;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : 'default';
}

export function read_rulefile_appendix1_grouping_taxonomy_id(
    rule_file_content: Appendix1RulefileSlice | null | undefined
): string {
    const raw = rule_file_content?.appendix1?.groupingTaxonomyId;
    if (typeof raw === 'string' && raw.trim()) {
        return raw.trim();
    }
    return DEFAULT_WCAG_TAXONOMY_ID;
}

export {
    apply_appendix1_placeholders,
    build_appendix1_placeholder_context,
    build_appendix1_toc_entries,
    format_appendix1_placeholder_token,
    get_appendix1_section_bookmark_id,
    get_appendix1_section_dom_id,
    get_appendix1_section_heading_level,
    strip_leading_duplicate_appendix1_heading,
} from './appendix1_sections_export.js';

export {
    with_initialized_appendix1_summary_metadata,
    read_rulefile_appendix1_summary_text,
    read_audit_appendix1_summary_text,
    resolve_appendix1_summary_text,
} from './appendix1_summary_legacy.js';

/** Ersätter deficiency_group-sektioner utifrån vald grupperingstaxonomi. */
export function generate_deficiency_sections_from_taxonomy(
    rule_file_content: Record<string, unknown> | null | undefined,
    t: (key: string) => string
): Appendix1SectionDefinition[] {
    const taxonomy_id = read_rulefile_appendix1_grouping_taxonomy_id(rule_file_content);
    const concepts = resolve_taxonomy_concepts(rule_file_content?.metadata, taxonomy_id, t);
    const existing = dedupe_appendix1_sections_by_id(
        read_rulefile_deficiency_sections_list(rule_file_content as Appendix1RulefileSlice)
    );
    const existing_by_concept = new Map(
        existing
            .filter((section) => section.kind === 'deficiency_group' && section.conceptId)
            .map((section) => [String(section.conceptId).trim().toLowerCase(), section])
    );
    return concepts.map((concept, index) => {
        const concept_id = String(concept.id);
        const prior = existing_by_concept.get(concept_id.toLowerCase());
        return {
            id: prior?.id ?? `results_${concept_id}`,
            kind: 'deficiency_group' as const,
            headingLevel: 2 as const,
            conceptId: concept_id,
            title: prior?.title ?? `3.${index + 1} ${concept.label}`,
            content: resolve_principle_intro_content(null, rule_file_content, taxonomy_id, concept_id),
        };
    });
}
