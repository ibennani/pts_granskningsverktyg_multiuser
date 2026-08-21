/**
 * @fileoverview Bygger PTS-strukturerad HTML för Bilaga 1 (omslag, info, TOC, sektioner).
 */
import {
    apply_appendix1_placeholders,
    build_appendix1_placeholder_context,
    build_appendix1_toc_entries,
    get_appendix1_section_dom_id,
    resolve_audit_grouping_taxonomy_id,
    resolve_appendix1_sections_list,
    strip_leading_duplicate_appendix1_heading,
    type Appendix1SectionDefinition,
} from '../logic/appendix1_sections.js';
import { collect_deficiency_types_grouped_by_taxonomy } from './export_deficiency_types_collect.js';
import { escape_html_internal, render_markdown_to_html } from './export_html_build_primitives.js';
import { build_deficiency_list_html } from '../utils/appendix1_deficiency_list_render.js';
import {
    APPENDIX1_COVER_IMAGE_PLACEHOLDER,
    build_appendix1_pdf_print_css,
} from './export_report_appendix1_print_css.js';

export type ExportAppendix1PtsHtmlT = (key: string, opts?: Record<string, unknown>) => string;

function build_actor_service_label(actor_name: string, actor_link: string, t: ExportAppendix1PtsHtmlT): string {
    if (actor_name) {
        return `${t('export_appendix1_service_prefix')} ${actor_name}`;
    }
    return t('export_appendix1_service_fallback');
}

function build_link_html(url: string, label: string): string {
    const trimmed = url.trim();
    if (!trimmed) return escape_html_internal(label);
    const safe_url = escape_html_internal(trimmed);
    const safe_label = escape_html_internal(label || trimmed);
    return `<a href="${safe_url}">${safe_label}</a>`;
}

function build_cover_case_number_line(case_number: string, t: ExportAppendix1PtsHtmlT): string {
    const value = case_number.trim() || '—';
    const label = `${t('case_number')} ${value}`;
    return `<p class="appendix1-cover__case-number">${escape_html_internal(label)}</p>`;
}

function build_cover_html(
    audit: Record<string, unknown>,
    t: ExportAppendix1PtsHtmlT
): string {
    const context = build_appendix1_placeholder_context(audit);
    const export_date = escape_html_internal(context.exportDate || context.endDate);
    const case_number_line = build_cover_case_number_line(context.caseNumber, t);

    return (
        `<section class="appendix1-cover" aria-hidden="true">` +
        `<img class="appendix1-cover__image" src="${APPENDIX1_COVER_IMAGE_PLACEHOLDER}" alt="">` +
        `<div class="appendix1-cover__content">` +
        `<div class="appendix1-cover__meta-row">` +
        `<p>${export_date}</p>` +
        `<div>${case_number_line}<p>PTS</p></div>` +
        `</div>` +
        `<p class="appendix1-cover__title">${escape_html_internal(t('export_appendix1_cover_title'))}</p>` +
        `<p class="appendix1-cover__subtitle">${escape_html_internal(t('export_appendix1_cover_subtitle'))}</p>` +
        `</div></section>`
    );
}

function build_audit_info_html(
    audit: Record<string, unknown>,
    t: ExportAppendix1PtsHtmlT
): string {
    const context = build_appendix1_placeholder_context(audit);
    const service_label = build_actor_service_label(context.actorName, context.actorLink, t);

    const rows: Array<{ label: string; value_html: string }> = [
        { label: t('case_number'), value_html: escape_html_internal(context.caseNumber || '—') },
        { label: t('export_appendix1_audited_service_label'), value_html: escape_html_internal(service_label) },
    ];
    if (context.actorLink) {
        rows.push({
            label: t('export_appendix1_service_link_label'),
            value_html: build_link_html(context.actorLink, context.actorLink),
        });
    }
    rows.push(
        {
            label: t('export_appendix1_audit_started_label'),
            value_html: escape_html_internal(context.startDate || '—'),
        },
        {
            label: t('export_appendix1_audit_ended_label'),
            value_html: escape_html_internal(context.endDate || '—'),
        },
        {
            label: t('export_appendix1_case_handler_label'),
            value_html: escape_html_internal(context.caseHandler || '—'),
        },
        {
            label: t('export_appendix1_investigator_label'),
            value_html: escape_html_internal(context.auditorName || '—'),
        }
    );

    let table_rows = '';
    for (const row of rows) {
        table_rows +=
            `<tr><th scope="row">${escape_html_internal(row.label)}</th><td>${row.value_html}</td></tr>`;
    }

    const contact_html =
        `<p class="appendix1-audit-info__contact">` +
        `${escape_html_internal(t('export_appendix1_pts_name'))}<br>` +
        `${escape_html_internal(t('export_appendix1_pts_address_line1'))}<br>` +
        `${escape_html_internal(t('export_appendix1_pts_address_line2'))}<br>` +
        `${escape_html_internal(t('export_appendix1_pts_phone'))}<br>` +
        `${build_link_html('mailto:pts@pts.se', 'pts@pts.se')}<br>` +
        `${build_link_html('http://www.pts.se/', 'www.pts.se')}` +
        `</p>`;

    return (
        `<section class="appendix1-page appendix1-audit-info" id="section-audit-info">` +
        `<h1>${escape_html_internal(t('export_appendix1_audit_info_heading'))}</h1>` +
        `<table class="appendix1-audit-info__meta" summary="${escape_html_internal(t('export_appendix1_audit_info_table_summary'))}"><tbody>${table_rows}</tbody></table>${contact_html}</section>`
    );
}

function build_toc_html(
    audit: Record<string, unknown>,
    t: ExportAppendix1PtsHtmlT
): string {
    const sections = resolve_appendix1_sections_list(audit);
    const entries = build_appendix1_toc_entries(sections, t);

    let list_html = '<ul>';
    for (const entry of entries) {
        const level_class =
            entry.heading_level === 2 ? ' appendix1-toc__item--level-2' : ' appendix1-toc__item--level-1';
        const href = `#${escape_html_internal(entry.section_id)}`;
        list_html +=
            `<li class="appendix1-toc__item${level_class}">` +
            `<a class="appendix1-toc__link" href="${href}">` +
            `<span class="appendix1-toc__label">${escape_html_internal(entry.title)}</span>` +
            `<span class="appendix1-toc__leader" role="presentation"></span>` +
            `<span class="appendix1-toc__page"></span>` +
            `</a></li>`;
    }
    list_html += '</ul>';

    return (
        `<section class="appendix1-page appendix1-toc">` +
        `<h1 class="appendix1-toc-title">${escape_html_internal(t('export_appendix1_toc_heading'))}</h1>` +
        `<nav aria-label="${escape_html_internal(t('export_appendix1_toc_nav_aria'))}">${list_html}</nav>` +
        `</section>`
    );
}

function build_section_content_html(
    section: Appendix1SectionDefinition,
    context: ReturnType<typeof build_appendix1_placeholder_context>
): string {
    const title = apply_appendix1_placeholders(section.title, context);
    const resolved = apply_appendix1_placeholders(
        strip_leading_duplicate_appendix1_heading(section.content, title),
        context
    ).trim();
    if (!resolved) return '';
    if (section.format === 'list') {
        const items = resolved
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => line.replace(/^[-*]\s+/, ''));
        if (items.length === 0) return '';
        return `<ul>${items.map((item) => `<li>${render_markdown_to_html(item)}</li>`).join('')}</ul>`;
    }
    return render_markdown_to_html(resolved);
}

function build_body_sections_html(
    audit: Record<string, unknown>,
    t: ExportAppendix1PtsHtmlT
): string {
    const sections = resolve_appendix1_sections_list(audit);
    const context = build_appendix1_placeholder_context(audit);
    const taxonomy_id = resolve_audit_grouping_taxonomy_id(audit);
    const deficiency_groups = collect_deficiency_types_grouped_by_taxonomy(audit, taxonomy_id, t);
    const deficiency_by_concept = new Map(
        deficiency_groups.map((group) => [group.concept_id, group.types])
    );

    let html = '';
    for (const section of sections) {
        const dom_id = get_appendix1_section_dom_id(section.id);
        const heading_tag = section.headingLevel === 2 ? 'h2' : 'h1';
        const title = escape_html_internal(apply_appendix1_placeholders(section.title, context));
        const content_html = build_section_content_html(section, context);

        html += `<section class="appendix1-section" id="${dom_id}">`;
        html += `<${heading_tag}>${title}</${heading_tag}>`;
        if (content_html) {
            html += `<div class="appendix1-section__content">${content_html}</div>`;
        }

        if (section.kind === 'deficiency_group' && section.conceptId) {
            const types = deficiency_by_concept.get(section.conceptId) ?? [];
            html += `<div class="appendix1-deficiency-list">${build_deficiency_list_html(types)}</div>`;
        }
        html += '</section>';
    }
    return html;
}

export function build_appendix1_pts_body_html(
    current_audit: Record<string, unknown>,
    t: ExportAppendix1PtsHtmlT
): string {
    return (
        `<main class="appendix1-document">` +
        build_cover_html(current_audit, t) +
        build_audit_info_html(current_audit, t) +
        build_toc_html(current_audit, t) +
        build_body_sections_html(current_audit, t) +
        `</main>`
    );
}

export function build_appendix1_pts_pdf_document(
    current_audit: Record<string, unknown>,
    t: ExportAppendix1PtsHtmlT
): string {
    const meta = current_audit.auditMetadata as { caseNumber?: string; actorName?: string } | undefined;
    const actor = String(meta?.actorName || t('filename_fallback_actor'));
    const case_num = String(meta?.caseNumber || '').trim();
    const doc_title = case_num
        ? `${case_num} ${actor} – ${t('export_appendix1_document_title_suffix')}`
        : `${actor} – ${t('export_appendix1_document_title_suffix')}`;
    const lang = escape_html_internal('sv');
    const title = escape_html_internal(doc_title);
    const body_html = build_appendix1_pts_body_html(current_audit, t);

    return (
        `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8">` +
        `<title>${title}</title><style>${build_appendix1_pdf_print_css()}</style></head>` +
        `<body>${body_html}</body></html>`
    );
}
