/**
 * @fileoverview Genererar taggade PDF:er med bokmärken (rubriknivå 1–3) från semantisk HTML via Puppeteer/Chromium.
 */
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { merge_pdf_export_html_chunks } from '../../shared/pdf/merge_pdf_export_html_chunks.js';
import { PUPPETEER_LAUNCH_ARGS } from './page_screenshot_stealth.js';

export interface GeneratePdfInput {
    htmlContent: string;
    outputPath?: string;
}

/** A4 med 20 mm vertikala och 15 mm horisontella marginaler ( tum ). */
const PDF_MARGIN_INCHES = {
    top: 20 / 25.4,
    bottom: 20 / 25.4,
    left: 15 / 25.4,
    right: 15 / 25.4,
};

const PDF_BASE_TIMEOUT_MS = 120_000;
const PDF_MAX_TIMEOUT_MS = 600_000;

function resolve_pdf_timeout_ms(html_length: number): number {
    const scaled = PDF_BASE_TIMEOUT_MS + Math.floor(html_length / 2048);
    return Math.min(PDF_MAX_TIMEOUT_MS, scaled);
}

async function render_pdf_buffer(page: Page): Promise<Buffer> {
    await page.emulateMediaType('print');
    const client = await page.createCDPSession();
    const result = await client.send('Page.printToPDF', {
        transferMode: 'ReturnAsBase64',
        generateTaggedPDF: true,
        generateDocumentOutline: true,
        printBackground: true,
        paperWidth: 8.27,
        paperHeight: 11.69,
        marginTop: PDF_MARGIN_INCHES.top,
        marginBottom: PDF_MARGIN_INCHES.bottom,
        marginLeft: PDF_MARGIN_INCHES.left,
        marginRight: PDF_MARGIN_INCHES.right,
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

async function render_single_html_to_pdf(page: Page, html_content: string): Promise<Buffer> {
    const timeout_ms = resolve_pdf_timeout_ms(html_content.length);
    page.setDefaultNavigationTimeout(timeout_ms);
    page.setDefaultTimeout(timeout_ms);

    await page.setContent(html_content, {
        waitUntil: 'domcontentloaded',
        timeout: timeout_ms,
    } as unknown as Parameters<typeof page.setContent>[1]);
    await wait_for_page_images(page);
    return render_pdf_buffer(page);
}

/**
 * Renderar HTML till en taggad (tillgänglig) PDF med dokumentbokmärken från h1–h3.
 */
export async function generate_pdf_from_html(input: GeneratePdfInput): Promise<Buffer> {
    const { htmlContent, outputPath } = input;
    let browser: Browser | undefined;

    try {
        browser = await launch_pdf_browser();
        const page = await browser.newPage();
        const pdf_buffer = await render_single_html_to_pdf(page, htmlContent);

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
