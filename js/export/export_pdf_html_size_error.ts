/**
 * @fileoverview Fel när PDF-export-HTML överskrider maxgräns (klient eller server).
 */

import {
    PDF_EXPORT_HTML_MAX_BYTES,
    format_pdf_export_actual_size_label,
    format_pdf_export_max_size_label,
} from '../../shared/constants/pdf_export_limits.js';

export { PDF_EXPORT_HTML_MAX_BYTES } from '../../shared/constants/pdf_export_limits.js';

export const PDF_EXPORT_HTML_TOO_LARGE_CODE = 'PDF_EXPORT_HTML_TOO_LARGE';

export type ExportPdfHtmlTooLargeMessageKey =
    | 'export_screenshots_appendix_too_large'
    | 'export_pdf_html_too_large';

export class ExportPdfHtmlTooLargeError extends Error {
    readonly code = PDF_EXPORT_HTML_TOO_LARGE_CODE;

    constructor(
        public readonly byte_size: number,
        public readonly max_bytes: number = PDF_EXPORT_HTML_MAX_BYTES,
        public readonly message_key: ExportPdfHtmlTooLargeMessageKey = 'export_pdf_html_too_large'
    ) {
        super(PDF_EXPORT_HTML_TOO_LARGE_CODE);
        this.name = 'ExportPdfHtmlTooLargeError';
    }
}

type ApiLikeError = {
    code?: string;
    byte_size?: number;
    max_bytes?: number;
    message?: string;
    status?: number;
};

export function utf8_byte_length(text: string): number {
    if (typeof Buffer !== 'undefined') {
        return Buffer.byteLength(text, 'utf8');
    }
    return new TextEncoder().encode(text).length;
}

export function assert_pdf_export_html_within_limit(
    html_content: string,
    message_key: ExportPdfHtmlTooLargeMessageKey
): void {
    const byte_size = utf8_byte_length(html_content);
    if (byte_size > PDF_EXPORT_HTML_MAX_BYTES) {
        throw new ExportPdfHtmlTooLargeError(byte_size, PDF_EXPORT_HTML_MAX_BYTES, message_key);
    }
}

export function is_export_pdf_html_too_large_error(
    error: unknown
): error is ExportPdfHtmlTooLargeError {
    if (error instanceof ExportPdfHtmlTooLargeError) return true;
    if (error && typeof error === 'object' && 'code' in error) {
        return (error as { code?: string }).code === PDF_EXPORT_HTML_TOO_LARGE_CODE;
    }
    return false;
}

export function normalize_export_pdf_html_too_large_error(
    error: unknown,
    message_key: ExportPdfHtmlTooLargeMessageKey
): ExportPdfHtmlTooLargeError | null {
    if (is_export_pdf_html_too_large_error(error)) {
        if (error.message_key === message_key) return error;
        return new ExportPdfHtmlTooLargeError(error.byte_size, error.max_bytes, message_key);
    }
    if (!error || typeof error !== 'object') return null;
    const api_err = error as ApiLikeError;
    if (api_err.code !== PDF_EXPORT_HTML_TOO_LARGE_CODE) return null;
    const byte_size = typeof api_err.byte_size === 'number' ? api_err.byte_size : 0;
    const max_bytes =
        typeof api_err.max_bytes === 'number' ? api_err.max_bytes : PDF_EXPORT_HTML_MAX_BYTES;
    return new ExportPdfHtmlTooLargeError(byte_size, max_bytes, message_key);
}

export function build_export_pdf_html_too_large_message(
    t: (key: string, params?: Record<string, string>) => string,
    error: ExportPdfHtmlTooLargeError
): string {
    return t(error.message_key, {
        actual_size: format_pdf_export_actual_size_label(error.byte_size),
        max_size: format_pdf_export_max_size_label(error.max_bytes),
    });
}
