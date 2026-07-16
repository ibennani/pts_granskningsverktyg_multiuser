/**
 * @fileoverview Bilaga 1-sektioner: schema, defaults, resolve och platshållare.
 */
import default_sections_json from '../../shared/report_templates/appendix1_default_sv.json';

export const APPENDIX1_SECTION_KEYS = [
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

export type Appendix1SectionKey = (typeof APPENDIX1_SECTION_KEYS)[number];

export type Appendix1SectionFormat = 'paragraphs' | 'list';

export type Appendix1Section = {
    title: string;
    content: string;
    format?: Appendix1SectionFormat;
};

export type Appendix1SectionsMap = Record<Appendix1SectionKey, Appendix1Section>;

export type Appendix1RulefileSlice = {
    appendix1?: {
        summaryText?: unknown;
        coverImage?: unknown;
        sections?: Partial<Record<string, unknown>>;
    };
};

export type Appendix1AuditSlice = {
    ruleFileContent?: Appendix1RulefileSlice | null;
    auditMetadata?: {
        appendix1SummaryText?: unknown;
        appendix1SectionOverrides?: unknown;
        caseNumber?: unknown;
        actorName?: unknown;
        actorLink?: unknown;
        auditorName?: unknown;
        caseHandler?: unknown;
        startTime?: unknown;
        endTime?: unknown;
        [key: string]: unknown;
    };
    startTime?: unknown;
    endTime?: unknown;
};

export type Appendix1PlaceholderContext = {
    caseNumber: string;
    actorName: string;
    actorLink: string;
    actorLinkDomain: string;
    auditorName: string;
    caseHandler: string;
    startDate: string;
    endDate: string;
    exportDate: string;
};

export type Appendix1TocEntry = {
    section_id: string;
    title: string;
    heading_level: 1 | 2;
};

const DEFAULT_SECTIONS = default_sections_json as {
    coverImage: string;
    sections: Appendix1SectionsMap;
};

const SECTION_HEADING_LEVEL: Record<Appendix1SectionKey, 1 | 2> = {
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

/** WCAG-princip-id per resultatsektion. */
export const APPENDIX1_SECTION_PRINCIPLE_ID: Partial<Record<Appendix1SectionKey, string>> = {
    results_perceivable: 'perceivable',
    results_operable: 'operable',
    results_understandable: 'understandable',
    results_robust: 'robust',
};

export function get_appendix1_section_dom_id(section_key: string): string {
    return `section-${String(section_key).replace(/_/g, '-')}`;
}

export function get_default_appendix1_sections(): Appendix1SectionsMap {
    return JSON.parse(JSON.stringify(DEFAULT_SECTIONS.sections)) as Appendix1SectionsMap;
}

function normalize_section(raw: unknown): Appendix1Section | null {
    if (!raw || typeof raw !== 'object') return null;
    const entry = raw as Record<string, unknown>;
    const title = typeof entry.title === 'string' ? entry.title : '';
    const content = typeof entry.content === 'string' ? entry.content : '';
    const format = entry.format === 'list' ? 'list' : 'paragraphs';
    if (!title && !content) return null;
    return { title, content, format };
}

function read_sections_from_appendix1(appendix1: unknown): Partial<Appendix1SectionsMap> {
    if (!appendix1 || typeof appendix1 !== 'object') return {};
    const sections_raw = (appendix1 as Record<string, unknown>).sections;
    if (!sections_raw || typeof sections_raw !== 'object') return {};
    const result: Partial<Appendix1SectionsMap> = {};
    for (const key of APPENDIX1_SECTION_KEYS) {
        const normalized = normalize_section((sections_raw as Record<string, unknown>)[key]);
        if (normalized) {
            result[key] = normalized;
        }
    }
    return result;
}

export function read_rulefile_appendix1_sections(
    rule_file_content: Appendix1RulefileSlice | null | undefined
): Appendix1SectionsMap {
    const defaults = get_default_appendix1_sections();
    const from_file = read_sections_from_appendix1(rule_file_content?.appendix1);
    return { ...defaults, ...from_file };
}

function read_audit_section_overrides(
    audit_metadata: { appendix1SectionOverrides?: unknown } | null | undefined
): Partial<Appendix1SectionsMap> {
    if (!audit_metadata?.appendix1SectionOverrides) return {};
    return read_sections_from_appendix1({ sections: audit_metadata.appendix1SectionOverrides });
}

export function resolve_appendix1_sections(audit: Appendix1AuditSlice | null | undefined): Appendix1SectionsMap {
    const base = read_rulefile_appendix1_sections(audit?.ruleFileContent ?? undefined);
    if (!audit?.auditMetadata) return base;
    const meta = audit.auditMetadata;
    let merged = { ...base };

    if (Object.prototype.hasOwnProperty.call(meta, 'appendix1SectionOverrides')) {
        merged = { ...merged, ...read_audit_section_overrides(meta) };
    }

    if (Object.prototype.hasOwnProperty.call(meta, 'appendix1SummaryText')) {
        const summary = read_audit_appendix1_summary_text(meta);
        merged = {
            ...merged,
            introduction: {
                ...merged.introduction,
                title: merged.introduction?.title ?? get_default_appendix1_sections().introduction.title,
                content: summary,
                format: merged.introduction?.format ?? 'paragraphs',
            },
        };
    }

    return merged;
}

export function read_rulefile_appendix1_cover_image(
    rule_file_content: Appendix1RulefileSlice | null | undefined
): string {
    const raw = rule_file_content?.appendix1?.coverImage;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : 'default';
}

function migrate_summary_text_to_sections(summary_text: string): Partial<Appendix1SectionsMap> {
    const trimmed = summary_text.trim();
    if (!trimmed) return {};
    return {
        introduction: {
            title: get_default_appendix1_sections().introduction.title,
            content: trimmed,
            format: 'paragraphs',
        },
    };
}

export function normalize_rulefile_appendix1(
    rule_file_content: Record<string, unknown> | null | undefined
): Record<string, unknown> {
    const base = rule_file_content && typeof rule_file_content === 'object'
        ? { ...rule_file_content }
        : {};
    const appendix = base.appendix1;
    const appendix_obj =
        appendix && typeof appendix === 'object' && !Array.isArray(appendix)
            ? { ...(appendix as Record<string, unknown>) }
            : {};
    const summary = appendix_obj.summaryText;
    appendix_obj.summaryText = typeof summary === 'string' ? summary : '';

    const existing_sections = read_sections_from_appendix1(appendix_obj);
    const has_sections = APPENDIX1_SECTION_KEYS.some((key) => existing_sections[key]);
    if (!has_sections && typeof summary === 'string' && summary.trim()) {
        appendix_obj.sections = {
            ...(typeof appendix_obj.sections === 'object' && appendix_obj.sections !== null
                ? (appendix_obj.sections as Record<string, unknown>)
                : {}),
            ...migrate_summary_text_to_sections(summary),
        };
    } else if (!appendix_obj.sections || typeof appendix_obj.sections !== 'object') {
        appendix_obj.sections = get_default_appendix1_sections();
    } else {
        const merged: Record<string, Appendix1Section> = { ...get_default_appendix1_sections() };
        for (const key of APPENDIX1_SECTION_KEYS) {
            const normalized = normalize_section((appendix_obj.sections as Record<string, unknown>)[key]);
            if (normalized) merged[key] = normalized;
        }
        appendix_obj.sections = merged;
    }

    if (typeof appendix_obj.coverImage !== 'string' || !appendix_obj.coverImage.trim()) {
        appendix_obj.coverImage = 'default';
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

export function apply_appendix1_placeholders(text: string, context: Appendix1PlaceholderContext): string {
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

export function get_appendix1_section_heading_level(section_key: Appendix1SectionKey): 1 | 2 {
    return SECTION_HEADING_LEVEL[section_key];
}

export function build_appendix1_toc_entries(
    sections: Appendix1SectionsMap,
    t: (key: string) => string
): Appendix1TocEntry[] {
    const entries: Appendix1TocEntry[] = [
        {
            section_id: 'audit-info',
            title: t('export_appendix1_audit_info_heading'),
            heading_level: 1,
        },
    ];
    for (const key of APPENDIX1_SECTION_KEYS) {
        const section = sections[key];
        if (!section?.title) continue;
        entries.push({
            section_id: get_appendix1_section_dom_id(key),
            title: section.title,
            heading_level: get_appendix1_section_heading_level(key),
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
                read_rulefile_appendix1_sections(state.ruleFileContent).introduction?.content ?? '';
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

/** @deprecated Använd resolve_appendix1_sections och introduction-innehåll. */
export function read_rulefile_appendix1_summary_text(
    rule_file_content: Appendix1RulefileSlice | null | undefined
): string {
    const sections = read_rulefile_appendix1_sections(rule_file_content);
    if (sections.introduction?.content?.trim()) {
        return sections.introduction.content;
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

/** @deprecated Använd resolve_appendix1_sections. */
export function resolve_appendix1_summary_text(audit: Appendix1AuditSlice | null | undefined): string {
    if (!audit) return '';
    const meta = audit.auditMetadata;
    if (meta && Object.prototype.hasOwnProperty.call(meta, 'appendix1SummaryText')) {
        return read_audit_appendix1_summary_text(meta);
    }
    return read_rulefile_appendix1_summary_text(audit.ruleFileContent ?? undefined);
}
