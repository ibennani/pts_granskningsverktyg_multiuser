/**
 * @fileoverview Snabb kontroll att Puppeteer kan skapa PDF (körs på server vid deploy).
 */

import { build_appendix1_pdf_print_css } from '../js/export/export_report_appendix1_print_css.ts';
import { generate_pdf_from_html } from '../server/services/pdf_generation_service.ts';

const html = '<!DOCTYPE html><html lang="sv"><body><h1>PDF-test</h1></body></html>';
const buffer = await generate_pdf_from_html({ htmlContent: html });

if (buffer.length < 100 || buffer.subarray(0, 4).toString('utf8') !== '%PDF') {
    throw new Error('PDF-verifiering misslyckades: ogiltig utdata');
}

const css = build_appendix1_pdf_print_css();
const appendix1_html = `<!DOCTYPE html><html lang="sv"><head><meta charset="utf-8"><style>${css}</style></head><body>
<main class="appendix1-document">
<section class="appendix1-cover" style="height:297mm;background:#333"></section>
<section class="appendix1-page appendix1-audit-info" id="section-audit-info"><h1>Info</h1></section>
<section class="appendix1-page appendix1-toc">
<nav><a class="appendix1-toc__link" href="#section-audit-info"><span class="appendix1-toc__page"></span></a></nav>
</section>
</main></body></html>`;

const appendix1_buffer = await generate_pdf_from_html({
    htmlContent: appendix1_html,
    documentKind: 'appendix1',
});

if (appendix1_buffer.length < 100 || appendix1_buffer.subarray(0, 4).toString('utf8') !== '%PDF') {
    throw new Error('PDF-verifiering misslyckades: Bilaga 1 ogiltig utdata');
}

console.log(`[verify_pdf_generation] OK default (${buffer.length} byte), appendix1 (${appendix1_buffer.length} byte)`);
