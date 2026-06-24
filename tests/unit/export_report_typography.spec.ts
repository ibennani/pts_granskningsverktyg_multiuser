/**
 * @fileoverview Enhetstester för gemensam typografi i Word- och PDF-export.
 */
import { describe, test, expect } from '@jest/globals';
import {
    build_report_pdf_print_css,
    REPORT_EXPORT_FONT_SIZES_PT,
    report_export_font_size_half_points,
} from '../../js/export/export_report_typography.ts';

describe('export_report_typography', () => {
    test('PDF-CSS använder Calibri och samma rubrikstorlekar som Word', () => {
        const css = build_report_pdf_print_css();
        expect(css).toContain("'Calibri'");
        expect(css).toContain(`font-size: ${REPORT_EXPORT_FONT_SIZES_PT.body}pt`);
        expect(css).toContain(`font-size: ${REPORT_EXPORT_FONT_SIZES_PT.heading1}pt`);
        expect(css).toContain(`font-size: ${REPORT_EXPORT_FONT_SIZES_PT.heading2}pt`);
        expect(css).toContain(`font-size: ${REPORT_EXPORT_FONT_SIZES_PT.heading3}pt`);
        expect(css).toContain('.comment-label');
        expect(css).toContain('#6E3282');
    });

    test('half-points motsvarar docx-storlekar', () => {
        expect(report_export_font_size_half_points(11)).toBe(22);
        expect(report_export_font_size_half_points(18)).toBe(36);
    });
});
