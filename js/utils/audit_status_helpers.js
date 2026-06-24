/**
 * Hjälpfunktioner för granskningsstatus (enum oförändrad: not_started, in_progress, locked, archived).
 */

export function audit_status_is_exportable(status) {
    return status === 'locked' || status === 'archived';
}

export function audit_status_is_fully_readonly(status) {
    return status === 'archived';
}

/** Sant om granskningsmetadata får redigeras (pågående eller avslutad, ej arkiverad). */
export function audit_status_allows_metadata_edit(status) {
    return status === 'in_progress' || status === 'locked';
}

export function audit_status_blocks_sample_and_requirement_edits(status) {
    return status === 'locked' || status === 'archived';
}

/** Sant om erbjudande om nyare regelfil (knapp/banner) ska döljas. Endast pågående granskning får uppdatera regelfil. */
export function audit_status_blocks_rulefile_update_offer(status) {
    return status !== 'in_progress';
}
