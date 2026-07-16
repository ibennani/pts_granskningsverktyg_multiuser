/**
 * @fileoverview Bygger semantisk HTML för Bilaga 1 Sammanfattning (text + bristtyper).
 */
import {
    collect_deficiency_types_grouped_by_principle,
    type DeficiencyTypeText,
} from './export_deficiency_types_collect.js';
import { escape_html_internal, render_markdown_to_html } from './export_html_build_primitives.js';
import { build_report_pdf_html_document } from './export_report_html_criterias.js';
import { resolve_appendix1_summary_text } from '../logic/appendix1_summary_text.js';

export type ExportAppendix1SummaryHtmlT = (key: string, opts?: Record<string, unknown>) => string;

function build_deficiency_type_list_item_html(entry: DeficiencyTypeText): string {
    const primary = escape_html_internal(entry.primary);
    const secondary = entry.secondary ? escape_html_internal(entry.secondary) : '';
    if (secondary) {
        return `<li><strong>${primary}</strong> ${secondary}</li>`;
    }
    return `<li><strong>${primary}</strong></li>`;
}

function build_appendix1_summary_text_html(summary_text: string): string {
    const trimmed = summary_text.trim();
    if (!trimmed) return '';
    return `<div class="appendix1-summary-text">${render_markdown_to_html(trimmed)}</div>`;
}

function build_deficiency_types_section_html(
    current_audit: Record<string, unknown>,
    t: ExportAppendix1SummaryHtmlT
): string {
    const groups = collect_deficiency_types_grouped_by_principle(current_audit, t);
    if (groups.length === 0) {
        return `<p>${escape_html_internal(t('export_appendix1_summary_deficiency_types_empty'))}</p>`;
    }

    let html = `<h2>${escape_html_internal(t('export_appendix1_summary_deficiency_types_heading'))}</h2>`;
    for (const group of groups) {
        html += `<h3>${escape_html_internal(group.label)}</h3><ul>`;
        for (const entry of group.types) {
            html += build_deficiency_type_list_item_html(entry);
        }
        html += `</ul>`;
    }
    return html;
}

export function build_appendix1_summary_body_html(
    current_audit: Record<string, unknown>,
    t: ExportAppendix1SummaryHtmlT
): string {
    const summary_text = resolve_appendix1_summary_text(current_audit);
    let html =
        `<section class="appendix1-summary">` +
        `<h1>${escape_html_internal(t('export_appendix1_summary_title'))}</h1>`;

    const summary_html = build_appendix1_summary_text_html(summary_text);
    if (summary_html) {
        html += summary_html;
    }

    html += build_deficiency_types_section_html(current_audit, t);
    html += `</section>`;
    return html;
}

export function build_appendix1_summary_pdf_document(
    current_audit: Record<string, unknown>,
    t: ExportAppendix1SummaryHtmlT
): string {
    const actor = String(
        (current_audit.auditMetadata as { actorName?: string } | undefined)?.actorName ||
            t('filename_fallback_actor')
    );
    const case_num = String(
        (current_audit.auditMetadata as { caseNumber?: string } | undefined)?.caseNumber || ''
    ).trim();
    const doc_title = case_num ? `${case_num} ${actor}` : actor;
    return build_report_pdf_html_document({
        title: doc_title,
        lang: 'sv',
        body_html: build_appendix1_summary_body_html(current_audit, t),
    });
}

/** @deprecated Använd build_appendix1_summary_body_html */
export function build_deficiency_types_appendix_body_html(
    current_audit: Record<string, unknown>,
    t: ExportAppendix1SummaryHtmlT
): string {
    return build_appendix1_summary_body_html(current_audit, t);
}

/** @deprecated Använd build_appendix1_summary_pdf_document */
export function build_deficiency_types_appendix_pdf_document(
    current_audit: Record<string, unknown>,
    t: ExportAppendix1SummaryHtmlT
): string {
    return build_appendix1_summary_pdf_document(current_audit, t);
}
