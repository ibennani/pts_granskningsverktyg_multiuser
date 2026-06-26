/**
 * @fileoverview Bygger semantisk HTML för PDF-bilaga 3 med alla skärmbilder.
 */
import { escape_html_internal } from './export_html_build_primitives.js';
import { build_report_pdf_html_document } from './export_report_html_criterias.js';
import {
    get_screenshots_appendix_max_image_height_cm,
    type PreparedScreenshotsAppendixPdfItem,
} from './export_screenshots_appendix_media.js';

export type ExportScreenshotsAppendixHtmlT = (key: string, opts?: Record<string, unknown>) => string;

/** Antal skärmbilder per HTML-del vid chunkad PDF-export (servern slår ihop delarna). */
export const PDF_SCREENSHOTS_APPENDIX_IMAGES_PER_CHUNK = 2;

function resolve_screenshots_appendix_doc_title(
    current_audit: Record<string, unknown>,
    t: ExportScreenshotsAppendixHtmlT
): string {
    const actor = String(
        (current_audit.auditMetadata as { actorName?: string } | undefined)?.actorName ||
            t('filename_fallback_actor')
    );
    const case_num = String(
        (current_audit.auditMetadata as { caseNumber?: string } | undefined)?.caseNumber || ''
    ).trim();
    return case_num ? `${case_num} ${actor}` : actor;
}

function build_screenshot_item_html(item: PreparedScreenshotsAppendixPdfItem): string {
    const title = escape_html_internal(item.export_filename);
    const safe_src = escape_html_internal(item.pdf_data_uri);
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
    items: PreparedScreenshotsAppendixPdfItem[],
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
    items: PreparedScreenshotsAppendixPdfItem[],
    t: ExportScreenshotsAppendixHtmlT
): string {
    const doc_title = resolve_screenshots_appendix_doc_title(current_audit, t);
    return build_report_pdf_html_document({
        title: doc_title,
        lang: 'sv',
        body_html: build_screenshots_appendix_body_html(items, t),
    });
}

export function build_screenshots_appendix_pdf_title_chunk(
    current_audit: Record<string, unknown>,
    t: ExportScreenshotsAppendixHtmlT
): string {
    const doc_title = resolve_screenshots_appendix_doc_title(current_audit, t);
    const body_html =
        `<section class="screenshots-appendix">` +
        `<h1>${escape_html_internal(t('export_screenshots_appendix_title'))}</h1>` +
        `</section>`;
    return build_report_pdf_html_document({ title: doc_title, lang: 'sv', body_html });
}

export function build_screenshots_appendix_pdf_image_chunks(
    current_audit: Record<string, unknown>,
    items: PreparedScreenshotsAppendixPdfItem[],
    t: ExportScreenshotsAppendixHtmlT
): string[] {
    if (items.length === 0) return [];
    const doc_title = resolve_screenshots_appendix_doc_title(current_audit, t);
    const chunks: string[] = [];
    for (let index = 0; index < items.length; index += PDF_SCREENSHOTS_APPENDIX_IMAGES_PER_CHUNK) {
        const batch = items.slice(index, index + PDF_SCREENSHOTS_APPENDIX_IMAGES_PER_CHUNK);
        let body_html = `<section class="screenshots-appendix">`;
        for (const item of batch) {
            body_html += build_screenshot_item_html(item);
        }
        body_html += `</section>`;
        chunks.push(build_report_pdf_html_document({ title: doc_title, lang: 'sv', body_html }));
    }
    return chunks;
}

export function build_screenshots_appendix_pdf_document_chunks(
    current_audit: Record<string, unknown>,
    items: PreparedScreenshotsAppendixPdfItem[],
    t: ExportScreenshotsAppendixHtmlT
): string[] {
    return [
        build_screenshots_appendix_pdf_title_chunk(current_audit, t),
        ...build_screenshots_appendix_pdf_image_chunks(current_audit, items, t),
    ];
}
