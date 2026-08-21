/**
 * @fileoverview Gemensam typografi för Word- och PDF-export (sorterat på krav).
 * Word använder half-points i docx; PDF använder pt i print-CSS med Aeonik.
 */

import { get_screenshots_appendix_max_image_height_cm } from './export_screenshots_appendix_media.js';
import {
    PDF_AEONIK_FONT_FACE_PLACEHOLDER,
} from '../../shared/pdf/pdf_aeonik_font_faces.js';
import {
    PDF_EXPORT_FONT_FAMILY,
    PDF_EXPORT_FONT_SIZES_PT,
    build_pdf_font_stack,
} from '../../shared/pdf/pdf_export_typography_constants.js';

export { PDF_AEONIK_FONT_FACE_PLACEHOLDER };
export { PDF_EXPORT_FONT_FAMILY, PDF_EXPORT_FONT_SIZES_PT, build_pdf_font_stack };

export const REPORT_EXPORT_FONT_FAMILY = 'Calibri';

/** Punktstorlekar som matchar Word-stilarna Heading1–4 och brödtext. */
export const REPORT_EXPORT_FONT_SIZES_PT = {
    body: 11,
    heading1: 18,
    heading2: 16,
    heading3: 14,
    heading4: 12,
} as const;

export const REPORT_EXPORT_COLORS = {
    text: '000000',
    hyperlink: '0563C1',
    comment_label: '6E3282',
} as const;

/** Omvandlat från Word spacing (twips / 20). */
export const REPORT_EXPORT_SPACING_PT = {
    heading_before: 10,
    heading_after: 3,
    paragraph_after: 3,
    observation_paragraph_after: 12,
    comment_before: 6,
} as const;

/** docx-biblioteket anger fontstorlek i half-points. */
export function report_export_font_size_half_points(size_pt: number): number {
    return size_pt * 2;
}

/** Print-CSS med Aeonik och PTS-typografihierarki för huvudrapport och bilaga 3. */
export function build_report_pdf_print_css(): string {
    const font_stack = build_pdf_font_stack();
    const { body, heading1, heading2 } = PDF_EXPORT_FONT_SIZES_PT;
    const { heading_before, heading_after, paragraph_after, comment_before } = REPORT_EXPORT_SPACING_PT;
    const { hyperlink, comment_label } = REPORT_EXPORT_COLORS;
    const screenshots_max_height_cm = get_screenshots_appendix_max_image_height_cm();

    return `
${PDF_AEONIK_FONT_FACE_PLACEHOLDER}
body, main { font-family: ${font_stack}; font-size: ${body}pt; line-height: 1.15; color: #${REPORT_EXPORT_COLORS.text}; margin: 0; }
main { max-width: 100%; }
h1, h2, h3 { font-family: ${font_stack}; font-weight: 700; color: #${REPORT_EXPORT_COLORS.text}; }
h1 { font-size: ${heading1}pt; margin: ${heading_before}pt 0 ${heading_after}pt; }
h2 { font-size: ${heading1}pt; margin: ${heading_before}pt 0 ${heading_after}pt; page-break-before: always; }
h3 { font-size: ${heading2}pt; margin: ${heading_before}pt 0 ${heading_after}pt; }
h3 a { font-weight: 700; color: #${hyperlink}; }
p { margin: 0 0 ${paragraph_after}pt; }
p.comment-block { margin-top: ${comment_before}pt; }
.comment-label { font-weight: 700; color: #${comment_label}; }
a { color: #${hyperlink}; text-decoration: underline; }
strong { font-weight: 700; }
em, i { font-style: normal; font-weight: inherit; }
ul { margin: 0 0 ${paragraph_after}pt; padding-left: 1.2em; list-style: disc; }
ol { margin: 0 0 ${paragraph_after}pt; padding-left: 1.2em; list-style: decimal; }
ol[type="a"] { list-style: lower-alpha; }
li { margin: 0 0 ${paragraph_after}pt; }
.deficiency-types-appendix h2:first-of-type { page-break-before: auto; }
.screenshots-appendix h2 { page-break-before: auto; page-break-after: avoid; break-after: avoid; text-align: left; }
.screenshots-appendix__item { page-break-inside: avoid; break-inside: avoid; margin: 0 0 ${paragraph_after}pt; }
.screenshots-appendix__item img { display: block; max-width: 100%; max-height: ${screenshots_max_height_cm}cm; width: auto; height: auto; object-fit: contain; page-break-before: avoid; break-before: avoid; }
`.trim();
}
