/**
 * Pilotstyrning: massåtgärden "sätt alla helt ogranskade till ingen anmärkning" per stickprov
 * ska endast vara tillgänglig för en namngiven inloggad användare tills funktionen rullas ut brett.
 */
import { get_current_user_name } from '../user/current_user.js';

export const SAMPLE_MARK_BULK_PASS_NOT_AUDITED_USERNAME = 'Ilias Bennani';

/**
 * Kräver exakt inloggningsnamnet Ilias Bennani (samma skiftläge och mellanslag som i konstanten); trim av inledande och avslutande mellanslag.
 * @param get_name Valfri override för tester; standard läser inloggat namn.
 */
export function user_may_use_sample_mark_bulk_pass_not_audited(
    get_name: () => string = get_current_user_name
): boolean {
    return get_name().trim() === SAMPLE_MARK_BULK_PASS_NOT_AUDITED_USERNAME;
}
