/**
 * @fileoverview Bygger semantisk HTML för PDF-bilaga med bristtyper per WCAG-princip.
 */
import {
    collect_deficiency_types_grouped_by_principle,
    type DeficiencyTypeText,
} from './export_deficiency_types_collect.js';
import { escape_html_internal } from './export_html_build_primitives.js';
import { build_report_pdf_html_document } from './export_report_html_criterias.js';

export type ExportDeficiencyTypesHtmlT = (key: string, opts?: Record<string, unknown>) => string;

function build_deficiency_type_list_item_html(entry: DeficiencyTypeText): string {
    const primary = escape_html_internal(entry.primary);
    const secondary = entry.secondary ? escape_html_internal(entry.secondary) : '';
    if (secondary) {
        return `<li><strong>${primary}</strong> ${secondary}</li>`;
    }
    return `<li><strong>${primary}</strong></li>`;
}

export function build_deficiency_types_appendix_body_html(
    current_audit: Record<string, unknown>,
    t: ExportDeficiencyTypesHtmlT
): string {
    const groups = collect_deficiency_types_grouped_by_principle(current_audit, t);
    let html =
        `<section class="deficiency-types-appendix">` +
        `<h1>${escape_html_internal(t('export_pdf_deficiency_types_title'))}</h1>` +
        `<p>${escape_html_internal(t('export_pdf_deficiency_types_intro'))}</p>`;

    if (groups.length === 0) {
        html += `<p>${escape_html_internal(t('export_pdf_deficiency_types_empty'))}</p>`;
    } else {
        for (const group of groups) {
            html += `<h2>${escape_html_internal(group.label)}</h2><ul>`;
            for (const entry of group.types) {
                html += build_deficiency_type_list_item_html(entry);
            }
            html += `</ul>`;
        }
    }

    html += `</section>`;
    return html;
}

export function build_deficiency_types_appendix_pdf_document(
    current_audit: Record<string, unknown>,
    t: ExportDeficiencyTypesHtmlT
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
        body_html: build_deficiency_types_appendix_body_html(current_audit, t),
    });
}
