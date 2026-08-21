import {
    PDF_EXPORT_HTML_MAX_BYTES,
    SCREENSHOTS_APPENDIX_PDF_MAX_BYTES,
} from '../../shared/constants/pdf_export_limits.js';
import {
    ExportPdfHtmlTooLargeError,
    assert_pdf_export_html_within_limit,
    build_export_pdf_html_too_large_message,
    is_export_pdf_html_too_large_error,
    normalize_export_pdf_html_too_large_error,
    utf8_byte_length,
} from '../../js/export/export_pdf_html_size_error.ts';
import { set_language } from '../../js/translation_logic.ts';

describe('export_pdf_html_size_error', () => {
    beforeAll(async () => {
        await set_language('sv-SE');
    });
    test('assert_pdf_export_html_within_limit kastar med rätt storlek', () => {
        const over_limit = 'x'.repeat(PDF_EXPORT_HTML_MAX_BYTES + 1);
        expect(() =>
            assert_pdf_export_html_within_limit(over_limit, 'export_screenshots_appendix_too_large')
        ).toThrow(ExportPdfHtmlTooLargeError);

        try {
            assert_pdf_export_html_within_limit(over_limit, 'export_screenshots_appendix_too_large');
        } catch (error) {
            expect(is_export_pdf_html_too_large_error(error)).toBe(true);
            if (error instanceof ExportPdfHtmlTooLargeError) {
                expect(error.byte_size).toBe(utf8_byte_length(over_limit));
                expect(error.max_bytes).toBe(PDF_EXPORT_HTML_MAX_BYTES);
                expect(error.message_key).toBe('export_screenshots_appendix_too_large');
            }
        }
    });

    test('normalize_export_pdf_html_too_large_error tolkar API-svar', () => {
        const api_error = {
            code: 'PDF_EXPORT_HTML_TOO_LARGE',
            byte_size: 27 * 1024 * 1024,
            max_bytes: PDF_EXPORT_HTML_MAX_BYTES,
        };
        const normalized = normalize_export_pdf_html_too_large_error(
            api_error,
            'export_screenshots_appendix_too_large'
        );
        expect(normalized).toBeInstanceOf(ExportPdfHtmlTooLargeError);
        expect(normalized?.message_key).toBe('export_screenshots_appendix_too_large');
    });

    test('build_export_pdf_html_too_large_message använder klartext', () => {
        const error = new ExportPdfHtmlTooLargeError(
            22 * 1024 * 1024,
            SCREENSHOTS_APPENDIX_PDF_MAX_BYTES,
            'export_screenshots_appendix_too_large'
        );
        const message = build_export_pdf_html_too_large_message(() => '', error);
        expect(message).toContain('Bilagan med skärmbilder är för stor');
        expect(message).toContain('22 MByte');
        expect(message).toContain('Maxgräns: 20 Mbyte');
        expect(message).not.toContain('htmlContent');
    });
});
