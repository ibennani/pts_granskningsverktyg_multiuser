/**
 * @fileoverview Genererar taggade PDF:er med bokmärken (rubriknivå 1–3) från semantisk HTML via Puppeteer/Chromium.
 */
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { merge_pdf_export_html_chunks } from '../../shared/pdf/merge_pdf_export_html_chunks.js';
import { PUPPETEER_LAUNCH_ARGS } from './page_screenshot_stealth.js';
import { inject_appendix1_cover_image } from './appendix1_cover_image.js';
import { inject_appendix1_toc_page_numbers } from './appendix1_toc_page_numbers.js';
import { inject_pdf_font_faces } from './pdf_font_faces.js';

export type PdfDocumentKind = 'default' | 'appendix1';

export interface GeneratePdfInput {
    htmlContent: string;
    outputPath?: string;
    documentKind?: PdfDocumentKind;
}

/** A4 med 20 mm vertikala och 15 mm horisontella marginaler ( tum ). */
const PDF_MARGIN_INCHES = {
    top: 20 / 25.4,
    bottom: 20 / 25.4,
    left: 15 / 25.4,
    right: 15 / 25.4,
};

const APPENDIX1_PDF_MARGIN_INCHES = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
};

const PDF_BASE_TIMEOUT_MS = 120_000;
const PDF_MAX_TIMEOUT_MS = 600_000;

function resolve_pdf_timeout_ms(html_length: number): number {
    const scaled = PDF_BASE_TIMEOUT_MS + Math.floor(html_length / 2048);
    return Math.min(PDF_MAX_TIMEOUT_MS, scaled);
}

async function render_pdf_buffer(page: Page, document_kind: PdfDocumentKind = 'default'): Promise<Buffer> {
    await page.emulateMediaType('print');
    if (document_kind === 'appendix1') {
        await inject_appendix1_toc_page_numbers(page);
    }
    const margins = document_kind === 'appendix1' ? APPENDIX1_PDF_MARGIN_INCHES : PDF_MARGIN_INCHES;
    const client = await page.createCDPSession();
    const result = await client.send('Page.printToPDF', {
        transferMode: 'ReturnAsBase64',
        generateTaggedPDF: true,
        generateDocumentOutline: true,
        printBackground: true,
        paperWidth: 8.27,
        paperHeight: 11.69,
        marginTop: margins.top,
        marginBottom: margins.bottom,
        marginLeft: margins.left,
        marginRight: margins.right,
    });
    return Buffer.from(result.data, 'base64');
}

async function wait_for_page_images(page: Page): Promise<void> {
    await page.evaluate(async () => {
        const images = Array.from(document.images);
        await Promise.all(
            images.map(
                (img) =>
                    new Promise<void>((resolve, reject) => {
                        if (img.complete && img.naturalHeight > 0) {
                            resolve();
                            return;
                        }
                        img.addEventListener('load', () => resolve(), { once: true });
                        img.addEventListener(
                            'error',
                            () => reject(new Error('Bild kunde inte laddas i PDF-export')),
                            { once: true }
                        );
                    })
            )
        );
    });
}

async function launch_pdf_browser(): Promise<Browser> {
    return puppeteer.launch({
        headless: true,
        args: [...PUPPETEER_LAUNCH_ARGS],
    });
}

async function render_single_html_to_pdf(
    page: Page,
    html_content: string,
    document_kind: PdfDocumentKind = 'default'
): Promise<Buffer> {
    const timeout_ms = resolve_pdf_timeout_ms(html_content.length);
    page.setDefaultNavigationTimeout(timeout_ms);
    page.setDefaultTimeout(timeout_ms);

    await page.setContent(html_content, {
        waitUntil: 'domcontentloaded',
        timeout: timeout_ms,
    } as unknown as Parameters<typeof page.setContent>[1]);
    await wait_for_page_images(page);
    return render_pdf_buffer(page, document_kind);
}

function prepare_html_for_pdf(html_content: string, document_kind: PdfDocumentKind): string {
    let prepared = inject_pdf_font_faces(html_content);
    if (document_kind === 'appendix1') {
        prepared = inject_appendix1_cover_image(prepared);
    }
    return prepared;
}

/**
 * Renderar HTML till en taggad (tillgänglig) PDF med dokumentbokmärken från h1–h3.
 */
export async function generate_pdf_from_html(input: GeneratePdfInput): Promise<Buffer> {
    const { htmlContent, outputPath, documentKind = 'default' } = input;
    const prepared_html = prepare_html_for_pdf(htmlContent, documentKind);
    let browser: Browser | undefined;

    try {
        browser = await launch_pdf_browser();
        const page = await browser.newPage();
        const pdf_buffer = await render_single_html_to_pdf(page, prepared_html, documentKind);

        if (outputPath) {
            const fs = await import('node:fs/promises');
            await fs.writeFile(outputPath, pdf_buffer);
        }

        return pdf_buffer;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Slår ihop HTML-delar till ett dokument och renderar en taggad PDF.
 * (pdf-lib-sammanslagning tar bort tillgänglighetstaggar — därför HTML-merge + en printToPDF.)
 */
export async function generate_pdf_from_html_chunks(html_chunks: string[]): Promise<Buffer> {
    const merged_html = merge_pdf_export_html_chunks(html_chunks);
    return generate_pdf_from_html({ htmlContent: merged_html });
}
