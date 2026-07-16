/**
 * @fileoverview Migrering av Bilaga 1-sektioner från objekt-map till array-format.
 */
import type { Appendix1SectionDefinition, Appendix1SectionFormat } from './appendix1_sections_types.js';

/** WCAG-princip per legacy results_*-nyckel. */
export const LEGACY_SECTION_CONCEPT_ID: Record<string, string> = {
    results_perceivable: 'perceivable',
    results_operable: 'operable',
    results_understandable: 'understandable',
    results_robust: 'robust',
};

/** Legacy ordning för objekt-map till array. */
export const LEGACY_APPENDIX1_SECTION_KEY_ORDER = [
    'introduction',
    'method',
    'method_legal',
    'method_scope',
    'method_approach',
    'results_intro',
    'results_perceivable',
    'results_operable',
    'results_understandable',
    'results_robust',
] as const;

const LEGACY_SECTION_HEADING_LEVEL: Record<string, 1 | 2> = {
    introduction: 1,
    method: 1,
    method_legal: 2,
    method_scope: 2,
    method_approach: 2,
    results_intro: 1,
    results_perceivable: 2,
    results_operable: 2,
    results_understandable: 2,
    results_robust: 2,
};

function legacy_section_kind(section_id: string): 'content' | 'deficiency_group' {
    return LEGACY_SECTION_CONCEPT_ID[section_id] ? 'deficiency_group' : 'content';
}

function read_format(raw: unknown): Appendix1SectionFormat {
    return raw === 'list' ? 'list' : 'paragraphs';
}

/**
 * Normaliserar en sektion från regelfil eller granskningsoverride.
 */
export function normalize_section_definition(raw: unknown): Appendix1SectionDefinition | null {
    if (!raw || typeof raw !== 'object') return null;
    const entry = raw as Record<string, unknown>;

    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const title = typeof entry.title === 'string' ? entry.title : '';
    const content = typeof entry.content === 'string' ? entry.content : '';
    const format = read_format(entry.format);

    const kind_raw = entry.kind;
    const kind =
        kind_raw === 'deficiency_group' || kind_raw === 'content'
            ? kind_raw
            : id && LEGACY_SECTION_CONCEPT_ID[id]
              ? 'deficiency_group'
              : 'content';

    const heading_level_raw = entry.headingLevel ?? entry.heading_level;
    const heading_level =
        heading_level_raw === 1 || heading_level_raw === 2
            ? heading_level_raw
            : id
              ? LEGACY_SECTION_HEADING_LEVEL[id] ?? 1
              : 1;

    const concept_id_raw = entry.conceptId ?? entry.concept_id;
    const concept_id =
        typeof concept_id_raw === 'string' && concept_id_raw.trim()
            ? concept_id_raw.trim()
            : id && LEGACY_SECTION_CONCEPT_ID[id]
              ? LEGACY_SECTION_CONCEPT_ID[id]
              : undefined;

    if (!id || (!title && !content)) return null;

    const section: Appendix1SectionDefinition = {
        id,
        kind,
        headingLevel: heading_level,
        title,
        content,
        format,
    };
    if (concept_id) {
        section.conceptId = concept_id;
    }
    return section;
}

function normalize_legacy_object_entry(
    section_id: string,
    raw: unknown
): Appendix1SectionDefinition | null {
    if (!raw || typeof raw !== 'object') return null;
    const entry = raw as Record<string, unknown>;
    const title = typeof entry.title === 'string' ? entry.title : '';
    const content = typeof entry.content === 'string' ? entry.content : '';
    if (!title && !content) return null;

    const kind = legacy_section_kind(section_id);
    const section: Appendix1SectionDefinition = {
        id: section_id,
        kind,
        headingLevel: LEGACY_SECTION_HEADING_LEVEL[section_id] ?? 1,
        title,
        content,
        format: read_format(entry.format),
    };
    const concept_id = LEGACY_SECTION_CONCEPT_ID[section_id];
    if (concept_id) {
        section.conceptId = concept_id;
    }
    return section;
}

/**
 * Migrerar appendix1.sections från objekt-map till sorterad array.
 */
export function migrate_appendix1_sections_object_to_array(
    obj: Record<string, unknown>
): Appendix1SectionDefinition[] {
    const result: Appendix1SectionDefinition[] = [];
    for (const key of LEGACY_APPENDIX1_SECTION_KEY_ORDER) {
        const normalized = normalize_legacy_object_entry(key, obj[key]);
        if (normalized) {
            result.push(normalized);
        }
    }
    for (const [key, raw] of Object.entries(obj)) {
        if (LEGACY_APPENDIX1_SECTION_KEY_ORDER.includes(key as (typeof LEGACY_APPENDIX1_SECTION_KEY_ORDER)[number])) {
            continue;
        }
        const normalized = normalize_legacy_object_entry(key, raw);
        if (normalized) {
            result.push(normalized);
        }
    }
    return result;
}

/**
 * Tolkar sections-fält som array eller legacy-objekt.
 */
export function parse_appendix1_sections_raw(sections_raw: unknown): Appendix1SectionDefinition[] {
    if (Array.isArray(sections_raw)) {
        return sections_raw
            .map((entry) => normalize_section_definition(entry))
            .filter((entry): entry is Appendix1SectionDefinition => Boolean(entry));
    }
    if (sections_raw && typeof sections_raw === 'object') {
        return migrate_appendix1_sections_object_to_array(sections_raw as Record<string, unknown>);
    }
    return [];
}
