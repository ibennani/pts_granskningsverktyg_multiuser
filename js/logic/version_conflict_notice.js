/**
 * Beslut om vilket versionskonflikt-meddelande som ska visas efter omladdning från servern.
 * Vid samma användare som senast sparat (egen krock) returneras null — ingen notis.
 */

/**
 * @param {{ lastUpdatedBy?: string|null }} err - Felobjekt från api_patch vid 409
 * @param {string} current_user_name - Inloggad användares visningsnamn
 * @returns {null | { key: string, params?: Record<string, string> }}
 */
export function resolve_version_conflict_notice(err, current_user_name) {
    const has_field = err && Object.prototype.hasOwnProperty.call(err, 'lastUpdatedBy');
    const raw = has_field ? err.lastUpdatedBy : undefined;
    const by = raw !== null && raw !== undefined ? String(raw).trim() : '';
    const me = typeof current_user_name === 'string' ? current_user_name.trim() : '';
    if (by === '') {
        return { key: 'version_conflict_external_update' };
    }
    if (me !== '' && by.localeCompare(me, undefined, { sensitivity: 'accent' }) === 0) {
        return null;
    }
    return { key: 'version_conflict_other_user', params: { name: by } };
}
