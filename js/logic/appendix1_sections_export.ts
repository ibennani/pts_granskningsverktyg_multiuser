/**
 * @fileoverview Exporthjälpare för Bilaga 1 (platshållare, innehållsförteckning, rubriker).
 */
import { recalculateAuditTimes } from './audit_logic_recalc.js';
import type { AuditStateShape } from './audit_logic_types.js';
import { get_default_appendix1_sections_list } from './appendix1_sections_defaults.js';
import { build_appendix1_sample_placeholder_values } from './appendix1_sample_placeholders.js';
import type {
    Appendix1AuditSlice,
    Appendix1PlaceholderContext,
    Appendix1SectionDefinition,
    Appendix1SectionKey,
    Appendix1TocEntry,
} from './appendix1_sections_types.js';

export function get_appendix1_section_dom_id(section_id: string): string {
    return `section-${String(section_id).replace(/_/g, '-')}`;
}

/** Word-bokmärkes-id (inga bindestreck). */
export function get_appendix1_section_bookmark_id(section_id: string): string {
    return `appendix1_${String(section_id).replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

function format_iso_date(iso: unknown, locale = 'sv-SE'): string {
    if (typeof iso !== 'string' || !iso.trim()) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function normalize_heading_compare_text(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
}

function resolve_appendix1_start_iso(audit: Appendix1AuditSlice | null | undefined): unknown {
    if (!audit) return null;
    const meta = audit.auditMetadata ?? {};
    const recalculated = recalculateAuditTimes(audit as AuditStateShape);
    return (
        audit.startTime
        ?? meta.startTime
        ?? (recalculated as { startTime?: unknown } | null | undefined)?.startTime
        ?? null
    );
}

function resolve_appendix1_end_iso(audit: Appendix1AuditSlice | null | undefined): unknown {
    if (!audit) return null;
    const meta = audit.auditMetadata ?? {};
    const recalculated = recalculateAuditTimes(audit as AuditStateShape);
    const resolved =
        audit.endTime
        ?? meta.endTime
        ?? (recalculated as { endTime?: unknown } | null | undefined)?.endTime
        ?? null;
    if (resolved) return resolved;

    const status = audit.auditStatus;
    if (status === 'locked' || status === 'archived') {
        const updated_at = (audit as { updated_at?: unknown }).updated_at;
        if (typeof updated_at === 'string' && updated_at.trim()) {
            return updated_at;
        }
    }
    return null;
}

/** Tar bort inledande markdown-rubrik eller textrad som duplicerar sektionstiteln. */
export function strip_leading_duplicate_appendix1_heading(content: string, section_title: string): string {
    const trimmed = content.trimStart();
    const normalized_title = normalize_heading_compare_text(section_title);
    if (!trimmed || !normalized_title) return content;

    const markdown_heading = trimmed.match(/^#{1,6}\s+(.+?)(?:\r?\n|$)/);
    if (markdown_heading && normalize_heading_compare_text(markdown_heading[1]) === normalized_title) {
        return trimmed.slice(markdown_heading[0].length).trimStart();
    }

    const plain_first_line = trimmed.match(/^([^\r\n]+)(?:\r?\n|$)/);
    if (plain_first_line && normalize_heading_compare_text(plain_first_line[1]) === normalized_title) {
        return trimmed.slice(plain_first_line[0].length).trimStart();
    }

    return content;
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
    const start_iso = resolve_appendix1_start_iso(audit);
    const end_iso = resolve_appendix1_end_iso(audit);
    const actor_link = String(meta.actorLink ?? '').trim();
    const export_iso = export_date_iso ?? new Date().toISOString();
    const sample_values = build_appendix1_sample_placeholder_values(audit as Record<string, unknown>);

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
        auditSampleCount: sample_values.auditSampleCount,
        auditSampleList: sample_values.auditSampleList,
        recurringSampleList: sample_values.recurringSampleList,
    };
}

/** Bygger platshållartoken i Bilaga 1-format, t.ex. `{{caseNumber}}`. */
export function format_appendix1_placeholder_token(key: string): string {
    const trimmed = String(key ?? '').trim();
    return `{{${trimmed}}}`;
}

export function apply_appendix1_placeholders(
    text: string,
    context: Appendix1PlaceholderContext
): string {
    let out = text
        .replaceAll('{{caseNumber}}', context.caseNumber)
        .replaceAll('{{actorName}}', context.actorName)
        .replaceAll('{{actorLink}}', context.actorLink)
        .replaceAll('{{actorLinkDomain}}', context.actorLinkDomain)
        .replaceAll('{{auditorName}}', context.auditorName)
        .replaceAll('{{caseHandler}}', context.caseHandler)
        .replaceAll('{{startDate}}', context.startDate)
        .replaceAll('{{endDate}}', context.endDate)
        .replaceAll('{{exportDate}}', context.exportDate);

    if (context.auditSampleCount !== undefined) {
        out = out.replaceAll('{{auditSampleCount}}', context.auditSampleCount);
    }
    if (context.auditSampleList !== undefined) {
        out = out.replaceAll('{{auditSampleList}}', context.auditSampleList);
    }
    if (context.recurringSampleList !== undefined) {
        out = out.replaceAll('{{recurringSampleList}}', context.recurringSampleList);
    }
    return out;
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
            section_id: 'section-audit-info',
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
