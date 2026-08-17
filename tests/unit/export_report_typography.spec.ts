/**
 * @fileoverview Enhetstester för gemensam typografi i Word- och PDF-export.
 */
import { describe, test, expect } from '@jest/globals';
import {
    build_report_pdf_print_css,
    PDF_EXPORT_FONT_SIZES_PT,
    PDF_AEONIK_FONT_FACE_PLACEHOLDER,
    REPORT_EXPORT_FONT_SIZES_PT,
    report_export_font_size_half_points,
} from '../../js/export/export_report_typography.ts';

describe('export_report_typography', () => {
    test('PDF-CSS använder Aeonik och PTS-storlekar (10/18/12 pt)', () => {
        const css = build_report_pdf_print_css();
        expect(css).toContain("'Aeonik'");
        expect(css).toContain(PDF_AEONIK_FONT_FACE_PLACEHOLDER);
        expect(css).not.toContain("'Calibri'");
        expect(css).not.toContain('Segoe UI');
        expect(css).not.toContain('Arial');
        expect(css).toContain(`font-size: ${PDF_EXPORT_FONT_SIZES_PT.body}pt`);
        expect(css).toContain(`font-size: ${PDF_EXPORT_FONT_SIZES_PT.heading1}pt`);
        expect(css).toContain(`font-size: ${PDF_EXPORT_FONT_SIZES_PT.heading2}pt`);
        expect(css).toContain('.comment-label');
        expect(css).toContain('#6E3282');
        expect(css).toMatch(/em,\s*i\s*\{[^}]*font-style:\s*normal/);
    });

    test('Word-konstanter för Calibri är oförändrade', () => {
        expect(REPORT_EXPORT_FONT_SIZES_PT.body).toBe(11);
        expect(REPORT_EXPORT_FONT_SIZES_PT.heading2).toBe(16);
    });

    test('half-points motsvarar docx-storlekar', () => {
        expect(report_export_font_size_half_points(11)).toBe(22);
        expect(report_export_font_size_half_points(18)).toBe(36);
    });
});
