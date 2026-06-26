/**
 * Tillgång till massåtgärden "sätt alla helt ogranskade till ingen anmärkning" per granskningsdel
 * när granskningen pågår.
 */

/**
 * @param _get_name Valfri override för tester; används inte längre för åtkomststyrning.
 * @param _get_auditor_name Valfri läsning av granskarens namn; används inte längre för åtkomststyrning.
 */
export function user_may_use_sample_mark_bulk_pass_not_audited(
    _get_name?: () => string,
    _get_auditor_name?: () => string | null | undefined
): boolean {
    return true;
}
