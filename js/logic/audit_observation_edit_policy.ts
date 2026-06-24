/**
 * @fileoverview Gemensam policy: när bristbeskrivning får redigeras i granskningen.
 */

/** Status där bristbeskrivning aldrig får redigeras. */
const OBSERVATION_EDIT_BLOCKED_STATUSES = new Set(['archived']);

/**
 * Sant för pågående och avslutad granskning; falskt när granskningen är arkiverad.
 */
export function can_edit_observation_detail(audit_status: string | null | undefined): boolean {
    if (!audit_status) {
        return true;
    }
    return !OBSERVATION_EDIT_BLOCKED_STATUSES.has(audit_status);
}
