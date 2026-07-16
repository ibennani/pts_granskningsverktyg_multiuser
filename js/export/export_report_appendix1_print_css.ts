/**
 * @fileoverview Print-CSS för Bilaga 1 (PTS-layout, Cambria, 25 mm marginaler).
 */

export const APPENDIX1_COVER_IMAGE_PLACEHOLDER = '{{APPENDIX1_COVER_SRC}}';

export const APPENDIX1_PDF_MARGIN_MM = 25;

/** Omvandlar mm till tum för Puppeteer printToPDF. */
export function appendix1_pdf_margin_inches(): number {
    return APPENDIX1_PDF_MARGIN_MM / 25.4;
}

export function build_appendix1_pdf_print_css(): string {
    const margin_mm = APPENDIX1_PDF_MARGIN_MM;
    return `
@page {
    size: A4 portrait;
    margin: ${margin_mm}mm;
}
@page :first {
    margin: 0;
}
body, main {
    font-family: Cambria, Georgia, 'Times New Roman', serif;
    font-size: 10pt;
    line-height: 1.4;
    color: #000000;
    margin: 0;
}
main.appendix1-document {
    max-width: 100%;
}
.appendix1-cover {
    position: relative;
    width: 210mm;
    min-height: 297mm;
    page-break-after: always;
    break-after: page;
    overflow: hidden;
    margin: 0;
    padding: 0;
}
.appendix1-cover__image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.appendix1-cover__content {
    position: relative;
    z-index: 1;
    padding: 25mm 25mm 0;
    color: #ffffff;
}
.appendix1-cover__meta-row {
    display: flex;
    justify-content: space-between;
    font-size: 9pt;
    margin: 0 0 4pt;
}
.appendix1-cover__title {
    font-size: 32pt;
    font-weight: 700;
    margin: 18mm 0 0;
    line-height: 1.15;
}
.appendix1-cover__subtitle {
    font-size: 18pt;
    font-weight: 700;
    margin: 6mm 0 0;
}
.appendix1-page {
    page-break-before: always;
    break-before: page;
}
.appendix1-page:first-of-type {
    page-break-before: auto;
    break-before: auto;
}
h1, h2 {
    font-family: Cambria, Georgia, 'Times New Roman', serif;
    font-weight: 700;
    color: #000000;
    margin: 0 0 8pt;
}
h1 {
    font-size: 18pt;
}
h2 {
    font-size: 12pt;
}
p {
    margin: 0 0 8pt;
}
.appendix1-audit-info dl {
    margin: 12mm 0 0;
}
.appendix1-audit-info dt {
    font-weight: 700;
    margin: 0;
}
.appendix1-audit-info dd {
    margin: 0 0 8pt;
}
.appendix1-toc-title {
    font-size: 18pt;
    font-weight: 700;
    margin: 0 0 12mm;
}
.appendix1-toc nav ul {
    list-style: none;
    margin: 0;
    padding: 0;
}
.appendix1-toc nav li {
    margin: 0 0 6pt;
    display: flex;
    gap: 8pt;
}
.appendix1-toc nav li.appendix1-toc__item--level-2 {
    padding-left: 15mm;
}
.appendix1-toc nav a {
    color: #000000;
    text-decoration: none;
    flex: 1 1 auto;
}
.appendix1-toc nav .appendix1-toc__leader {
    flex: 1 1 auto;
    border-bottom: 1pt dotted #000000;
    min-width: 12pt;
    margin: 0 4pt;
    transform: translateY(-2pt);
}
.appendix1-section {
    margin: 0 0 8pt;
}
.appendix1-section__content ul {
    margin: 0 0 8pt;
    padding-left: 12.7mm;
    list-style: disc;
}
.appendix1-section__content li {
    margin: 0 0 4pt;
}
.appendix1-deficiency-list ul {
    margin: 0 0 8pt;
    padding-left: 12.7mm;
    list-style: disc;
}
.appendix1-deficiency-list li {
    margin: 0 0 4pt;
}
a {
    color: #6E3282;
    text-decoration: underline;
}
strong {
    font-weight: 700;
}
`.trim();
}
