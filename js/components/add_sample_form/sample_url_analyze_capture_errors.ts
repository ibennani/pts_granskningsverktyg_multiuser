/**
 * @fileoverview Felmeddelanden för Hämta information (sidtitel och skärmavbild).
 */

export type SampleUrlAnalyzeFetchErrorReason =
    | 'not_logged_in'
    | 'no_audit_id'
    | 'invalid_url';

type TranslationFn = (key: string) => string;

const REASON_I18N_KEY: Record<SampleUrlAnalyzeFetchErrorReason, string> = {
    not_logged_in: 'sample_url_analyze_error_not_logged_in',
    no_audit_id: 'sample_url_analyze_error_no_audit_id',
    invalid_url: 'sample_url_analyze_error_invalid_url',
};

/**
 * Returnerar ett användarvänligt meddelande för kända klientfel innan API-anrop.
 */
export function get_sample_url_analyze_fetch_error_message(
    t: TranslationFn,
    reason: SampleUrlAnalyzeFetchErrorReason
): string {
    return t(REASON_I18N_KEY[reason]);
}

/**
 * Plockar ut det mest användbara felmeddelandet från ett API- eller nätverksfel.
 */
export function extract_sample_url_analyze_fetch_error_detail(err: unknown): string {
    if (err instanceof Error) {
        const trimmed = String(err.message || '').trim();
        if (trimmed) {
            return trimmed;
        }
    }
    if (typeof err === 'string') {
        const trimmed = err.trim();
        if (trimmed) {
            return trimmed;
        }
    }
    return 'Okänt fel';
}
