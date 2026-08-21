/**
 * @fileoverview Bygger taggad HTML för PDF-bilaga 3: main, h1, h2 per bild, img med alt.
 */
import { escape_html_internal, render_markdown_to_html } from './export_html_build_primitives.js';
import { build_report_pdf_print_css } from './export_report_typography.js';
import { resolve_appendix3_screenshots_template } from '../logic/appendix3_screenshots_template.js';
import {
    format_screenshots_appendix_display_filename,
    type PreparedScreenshotsAppendixPdfItem,
} from './export_screenshots_appendix_media.js';

export type ExportScreenshotsAppendixHtmlT = (key: string, opts?: Record<string, unknown>) => string;

/** Antal skärmbilder per HTML-del vid chunkad PDF-export (servern slår ihop delarna). */
export const PDF_SCREENSHOTS_APPENDIX_IMAGES_PER_CHUNK = 2;

function resolve_screenshots_appendix_doc_title(
    current_audit: Record<string, unknown>,
    t: ExportScreenshotsAppendixHtmlT
): string {
    const resolved = resolve_appendix3_screenshots_template(current_audit as never);
    if (resolved.title.trim()) return resolved.title;
    const actor = String(
        (current_audit.auditMetadata as { actorName?: string } | undefined)?.actorName ||
            t('filename_fallback_actor')
    );
    const case_num = String(
        (current_audit.auditMetadata as { caseNumber?: string } | undefined)?.caseNumber || ''
    ).trim();
    return case_num ? `${case_num} ${actor}` : actor;
}

function build_screenshots_appendix_intro_html(current_audit: Record<string, unknown>): string {
    const resolved = resolve_appendix3_screenshots_template(current_audit as never);
    if (!resolved.introText.trim()) return '';
    return render_markdown_to_html(resolved.introText);
}

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
    const display_filename = format_screenshots_appendix_display_filename(item.export_filename);
    const heading_text = escape_html_internal(display_filename);
    const alt_text = escape_html_internal(display_filename);
    const safe_src = escape_html_internal(item.pdf_data_uri);
    return (
        `<section class="screenshots-appendix__item">` +
        `<h2 class="screenshots-appendix__heading">${heading_text}</h2>` +
        `<img src="${safe_src}" alt="${alt_text}" title="${alt_text}">` +
        `</section>`
    );
}

function wrap_screenshots_appendix_items_html(items_html: string): string {
    if (!items_html) return '';
    return `<section class="screenshots-appendix">${items_html}</section>`;
}

function wrap_screenshots_appendix_main_html(inner_html: string): string {
    return `<main class="screenshots-appendix-document">${inner_html}</main>`;
}

export function build_screenshots_appendix_body_html(
    items: PreparedScreenshotsAppendixPdfItem[],
    current_audit: Record<string, unknown>,
    t: ExportScreenshotsAppendixHtmlT
): string {
    let html = `<h1>${escape_html_internal(resolve_screenshots_appendix_doc_title(current_audit, t))}</h1>`;
    const intro_html = build_screenshots_appendix_intro_html(current_audit);
    if (intro_html) {
        html += intro_html;
    }

    if (items.length === 0) {
        html += `<p class="screenshots-appendix__empty">${escape_html_internal(t('export_screenshots_appendix_empty'))}</p>`;
    } else {
        let items_html = '';
        for (const item of items) {
            items_html += build_screenshot_item_html(item);
        }
        html += wrap_screenshots_appendix_items_html(items_html);
    }

    return wrap_screenshots_appendix_main_html(html);
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
    let body_html = `<h1>${escape_html_internal(doc_title)}</h1>`;
    const intro_html = build_screenshots_appendix_intro_html(current_audit);
    if (intro_html) {
        body_html += intro_html;
    }
    return build_screenshots_appendix_pdf_html_document(
        doc_title,
        wrap_screenshots_appendix_main_html(body_html)
    );
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
        let items_html = '';
        for (const item of batch) {
            items_html += build_screenshot_item_html(item);
        }
        chunks.push(
            build_screenshots_appendix_pdf_html_document(
                doc_title,
                wrap_screenshots_appendix_main_html(wrap_screenshots_appendix_items_html(items_html))
            )
        );
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
