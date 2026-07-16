/**
 * @fileoverview Bilaga 1-sektioner: schema, defaults, resolve och platshållare.
 */
import { DEFAULT_WCAG_TAXONOMY_ID, resolve_taxonomy_concepts } from '../../shared/classification/taxonomy_grouping.js';
import default_sections_json from '../../shared/report_templates/appendix1_default_sv.json';
import {
    LEGACY_APPENDIX1_SECTION_KEY_ORDER,
    LEGACY_SECTION_CONCEPT_ID,
    migrate_appendix1_sections_object_to_array,
    normalize_section_definition,
    parse_appendix1_sections_raw,
} from './appendix1_sections_migrate.js';
import type {
    Appendix1AuditSlice,
    Appendix1PlaceholderContext,
    Appendix1RulefileSlice,
    Appendix1Section,
    Appendix1SectionDefinition,
    Appendix1SectionKey,
    Appendix1SectionsMap,
    Appendix1TocEntry,
} from './appendix1_sections_types.js';

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

export { normalize_section_definition } from './appendix1_sections_migrate.js';
export {
    LEGACY_SECTION_CONCEPT_ID,
    migrate_appendix1_sections_object_to_array,
} from './appendix1_sections_migrate.js';

/** Legacy nycklar i fast ordning (bakåtkompatibilitet). */
export const APPENDIX1_SECTION_KEYS = LEGACY_APPENDIX1_SECTION_KEY_ORDER;

const DEFAULT_TEMPLATE = default_sections_json as {
    coverImage: string;
    groupingTaxonomyId: string;
    sections: Appendix1SectionDefinition[];
};

/**
 * @deprecated Använd conceptId på sektion (kind deficiency_group) i stället.
 */
export const APPENDIX1_SECTION_PRINCIPLE_ID: Partial<Record<Appendix1SectionKey, string>> =
    LEGACY_SECTION_CONCEPT_ID;

function clone_sections_list(sections: Appendix1SectionDefinition[]): Appendix1SectionDefinition[] {
    return JSON.parse(JSON.stringify(sections)) as Appendix1SectionDefinition[];
}

export function get_default_appendix1_sections_list(): Appendix1SectionDefinition[] {
    return clone_sections_list(DEFAULT_TEMPLATE.sections);
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
        }
    }
    return merged;
}

/** @deprecated Använd get_default_appendix1_sections_list. */
export function get_default_appendix1_sections(): Appendix1SectionsMap {
    return sections_list_to_map(get_default_appendix1_sections_list());
}

export function get_appendix1_section_dom_id(section_id: string): string {
    return `section-${String(section_id).replace(/_/g, '-')}`;
}

function read_sections_from_appendix1(appendix1: unknown): Appendix1SectionDefinition[] {
    if (!appendix1 || typeof appendix1 !== 'object') return [];
    return parse_appendix1_sections_raw((appendix1 as Record<string, unknown>).sections);
}

export function read_rulefile_appendix1_sections_list(
    rule_file_content: Appendix1RulefileSlice | null | undefined
): Appendix1SectionDefinition[] {
    const defaults = get_default_appendix1_sections_list();
    const from_file = read_sections_from_appendix1(rule_file_content?.appendix1);
    if (from_file.length === 0) return defaults;
    return merge_sections_by_id(defaults, from_file);
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

export function resolve_appendix1_sections_list(
    audit: Appendix1AuditSlice | null | undefined
): Appendix1SectionDefinition[] {
    let merged = read_rulefile_appendix1_sections_list(audit?.ruleFileContent ?? undefined);
    if (!audit?.auditMetadata) return merged;

    const meta = audit.auditMetadata;
    if (Object.prototype.hasOwnProperty.call(meta, 'appendix1SectionOverrides')) {
        merged = merge_sections_by_id(merged, read_audit_section_overrides(meta));
    }

    if (Object.prototype.hasOwnProperty.call(meta, 'appendix1SummaryText')) {
        const summary = read_audit_appendix1_summary_text(meta);
        merged = merged.map((section) =>
            section.id === 'introduction'
                ? { ...section, content: summary }
                : section
        );
    }

    return merged;
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

function migrate_summary_text_to_sections(summary_text: string): Appendix1SectionDefinition[] {
    const trimmed = summary_text.trim();
    if (!trimmed) return [];
    const defaults = get_default_appendix1_sections_list();
    const introduction = defaults.find((section) => section.id === 'introduction');
    if (!introduction) return [];
    return [{ ...introduction, content: trimmed }];
}

export function normalize_rulefile_appendix1(
    rule_file_content: Record<string, unknown> | null | undefined
): Record<string, unknown> {
    const base =
        rule_file_content && typeof rule_file_content === 'object' ? { ...rule_file_content } : {};
    const appendix = base.appendix1;
    const appendix_obj =
        appendix && typeof appendix === 'object' && !Array.isArray(appendix)
            ? { ...(appendix as Record<string, unknown>) }
            : {};
    const summary = appendix_obj.summaryText;
    appendix_obj.summaryText = typeof summary === 'string' ? summary : '';

    const parsed_sections = parse_appendix1_sections_raw(appendix_obj.sections);
    const has_sections = parsed_sections.length > 0;
    if (!has_sections && typeof summary === 'string' && summary.trim()) {
        appendix_obj.sections = merge_sections_by_id(
            get_default_appendix1_sections_list(),
            migrate_summary_text_to_sections(summary)
        );
    } else if (!has_sections) {
        appendix_obj.sections = get_default_appendix1_sections_list();
    } else if (Array.isArray(appendix_obj.sections)) {
        appendix_obj.sections = merge_sections_by_id(
            get_default_appendix1_sections_list(),
            parsed_sections
        );
    } else if (appendix_obj.sections && typeof appendix_obj.sections === 'object') {
        appendix_obj.sections = merge_sections_by_id(
            get_default_appendix1_sections_list(),
            migrate_appendix1_sections_object_to_array(appendix_obj.sections as Record<string, unknown>)
        );
    } else {
        appendix_obj.sections = get_default_appendix1_sections_list();
    }

    if (typeof appendix_obj.coverImage !== 'string' || !appendix_obj.coverImage.trim()) {
        appendix_obj.coverImage = 'default';
    }
    if (
        typeof appendix_obj.groupingTaxonomyId !== 'string'
        || !appendix_obj.groupingTaxonomyId.trim()
    ) {
        appendix_obj.groupingTaxonomyId = DEFAULT_WCAG_TAXONOMY_ID;
    }

    base.appendix1 = appendix_obj;
    return base;
}

function format_iso_date(iso: unknown, locale = 'sv-SE'): string {
    if (typeof iso !== 'string' || !iso.trim()) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function extract_domain_from_url(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return '';
    try {
        const with_protocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        return new URL(with_protocol).hostname.replace(/^www\./i, '');
    } catch {
        return trimmed.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./i, '');
    }
}

export function build_appendix1_placeholder_context(
    audit: Appendix1AuditSlice | null | undefined,
    export_date_iso?: string | null
): Appendix1PlaceholderContext {
    const meta = audit?.auditMetadata ?? {};
    const start_iso = audit?.startTime ?? meta.startTime;
    const end_iso = audit?.endTime ?? meta.endTime;
    const actor_link = String(meta.actorLink ?? '').trim();
    const export_iso = export_date_iso ?? new Date().toISOString();

    return {
        caseNumber: String(meta.caseNumber ?? '').trim(),
        actorName: String(meta.actorName ?? '').trim(),
        actorLink: actor_link,
        actorLinkDomain: extract_domain_from_url(actor_link),
        auditorName: String(meta.auditorName ?? '').trim(),
        caseHandler: String(meta.caseHandler ?? '').trim(),
        startDate: format_iso_date(start_iso),
        endDate: format_iso_date(end_iso),
        exportDate: format_iso_date(export_iso),
    };
}

export function apply_appendix1_placeholders(
    text: string,
    context: Appendix1PlaceholderContext
): string {
    return text
        .replaceAll('{{caseNumber}}', context.caseNumber)
        .replaceAll('{{actorName}}', context.actorName)
        .replaceAll('{{actorLink}}', context.actorLink)
        .replaceAll('{{actorLinkDomain}}', context.actorLinkDomain)
        .replaceAll('{{auditorName}}', context.auditorName)
        .replaceAll('{{caseHandler}}', context.caseHandler)
        .replaceAll('{{startDate}}', context.startDate)
        .replaceAll('{{endDate}}', context.endDate)
        .replaceAll('{{exportDate}}', context.exportDate);
}

/** @deprecated Använd section.headingLevel. */
export function get_appendix1_section_heading_level(section_key: Appendix1SectionKey): 1 | 2 {
    const section = get_default_appendix1_sections_list().find((entry) => entry.id === section_key);
    return section?.headingLevel ?? 1;
}

export function build_appendix1_toc_entries(
    sections: Appendix1SectionDefinition[],
    t: (key: string) => string
): Appendix1TocEntry[] {
    const entries: Appendix1TocEntry[] = [
        {
            section_id: 'audit-info',
            title: t('export_appendix1_audit_info_heading'),
            heading_level: 1,
        },
    ];
    for (const section of sections) {
        if (!section.title) continue;
        entries.push({
            section_id: get_appendix1_section_dom_id(section.id),
            title: section.title,
            heading_level: section.headingLevel,
        });
    }
    return entries;
}

export function with_initialized_appendix1_summary_metadata<T extends Appendix1AuditSlice>(
    state: T
): T {
    const meta = state.auditMetadata ?? {};
    const next_meta = { ...meta };
    let changed = false;

    if (!Object.prototype.hasOwnProperty.call(meta, 'appendix1SummaryText')) {
        const legacy = state.ruleFileContent?.appendix1?.summaryText;
        if (typeof legacy === 'string' && legacy.trim()) {
            next_meta.appendix1SummaryText = legacy;
        } else {
            next_meta.appendix1SummaryText =
                read_rulefile_appendix1_sections_list(state.ruleFileContent).find(
                    (section) => section.id === 'introduction'
                )?.content ?? '';
        }
        changed = true;
    }
    if (!Object.prototype.hasOwnProperty.call(meta, 'appendix1SectionOverrides')) {
        next_meta.appendix1SectionOverrides = {};
        changed = true;
    }

    if (!changed) return state;
    return {
        ...state,
        auditMetadata: next_meta,
    };
}

/** @deprecated Använd resolve_appendix1_sections_list och introduction-innehåll. */
export function read_rulefile_appendix1_summary_text(
    rule_file_content: Appendix1RulefileSlice | null | undefined
): string {
    const introduction = read_rulefile_appendix1_sections_list(rule_file_content).find(
        (section) => section.id === 'introduction'
    );
    if (introduction?.content?.trim()) {
        return introduction.content;
    }
    const raw = rule_file_content?.appendix1?.summaryText;
    return typeof raw === 'string' ? raw : '';
}

/** @deprecated Använd appendix1SectionOverrides. */
export function read_audit_appendix1_summary_text(
    audit_metadata: { appendix1SummaryText?: unknown } | null | undefined
): string {
    const raw = audit_metadata?.appendix1SummaryText;
    return typeof raw === 'string' ? raw : '';
}

/** @deprecated Använd resolve_appendix1_sections_list. */
export function resolve_appendix1_summary_text(audit: Appendix1AuditSlice | null | undefined): string {
    if (!audit) return '';
    const meta = audit.auditMetadata;
    if (meta && Object.prototype.hasOwnProperty.call(meta, 'appendix1SummaryText')) {
        return read_audit_appendix1_summary_text(meta);
    }
    return read_rulefile_appendix1_summary_text(audit.ruleFileContent ?? undefined);
}

/** Ersätter deficiency_group-sektioner utifrån vald grupperingstaxonomi. */
export function generate_deficiency_sections_from_taxonomy(
    rule_file_content: Record<string, unknown> | null | undefined,
    t: (key: string) => string
): Appendix1SectionDefinition[] {
    const taxonomy_id = read_rulefile_appendix1_grouping_taxonomy_id(rule_file_content);
    const concepts = resolve_taxonomy_concepts(rule_file_content?.metadata, taxonomy_id, t);
    const existing = read_rulefile_appendix1_sections_list(rule_file_content);
    const without_groups = existing.filter((section) => section.kind !== 'deficiency_group');
    const existing_by_concept = new Map(
        existing
            .filter((section) => section.kind === 'deficiency_group' && section.conceptId)
            .map((section) => [String(section.conceptId).trim().toLowerCase(), section])
    );
    const deficiency_sections = concepts.map((concept, index) => {
        const concept_id = String(concept.id);
        const prior = existing_by_concept.get(concept_id.toLowerCase());
        return {
            id: prior?.id ?? `results_${concept_id}`,
            kind: 'deficiency_group' as const,
            headingLevel: 2 as const,
            conceptId: concept_id,
            title: prior?.title ?? `3.${index + 1} ${concept.label}`,
            content: prior?.content ?? '',
        };
    });
    const intro_index = without_groups.findIndex((section) => section.id === 'results_intro');
    if (intro_index >= 0) {
        return [
            ...without_groups.slice(0, intro_index + 1),
            ...deficiency_sections,
            ...without_groups.slice(intro_index + 1),
        ];
    }
    return [...without_groups, ...deficiency_sections];
}
