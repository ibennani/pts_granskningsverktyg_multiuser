/**
 * @fileoverview Propagerar exportfel till nedladdningsknappens tillstånd (ingen falsk «klar»-status).
 */

import { is_download_file_too_large_error } from '../utils/download_filename_utils.js';
import { is_export_pdf_html_too_large_error } from './export_pdf_html_size_error.js';
import { is_export_pdf_failed_error } from './export_pdf_user_errors.js';

/**
 * Anropas i export-catch: valfritt meddelande för övriga fel, kasta alltid vidare.
 * Storleksfel får inget generiskt exportmeddelande här – knapp-UX visar rätt text.
 */
export function finalize_export_catch(error: unknown, notify?: (error: unknown) => void): never {
    if (
        !is_download_file_too_large_error(error) &&
        !is_export_pdf_html_too_large_error(error) &&
        !is_export_pdf_failed_error(error) &&
        notify
    ) {
        notify(error);
    }
    throw error;
}
