import {
    ExportPdfFailedError,
    resolve_pdf_export_user_message,
    throw_pdf_export_user_error,
} from '../../js/export/export_pdf_user_errors.ts';

const t = (key) => {
    const map = {
        export_pdf_generation_failed: 'Det gick inte att skapa PDF-filen. Försök igen om en stund.',
        export_pdf_audit_not_found:
            'Granskningen kunde inte hittas på servern. Kontrollera att den är sparad.',
        export_pdf_failed: 'Det gick inte att exportera till PDF. Försök igen.',
        auth_session_expired: 'Din inloggning har gått ut. Logga in igen.',
    };
    return map[key] ?? key;
};

describe('export_pdf_user_errors', () => {
    test('resolve_pdf_export_user_message tolkar serverfel utan dubbel prefix', () => {
        const api_error = Object.assign(new Error('PDF_EXPORT_GENERATION_FAILED'), {
            code: 'PDF_EXPORT_GENERATION_FAILED',
            status: 500,
        });
        const message = resolve_pdf_export_user_message(
            t,
            api_error,
            'export_pdf_html_too_large'
        );
        expect(message).toBe('Det gick inte att skapa PDF-filen. Försök igen om en stund.');
        expect(message).not.toContain('Fel vid export');
        expect(message).not.toContain('htmlContent');
    });

    test('resolve_pdf_export_user_message känner igen legacy servertext', () => {
        const message = resolve_pdf_export_user_message(
            t,
            new Error('Kunde inte exportera PDF'),
            'export_pdf_html_too_large'
        );
        expect(message).toBe('Det gick inte att skapa PDF-filen. Försök igen om en stund.');
    });

    test('throw_pdf_export_user_error kastar ExportPdfFailedError', () => {
        expect(() =>
            throw_pdf_export_user_error(
                t,
                Object.assign(new Error('PDF_EXPORT_GENERATION_FAILED'), {
                    code: 'PDF_EXPORT_GENERATION_FAILED',
                }),
                'export_pdf_html_too_large'
            )
        ).toThrow(ExportPdfFailedError);
    });
});
