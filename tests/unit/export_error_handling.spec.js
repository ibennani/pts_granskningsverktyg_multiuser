import { jest } from '@jest/globals';
import { DownloadFileTooLargeError } from '../../js/utils/download_filename_utils.ts';
import { ExportPdfHtmlTooLargeError } from '../../js/export/export_pdf_html_size_error.ts';
import { ExportPdfFailedError } from '../../js/export/export_pdf_user_errors.ts';
import { finalize_export_catch } from '../../js/export/export_error_handling.ts';

describe('export_error_handling', () => {
    test('finalize_export_catch kastar storleksfel utan notify', () => {
        const notify = jest.fn();
        const err = new DownloadFileTooLargeError(30 * 1024 * 1024);

        expect(() => finalize_export_catch(err, notify)).toThrow(DownloadFileTooLargeError);
        expect(notify).not.toHaveBeenCalled();
    });

    test('finalize_export_catch kastar PDF-HTML-storleksfel utan notify', () => {
        const notify = jest.fn();
        const err = new ExportPdfHtmlTooLargeError(
            27 * 1024 * 1024,
            25 * 1024 * 1024,
            'export_screenshots_appendix_too_large'
        );

        expect(() => finalize_export_catch(err, notify)).toThrow(ExportPdfHtmlTooLargeError);
        expect(notify).not.toHaveBeenCalled();
    });

    test('finalize_export_catch kastar PDF-fel utan notify', () => {
        const notify = jest.fn();
        const err = new ExportPdfFailedError('Det gick inte att skapa PDF-filen. Försök igen om en stund.');

        expect(() => finalize_export_catch(err, notify)).toThrow(ExportPdfFailedError);
        expect(notify).not.toHaveBeenCalled();
    });

    test('finalize_export_catch anropar notify och kastar övriga fel', () => {
        const notify = jest.fn();
        const err = new Error('export_fail');

        expect(() => finalize_export_catch(err, notify)).toThrow(err);
        expect(notify).toHaveBeenCalledWith(err);
    });
});
