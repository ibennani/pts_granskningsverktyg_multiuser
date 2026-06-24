/**
 * @fileoverview Genererar taggade PDF:er med bokmärken (rubriknivå 1–3) från semantisk HTML via Puppeteer/Chromium.
 */
import puppeteer, { type Browser } from 'puppeteer';

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

async function render_pdf_buffer(page: Awaited<ReturnType<Browser['newPage']>>): Promise<Buffer> {
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

/**
 * Renderar HTML till en taggad (tillgänglig) PDF med dokumentbokmärken från h1–h3.
 * @returns PDF som Buffer
 */
export async function generate_pdf_from_html(input: GeneratePdfInput): Promise<Buffer> {
    const { htmlContent, outputPath } = input;
    let browser: Browser | undefined;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();

        // networkidle0 stöds av Chromium; typings i puppeteer kan vara snävare
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' } as unknown as Parameters<
            typeof page.setContent
        >[1]);

        const pdf_buffer = await render_pdf_buffer(page);

        if (outputPath) {
            const fs = await import('node:fs/promises');
            await fs.writeFile(outputPath, pdf_buffer);
        }

        return pdf_buffer;
    } catch (error) {
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
