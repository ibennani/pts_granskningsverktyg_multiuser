/**
 * @fileoverview PDF-typografikonstanter (Aeonik-storlekar) delade mellan export-CSS och server.
 */

export const PDF_EXPORT_FONT_FAMILY = 'Aeonik';

/** PDF: Aeonik-hierarki (nivå 1 = 18 pt, nivå 2 = 12 pt, brödtext = 10 pt). */
export const PDF_EXPORT_FONT_SIZES_PT = {
    body: 10,
    heading1: 18,
    heading2: 12,
    cover_title: 32,
    cover_subtitle: 18,
    metadata: 9,
    toc_entry: 10,
} as const;

export function build_pdf_font_stack(): string {
    return `'${PDF_EXPORT_FONT_FAMILY}', sans-serif`;
}
