/**
 * Pilotstyrning: massåtgärden "sätt alla helt ogranskade till ingen anmärkning" per stickprov
 * ska endast vara tillgänglig för en namngiven inloggad användare som också är angiven granskare
 * i granskningens metadata, tills funktionen rullas ut brett.
 */
import { get_current_user_name } from '../user/current_user.js';

export const SAMPLE_MARK_BULK_PASS_NOT_AUDITED_USERNAME = 'Ilias Bennani';

/**
 * Kräver exakt inloggningsnamnet Ilias Bennani (samma skiftläge och mellanslag som i konstanten); trim av inledande och avslutande mellanslag.
 * Om `get_auditor_name` anges måste granskarens namn i metadata (`auditorName`) matcha samma sträng.
 *
 * @param get_name Valfri override för tester; utelämnas eller undefined → läser inloggat namn.
 * @param get_auditor_name Valfri läsning av granskarens namn från aktuell granskning; används i produktion.
 */
export function user_may_use_sample_mark_bulk_pass_not_audited(
    get_name?: () => string,
    get_auditor_name?: () => string | null | undefined
): boolean {
    const resolve_logged_in_name = get_name ?? get_current_user_name;
    if (resolve_logged_in_name().trim() !== SAMPLE_MARK_BULK_PASS_NOT_AUDITED_USERNAME) {
        return false;
    }
    if (typeof get_auditor_name === 'function') {
        return String(get_auditor_name() ?? '').trim() === SAMPLE_MARK_BULK_PASS_NOT_AUDITED_USERNAME;
    }
    return true;
}
