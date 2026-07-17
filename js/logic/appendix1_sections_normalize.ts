/**
 * @fileoverview Normalisering och migrering av appendix1 i regelfiler.
 */
import { DEFAULT_WCAG_TAXONOMY_ID } from '../../shared/classification/taxonomy_grouping.js';
import {
    combine_content_sections_to_body_text,
    read_appendix1_body_text_by_taxonomy_from_appendix1,
    read_appendix1_body_text_from_appendix1,
    replace_introduction_in_body_text,
    sanitize_appendix1_body_text,
} from './appendix1_body_text.js';
import {
    migrate_deficiency_intro_content_to_taxonomy,
    strip_deficiency_section_content,
} from './appendix1_principle_intro.js';
import {
    dedupe_appendix1_sections_by_id,
    migrate_appendix1_sections_object_to_array,
    parse_appendix1_sections_raw,
} from './appendix1_sections_migrate.js';
import type { Appendix1SectionDefinition } from './appendix1_sections_types.js';
import {
    get_default_appendix1_body_text,
    get_default_appendix1_sections_list,
} from './appendix1_sections_defaults.js';

function is_deficiency_section(section: Appendix1SectionDefinition): boolean {
    return section.kind === 'deficiency_group';
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
        if (!override) return { ...section, content: '' };
        return {
            ...section,
            ...override,
            id: section.id,
            content: '',
        };
    });
    for (const section of deficiency_overrides) {
        if (!seen.has(section.id)) {
            merged.push({ ...section, content: '' });
            seen.add(section.id);
        }
    }
    return dedupe_appendix1_sections_by_id(merged).filter(is_deficiency_section);
}

function read_sections_from_appendix1(appendix1: unknown): Appendix1SectionDefinition[] {
    if (!appendix1 || typeof appendix1 !== 'object') return [];
    return parse_appendix1_sections_raw((appendix1 as Record<string, unknown>).sections);
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
    const default_groups = get_default_appendix1_sections_list().filter(is_deficiency_section);
    const content_sections = parsed_sections.filter((section) => !is_deficiency_section(section));
    const deficiency_sections = filter_deficiency_sections(parsed_sections);
    const has_sections = parsed_sections.length > 0;

    const existing_body =
        typeof appendix_obj.bodyText === 'string' && appendix_obj.bodyText.trim()
            ? appendix_obj.bodyText.trim()
            : '';

    if (!existing_body) {
        if (content_sections.length > 0) {
            appendix_obj.bodyText = combine_content_sections_to_body_text(content_sections);
        } else if (typeof summary === 'string' && summary.trim()) {
            appendix_obj.bodyText = replace_introduction_in_body_text(
                get_default_appendix1_body_text(),
                summary.trim(),
                get_default_appendix1_sections_list()
            );
        } else {
            appendix_obj.bodyText = get_default_appendix1_body_text();
        }
    } else {
        appendix_obj.bodyText = existing_body;
    }

    if (typeof appendix_obj.groupingTaxonomyId !== 'string'
        || !appendix_obj.groupingTaxonomyId.trim()
    ) {
        appendix_obj.groupingTaxonomyId = DEFAULT_WCAG_TAXONOMY_ID;
    }
    const grouping_taxonomy_id = String(appendix_obj.groupingTaxonomyId).trim();

    migrate_deficiency_intro_content_to_taxonomy(
        base,
        deficiency_sections.length > 0 ? deficiency_sections : default_groups,
        grouping_taxonomy_id
    );

    if (!has_sections && typeof summary === 'string' && summary.trim()) {
        appendix_obj.sections = strip_deficiency_section_content(default_groups);
    } else if (!has_sections) {
        appendix_obj.sections = strip_deficiency_section_content(default_groups);
    } else if (Array.isArray(appendix_obj.sections)) {
        appendix_obj.sections = merge_deficiency_sections_by_id(default_groups, parsed_sections);
    } else if (appendix_obj.sections && typeof appendix_obj.sections === 'object') {
        appendix_obj.sections = merge_deficiency_sections_by_id(
            default_groups,
            migrate_appendix1_sections_object_to_array(appendix_obj.sections as Record<string, unknown>)
        );
    } else {
        appendix_obj.sections = strip_deficiency_section_content(default_groups);
    }

    if (typeof appendix_obj.coverImage !== 'string' || !appendix_obj.coverImage.trim()) {
        appendix_obj.coverImage = 'default';
    }

    appendix_obj.bodyText = sanitize_appendix1_body_text(
        String(appendix_obj.bodyText ?? ''),
        get_default_appendix1_sections_list()
    );

    const from_file = read_sections_from_appendix1(appendix_obj);
    const existing_by_taxonomy_raw = appendix_obj.bodyTextByTaxonomy;
    const existing_by_taxonomy =
        existing_by_taxonomy_raw
        && typeof existing_by_taxonomy_raw === 'object'
        && !Array.isArray(existing_by_taxonomy_raw)
            ? { ...(existing_by_taxonomy_raw as Record<string, unknown>) }
            : {};
    if (!existing_by_taxonomy[grouping_taxonomy_id]) {
        existing_by_taxonomy[grouping_taxonomy_id] = appendix_obj.bodyText;
    }
    const normalized_by_taxonomy: Record<string, string> = {};
    for (const [taxonomy_id, value] of Object.entries(existing_by_taxonomy)) {
        const id = String(taxonomy_id).trim();
        if (!id || typeof value !== 'string' || !value.trim()) continue;
        normalized_by_taxonomy[id] = sanitize_appendix1_body_text(
            value.trim(),
            from_file.length > 0 ? from_file : get_default_appendix1_sections_list()
        );
    }
    appendix_obj.bodyTextByTaxonomy = normalized_by_taxonomy;
    appendix_obj.bodyText = normalized_by_taxonomy[grouping_taxonomy_id] ?? appendix_obj.bodyText;

    base.appendix1 = appendix_obj;
    return base;
}
