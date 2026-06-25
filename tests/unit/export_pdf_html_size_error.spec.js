import { PDF_EXPORT_HTML_MAX_BYTES } from '../../shared/constants/pdf_export_limits.js';
import {
    ExportPdfHtmlTooLargeError,
    assert_pdf_export_html_within_limit,
    build_export_pdf_html_too_large_message,
    is_export_pdf_html_too_large_error,
    normalize_export_pdf_html_too_large_error,
    utf8_byte_length,
} from '../../js/export/export_pdf_html_size_error.ts';

const t = (key, params) => {
    const map = {
        export_screenshots_appendix_too_large:
            'Bilagan med skärmbilder är för stor ({actual_size}). Maxgräns: {max_size}',
        export_pdf_html_too_large: 'Exporten är för stor ({actual_size}). Maxgräns: {max_size}',
    };
    let text = map[key] ?? key;
    if (params) {
        for (const [name, value] of Object.entries(params)) {
            text = text.replace(`{${name}}`, String(value));
        }
    }
    return text;
};

describe('export_pdf_html_size_error', () => {
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
            27 * 1024 * 1024,
            25 * 1024 * 1024,
            'export_screenshots_appendix_too_large'
        );
        const message = build_export_pdf_html_too_large_message(t, error);
        expect(message).toContain('Bilagan med skärmbilder är för stor');
        expect(message).toContain('27 MByte');
        expect(message).toContain('Maxgräns: 25 Mbyte');
        expect(message).not.toContain('htmlContent');
    });
});
