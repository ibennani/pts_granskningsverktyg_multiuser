/**
 * @fileoverview Genererar taggade PDF:er från semantisk HTML via Puppeteer/Chromium.
 */
import puppeteer, { type Browser } from 'puppeteer';

export interface GeneratePdfInput {
    htmlContent: string;
    outputPath?: string;
}

/**
 * Renderar HTML till en taggad (tillgänglig) PDF.
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
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' } as { waitUntil: 'load' });

        const pdf_bytes = await page.pdf({
            format: 'A4',
            printBackground: true,
            tagged: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm',
            },
            ...(outputPath ? { path: outputPath } : {}),
        });

        return Buffer.from(pdf_bytes);
    } catch (error) {
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
