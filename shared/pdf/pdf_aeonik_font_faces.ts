/**
 * @fileoverview Delade konstanter för Aeonik i PDF-export (klient-CSS och serverinjektion).
 */

/** Platshållare i print-CSS som servern byter till @font-face med inbäddade WOFF2. */
export const PDF_AEONIK_FONT_FACE_PLACEHOLDER = '{{PDF_AEONIK_FONT_FACE}}';

export const PDF_AEONIK_FONT_FAMILY = 'Aeonik';

export const PDF_AEONIK_FONT_FILES = {
    regular: 'Aeonik-Regular.woff2',
    bold: 'Aeonik-Bold.woff2',
} as const;
