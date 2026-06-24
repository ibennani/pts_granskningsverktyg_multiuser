/**
 * @fileoverview Bygger semantisk HTML för PDF-bilaga 3 med alla skärmbilder.
 */
import { escape_html_internal } from './export_html_build_primitives.js';
import { build_report_pdf_html_document } from './export_report_html_criterias.js';
import {
    array_buffer_to_base64_data_uri,
    get_screenshots_appendix_max_image_height_cm,
    type PreparedScreenshotsAppendixItem,
} from './export_screenshots_appendix_media.js';

export type ExportScreenshotsAppendixHtmlT = (key: string, opts?: Record<string, unknown>) => string;

function build_screenshot_item_html(item: PreparedScreenshotsAppendixItem): string {
    const title = escape_html_internal(item.export_filename);
    const src = array_buffer_to_base64_data_uri(item.bytes, item.mime_type);
    const safe_src = escape_html_internal(src);
    const max_height_cm = get_screenshots_appendix_max_image_height_cm();
    return (
        `<section class="screenshots-appendix__item">` +
        `<h2>${title}</h2>` +
        `<img src="${safe_src}" alt="${title}" ` +
        `style="max-width:100%;max-height:${max_height_cm}cm;width:auto;height:auto;">` +
        `</section>`
    );
}

export function build_screenshots_appendix_body_html(
    items: PreparedScreenshotsAppendixItem[],
    t: ExportScreenshotsAppendixHtmlT
): string {
    let html =
        `<section class="screenshots-appendix">` +
        `<h1>${escape_html_internal(t('export_screenshots_appendix_title'))}</h1>`;

    if (items.length === 0) {
        html += `<p>${escape_html_internal(t('export_screenshots_appendix_empty'))}</p>`;
    } else {
        for (const item of items) {
            html += build_screenshot_item_html(item);
        }
    }

    html += `</section>`;
    return html;
}

export function build_screenshots_appendix_pdf_document(
    current_audit: Record<string, unknown>,
    items: PreparedScreenshotsAppendixItem[],
    t: ExportScreenshotsAppendixHtmlT
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
        body_html: build_screenshots_appendix_body_html(items, t),
    });
}
