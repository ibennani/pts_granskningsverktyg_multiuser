/**
 * @fileoverview Användarvänliga felmeddelanden vid PDF-export (utöver storleksgräns).
 */

import {
    build_export_pdf_html_too_large_message,
    is_export_pdf_html_too_large_error,
    normalize_export_pdf_html_too_large_error,
    type ExportPdfHtmlTooLargeError,
    type ExportPdfHtmlTooLargeMessageKey,
} from './export_pdf_html_size_error.js';

export const PDF_EXPORT_GENERATION_FAILED_CODE = 'PDF_EXPORT_GENERATION_FAILED';
export const PDF_EXPORT_AUDIT_NOT_FOUND_CODE = 'PDF_EXPORT_AUDIT_NOT_FOUND';
export const PDF_EXPORT_FAILED_CODE = 'PDF_EXPORT_FAILED';

export class ExportPdfFailedError extends Error {
    readonly code = PDF_EXPORT_FAILED_CODE;

    constructor(public readonly user_message: string) {
        super(PDF_EXPORT_FAILED_CODE);
        this.name = 'ExportPdfFailedError';
    }
}

type ApiLikeError = {
    code?: string;
    status?: number;
    message?: string;
};

function read_api_error(error: unknown): ApiLikeError {
    if (!error || typeof error !== 'object') return {};
    const record = error as Record<string, unknown>;
    return {
        code: typeof record.code === 'string' ? record.code : undefined,
        status: typeof record.status === 'number' ? record.status : undefined,
        message: error instanceof Error ? error.message : undefined,
    };
}

function is_legacy_generation_failed_message(message: string): boolean {
    const normalized = message.trim().toLowerCase();
    return (
        normalized === 'kunde inte exportera pdf' ||
        normalized === 'pdf_export_generation_failed'
    );
}

export function is_export_pdf_failed_error(error: unknown): error is ExportPdfFailedError {
    if (error instanceof ExportPdfFailedError) return true;
    if (error && typeof error === 'object' && 'code' in error) {
        return (error as { code?: string }).code === PDF_EXPORT_FAILED_CODE;
    }
    return false;
}

export function resolve_pdf_export_user_message(
    t: (key: string, params?: Record<string, string>) => string,
    error: unknown,
    size_message_key: ExportPdfHtmlTooLargeMessageKey
): string {
    const size_error = normalize_export_pdf_html_too_large_error(error, size_message_key);
    if (size_error) {
        return build_export_pdf_html_too_large_message(t, size_error);
    }

    const api_err = read_api_error(error);
    const message = api_err.message ?? (error instanceof Error ? error.message : '');

    if (api_err.status === 401) {
        return t('auth_session_expired');
    }
    if (
        api_err.status === 404 ||
        api_err.code === PDF_EXPORT_AUDIT_NOT_FOUND_CODE
    ) {
        return t('export_pdf_audit_not_found');
    }
    if (
        api_err.code === PDF_EXPORT_GENERATION_FAILED_CODE ||
        is_legacy_generation_failed_message(message)
    ) {
        return t('export_pdf_generation_failed');
    }

    return t('export_pdf_failed');
}

export function throw_pdf_export_user_error(
    t: (key: string, params?: Record<string, string>) => string,
    error: unknown,
    size_message_key: ExportPdfHtmlTooLargeMessageKey
): never {
    if (is_export_pdf_html_too_large_error(error)) {
        throw error;
    }
    const normalized_size = normalize_export_pdf_html_too_large_error(error, size_message_key);
    if (normalized_size) {
        throw normalized_size;
    }
    throw new ExportPdfFailedError(resolve_pdf_export_user_message(t, error, size_message_key));
}

export type { ExportPdfHtmlTooLargeError, ExportPdfHtmlTooLargeMessageKey };
