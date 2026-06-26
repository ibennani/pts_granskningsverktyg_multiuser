/**
 * @fileoverview Bygger minimal taggad HTML för PDF-bilaga 3: h1, h2 (filnamn) och img med alt.
 */
import { escape_html_internal } from './export_html_build_primitives.js';
import { build_report_pdf_print_css } from './export_report_typography.js';
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

/** Bilaga 3: endast body-innehåll utan main/section/figure (h1, h2, img). */
function build_screenshots_appendix_pdf_html_document(doc_title: string, body_html: string): string {
    const lang = escape_html_internal('sv');
    const title = escape_html_internal(doc_title);
    return (
        `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8">` +
        `<title>${title}</title><style>${build_report_pdf_print_css()}</style></head>` +
        `<body>${body_html}</body></html>`
    );
}

function build_screenshot_item_html(item: PreparedScreenshotsAppendixPdfItem): string {
    const filename = escape_html_internal(item.export_filename);
    const safe_src = escape_html_internal(item.pdf_data_uri);
    const max_height_cm = get_screenshots_appendix_max_image_height_cm();
    return (
        `<h2>${filename}</h2>` +
        `<img src="${safe_src}" alt="${filename}" ` +
        `style="max-width:100%;max-height:${max_height_cm}cm;width:auto;height:auto;">`
    );
}

export function build_screenshots_appendix_body_html(
    items: PreparedScreenshotsAppendixPdfItem[],
    current_audit: Record<string, unknown>,
    t: ExportScreenshotsAppendixHtmlT
): string {
    let html = `<h1>${escape_html_internal(resolve_screenshots_appendix_doc_title(current_audit, t))}</h1>`;

    if (items.length === 0) {
        html += escape_html_internal(t('export_screenshots_appendix_empty'));
    } else {
        for (const item of items) {
            html += build_screenshot_item_html(item);
        }
    }

    return html;
}

export function build_screenshots_appendix_pdf_document(
    current_audit: Record<string, unknown>,
    items: PreparedScreenshotsAppendixPdfItem[],
    t: ExportScreenshotsAppendixHtmlT
): string {
    const doc_title = resolve_screenshots_appendix_doc_title(current_audit, t);
    return build_screenshots_appendix_pdf_html_document(
        doc_title,
        build_screenshots_appendix_body_html(items, current_audit, t)
    );
}

export function build_screenshots_appendix_pdf_title_chunk(
    current_audit: Record<string, unknown>,
    t: ExportScreenshotsAppendixHtmlT
): string {
    const doc_title = resolve_screenshots_appendix_doc_title(current_audit, t);
    const body_html = `<h1>${escape_html_internal(resolve_screenshots_appendix_doc_title(current_audit, t))}</h1>`;
    return build_screenshots_appendix_pdf_html_document(doc_title, body_html);
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
        let body_html = '';
        for (const item of batch) {
            body_html += build_screenshot_item_html(item);
        }
        chunks.push(build_screenshots_appendix_pdf_html_document(doc_title, body_html));
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
