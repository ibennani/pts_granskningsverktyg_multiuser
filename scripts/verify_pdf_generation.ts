/**
 * @fileoverview Snabb kontroll att Puppeteer kan skapa PDF (körs på server vid deploy).
 */

import { PDF_AEONIK_FONT_FACE_PLACEHOLDER } from '../shared/pdf/pdf_aeonik_font_faces.ts';
import { build_appendix1_pdf_print_css } from '../js/export/export_report_appendix1_print_css.ts';
import { inject_pdf_font_faces } from '../server/services/pdf_font_faces.ts';
import { generate_pdf_from_html } from '../server/services/pdf_generation_service.ts';

const main_html = `<!DOCTYPE html><html lang="sv"><head><meta charset="utf-8"><style>${PDF_AEONIK_FONT_FACE_PLACEHOLDER}body{font-family:'Aeonik',sans-serif;}</style></head><body><h1>PDF-test</h1></body></html>`;
const main_buffer = await generate_pdf_from_html({ htmlContent: main_html });

if (main_buffer.length < 100 || main_buffer.subarray(0, 4).toString('utf8') !== '%PDF') {
    throw new Error('PDF-verifiering misslyckades: ogiltig utdata');
}

const injected_main = inject_pdf_font_faces(main_html);
if (!injected_main.includes('@font-face') || !injected_main.includes("font-family: 'Aeonik'")) {
    throw new Error('PDF-verifiering misslyckades: Aeonik @font-face saknas efter injektion');
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

console.log(`[verify_pdf_generation] OK default (${main_buffer.length} byte), appendix1 (${appendix1_buffer.length} byte)`);
