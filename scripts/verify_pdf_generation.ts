/**
 * @fileoverview Snabb kontroll att Puppeteer kan skapa PDF (körs på server vid deploy).
 */

import { generate_pdf_from_html } from '../server/services/pdf_generation_service.ts';

const html = '<!DOCTYPE html><html lang="sv"><body><h1>PDF-test</h1></body></html>';
const buffer = await generate_pdf_from_html({ htmlContent: html });

if (buffer.length < 100 || buffer.subarray(0, 4).toString('utf8') !== '%PDF') {
    throw new Error('PDF-verifiering misslyckades: ogiltig utdata');
}

console.log(`[verify_pdf_generation] OK (${buffer.length} byte)`);
