/**
 * @fileoverview Bilaga 1 brödtext: kombinera, tolka och ersätta inledning i markdown.
 */
import { DEFAULT_WCAG_TAXONOMY_ID } from '../../shared/classification/taxonomy_grouping.js';
import type { Appendix1SectionDefinition } from './appendix1_sections_types.js';

/** Endast WCAG-taxonomin får ärvd standardtext från legacy bodyText vid saknad per-taxonomi-post. */
export function taxonomy_uses_legacy_appendix1_body_text_fallback(taxonomy_id: string): boolean {
    return String(taxonomy_id ?? '').trim() === DEFAULT_WCAG_TAXONOMY_ID;
}

/** Legacy innehållssektioner i exportordning. */
export const APPENDIX1_CONTENT_SECTION_IDS = [
    'introduction',
    'method',
    'method_legal',
    'method_scope',
    'method_approach',
    'results_intro',
] as const;

function normalize_heading_compare_text(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
}

function infer_section_id_from_title(
    title: string,
    index: number,
    default_sections: Appendix1SectionDefinition[]
): string {
    const normalized_title = normalize_heading_compare_text(title);
    for (const section of default_sections) {
        if (normalize_heading_compare_text(section.title) === normalized_title) {
            return section.id;
        }
    }
    if (index < APPENDIX1_CONTENT_SECTION_IDS.length) {
        return APPENDIX1_CONTENT_SECTION_IDS[index];
    }
    return `body_${index + 1}`;
}

function strip_leading_heading_from_content(content: string, section_title: string): string {
    const trimmed = content.trimStart();
    const normalized_title = normalize_heading_compare_text(section_title);
    if (!trimmed || !normalized_title) return content.trim();

    const markdown_heading = trimmed.match(/^#{1,6}\s+(.+?)(?:\r?\n|$)/);
    if (markdown_heading && normalize_heading_compare_text(markdown_heading[1]) === normalized_title) {
        return trimmed.slice(markdown_heading[0].length).trimStart();
    }

    const plain_first_line = trimmed.match(/^([^\r\n]+)(?:\r?\n|$)/);
    if (plain_first_line && normalize_heading_compare_text(plain_first_line[1]) === normalized_title) {
        return trimmed.slice(plain_first_line[0].length).trimStart();
    }

    return content.trim();
}

function infer_content_format(content: string): 'paragraphs' | 'list' {
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) return 'paragraphs';
    const bullet_lines = lines.filter((line) => /^[-*]\s+/.test(line));
    return bullet_lines.length >= Math.max(1, Math.floor(lines.length / 2)) ? 'list' : 'paragraphs';
}

/**
 * Bygger en markdown-brödtext från innehållssektioner (ej bristgrupper).
 */
export function combine_content_sections_to_body_text(
    sections: Appendix1SectionDefinition[]
): string {
    const blocks: string[] = [];
    for (const section of sections) {
        if (section.kind === 'deficiency_group') continue;
        const prefix = section.headingLevel === 2 ? '##' : '#';
        const title_line = `${prefix} ${section.title.trim()}`;
        const content = section.content.trim();
        blocks.push(content ? `${title_line}\n\n${content}` : title_line);
    }
    return blocks.join('\n\n').trim();
}

/**
 * Tolkar markdown-brödtext till innehållssektioner med rubriker.
 */
export function parse_body_text_to_content_sections(
    body_text: string,
    default_sections: Appendix1SectionDefinition[] = []
): Appendix1SectionDefinition[] {
    const trimmed = body_text.trim();
    if (!trimmed) return [];

    const heading_regex = /^(#{1,2})\s+(.+)$/gm;
    const matches = [...trimmed.matchAll(heading_regex)];
    if (matches.length === 0) {
        return [
            {
                id: 'introduction',
                kind: 'content',
                headingLevel: 1,
                title: '1. Inledning',
                content: trimmed,
                format: infer_content_format(trimmed),
            },
        ];
    }

    const sections: Appendix1SectionDefinition[] = [];
    for (let index = 0; index < matches.length; index += 1) {
        const match = matches[index];
        const heading_marks = match[1];
        const title = match[2].trim();
        const heading_level = heading_marks.length >= 2 ? 2 : 1;
        const content_start = (match.index ?? 0) + match[0].length;
        const content_end =
            index + 1 < matches.length ? (matches[index + 1].index ?? trimmed.length) : trimmed.length;
        const content = trimmed.slice(content_start, content_end).trim();

        sections.push({
            id: infer_section_id_from_title(title, index, default_sections),
            kind: 'content',
            headingLevel: heading_level,
            title,
            content,
            format: infer_content_format(content),
        });
    }
    return sections;
}

/**
 * Ersätter inledningens brödtext i en markdown-brödtext (första h1-avsnittet).
 */
export function replace_introduction_in_body_text(
    body_text: string,
    introduction_content: string,
    default_sections: Appendix1SectionDefinition[] = []
): string {
    const trimmed_intro = introduction_content.trim();
    const sections = parse_body_text_to_content_sections(body_text, default_sections);
    if (sections.length === 0) {
        const intro_title =
            default_sections.find((section) => section.id === 'introduction')?.title ?? '1. Inledning';
        return combine_content_sections_to_body_text([
            {
                id: 'introduction',
                kind: 'content',
                headingLevel: 1,
                title: intro_title,
                content: trimmed_intro,
                format: infer_content_format(trimmed_intro),
            },
        ]);
    }

    const intro_index = sections.findIndex(
        (section) => section.id === 'introduction' || section.headingLevel === 1
    );
    const target_index = intro_index >= 0 ? intro_index : 0;
    sections[target_index] = {
        ...sections[target_index],
        content: strip_leading_heading_from_content(trimmed_intro, sections[target_index].title),
        format: infer_content_format(trimmed_intro),
    };
    return combine_content_sections_to_body_text(sections);
}

function read_body_text_by_taxonomy_map(raw: unknown): Record<string, string> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const result: Record<string, string> = {};
    for (const [taxonomy_id, value] of Object.entries(raw as Record<string, unknown>)) {
        const id = String(taxonomy_id).trim();
        if (!id || typeof value !== 'string' || !value.trim()) continue;
        result[id] = value.trim();
    }
    return result;
}

function remove_duplicate_leading_headings(body_text: string): string {
    let text = body_text.trimStart();
    let changed = true;
    while (changed) {
        changed = false;
        const first_match = text.match(/^(#{1,2})\s+(.+?)(?:\r?\n|$)/);
        if (!first_match) break;
        const first_title = normalize_heading_compare_text(first_match[2]);
        const rest = text.slice(first_match[0].length).trimStart();
        const second_match = rest.match(/^(#{1,2})\s+(.+?)(?:\r?\n|$)/);
        if (
            second_match
            && normalize_heading_compare_text(second_match[2]) === first_title
        ) {
            text = rest;
            changed = true;
        }
    }
    return text;
}

/**
 * Tar bort dubblettrubriker i sektionsinnehåll och återbygger brödtexten.
 */
export function sanitize_appendix1_body_text(
    body_text: string,
    default_sections: Appendix1SectionDefinition[] = []
): string {
    const trimmed = remove_duplicate_leading_headings(body_text.trim());
    if (!trimmed) return trimmed;
    const sections = parse_body_text_to_content_sections(trimmed, default_sections);
    if (sections.length === 0) return trimmed;
    const cleaned = sections.map((section) => ({
        ...section,
        content: strip_leading_heading_from_content(section.content, section.title),
    }));
    return combine_content_sections_to_body_text(cleaned);
}

/**
 * Läser brödtext från appendix1-objekt eller kombinerar legacy-sektioner.
 */
export function read_appendix1_body_text_from_appendix1(
    appendix1: unknown,
    default_body_text: string,
    legacy_sections: Appendix1SectionDefinition[],
    taxonomy_id?: string
): string {
    const resolved_taxonomy_id =
        appendix1 && typeof appendix1 === 'object'
            ? String(
                taxonomy_id ?? (appendix1 as Record<string, unknown>).groupingTaxonomyId ?? ''
            ).trim()
            : String(taxonomy_id ?? '').trim();

    if (appendix1 && typeof appendix1 === 'object') {
        const appendix_obj = appendix1 as Record<string, unknown>;
        const by_taxonomy = read_body_text_by_taxonomy_map(appendix_obj.bodyTextByTaxonomy);
        if (resolved_taxonomy_id && by_taxonomy[resolved_taxonomy_id]) {
            return by_taxonomy[resolved_taxonomy_id];
        }
        if (
            resolved_taxonomy_id
            && !taxonomy_uses_legacy_appendix1_body_text_fallback(resolved_taxonomy_id)
        ) {
            return '';
        }
        const raw = appendix_obj.bodyText;
        if (typeof raw === 'string' && raw.trim()) {
            return raw.trim();
        }
    }

    if (
        resolved_taxonomy_id
        && !taxonomy_uses_legacy_appendix1_body_text_fallback(resolved_taxonomy_id)
    ) {
        return '';
    }

    const content_sections = legacy_sections.filter((section) => section.kind !== 'deficiency_group');
    if (content_sections.length > 0) {
        return combine_content_sections_to_body_text(content_sections);
    }
    return default_body_text;
}

/**
 * Läser alla sparade brödtexter per taxonomi från appendix1.
 */
export function read_appendix1_body_text_by_taxonomy_from_appendix1(
    appendix1: unknown,
    default_body_text: string,
    legacy_sections: Appendix1SectionDefinition[],
    taxonomy_ids: string[] = []
): Record<string, string> {
    const by_taxonomy = read_body_text_by_taxonomy_map(
        appendix1 && typeof appendix1 === 'object'
            ? (appendix1 as Record<string, unknown>).bodyTextByTaxonomy
            : undefined
    );
    const fallback = read_appendix1_body_text_from_appendix1(
        appendix1,
        default_body_text,
        legacy_sections
    );
    const result: Record<string, string> = { ...by_taxonomy };
    for (const taxonomy_id of taxonomy_ids) {
        const id = String(taxonomy_id).trim();
        if (!id || result[id]) continue;
        if (taxonomy_uses_legacy_appendix1_body_text_fallback(id)) {
            result[id] = fallback;
        }
    }
    return result;
}
