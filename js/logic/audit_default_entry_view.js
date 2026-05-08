/**
 * Bestämmer förstavyn efter att en granskning laddats (hash upload, öppna från lista m.m.).
 * @module js/logic/audit_default_entry_view
 */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function has_non_empty_trimmed_string(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
}

/**
 * Sant om granskningsmetadata motsvarar sparat formulär med obligatoriska fält ifyllda
 * (samma regel som EditMetadataViewComponent._has_required_metadata).
 *
 * @param {object|null|undefined} full_state
 * @returns {boolean}
 */
export function has_saved_audit_metadata_for_navigation(full_state) {
    const meta = full_state?.auditMetadata;
    if (!meta || typeof meta !== 'object') return false;
    return (
        has_non_empty_trimmed_string(meta.actorName) &&
        has_non_empty_trimmed_string(meta.auditorName)
    );
}

/**
 * Standardvy efter att en granskning laddats (t.ex. upload-flöde eller öppna via audit-id).
 *
 * @param {object|null|undefined} full_state
 * @returns {string}
 */
export function default_view_for_loaded_audit_state(full_state) {
    if (!full_state) return 'audit_overview';
    const status = full_state.auditStatus || 'not_started';
    const samples = full_state.samples || [];
    if (status !== 'not_started') return 'audit_overview';
    if (has_saved_audit_metadata_for_navigation(full_state)) return 'sample_management';
    if (samples.length === 0) return 'sample_management';
    return 'metadata';
}
