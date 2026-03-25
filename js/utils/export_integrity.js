/**
 * SHA-256 av kanonisk JSON (utan exportIntegrity) för nedladdade granskningsfiler.
 * Verifiering: parsa JSON, ta bort exportIntegrity, stringify med indentation 2, hasha samma sträng.
 */

/**
 * @param {string} text
 * @returns {Promise<string>} hex
 */
export async function sha256_hex_of_utf8_string(text) {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
        throw new Error('Web Crypto saknas');
    }
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * @param {object} audit_data
 * @returns {Promise<object>} Kopia av audit_data med exportIntegrity satt
 */
export async function attach_export_integrity_to_audit_payload(audit_data) {
    const base = JSON.parse(JSON.stringify(audit_data));
    delete base.exportIntegrity;
    const canonical = JSON.stringify(base, null, 2);
    const value = await sha256_hex_of_utf8_string(canonical);
    return {
        ...base,
        exportIntegrity: {
            algorithm: 'SHA-256',
            value
        }
    };
}
