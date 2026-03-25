import crypto from 'crypto';

/**
 * Samma semantik som js/utils/export_integrity.js: SHA-256 av JSON utan exportIntegrity-fält.
 * @param {object} state
 * @returns {object}
 */
export function attach_export_integrity_server_payload(state) {
    const base = JSON.parse(JSON.stringify(state));
    delete base.exportIntegrity;
    const canonical = JSON.stringify(base, null, 2);
    const value = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
    return {
        ...base,
        exportIntegrity: {
            algorithm: 'SHA-256',
            value
        }
    };
}
