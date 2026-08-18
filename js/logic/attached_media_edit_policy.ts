/**
 * @fileoverview Policy för knappen «Redigera bifogad media» i avslutad granskning.
 * Tillfällig lösning under bildmigrering — ta bort filen när den inte längre behövs.
 */

/** Tillfälligt: visa redigera-knapp även när granskningen är avslutad eller arkiverad. */
export const TEMP_ALLOW_EDIT_ATTACHED_MEDIA_WHEN_AUDIT_CLOSED = true;

/**
 * Sant när knappen «Redigera bifogad media» ska visas i UI.
 */
export function should_show_edit_attached_media_button(is_audit_locked: boolean): boolean {
    if (TEMP_ALLOW_EDIT_ATTACHED_MEDIA_WHEN_AUDIT_CLOSED) {
        return true;
    }
    return !is_audit_locked;
}
