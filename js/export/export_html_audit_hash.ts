// @ts-nocheck
/**
 * @fileoverview SHA-256 av normaliserad audit för HTML-exportmetadata.
 */

export async function calculate_audit_hash(audit_data) {
    try {
        // Skapa en normaliserad kopia av audit-data för hash-beräkning
        // Ta bort metadata som inte påverkar innehållet (som timestamps för export)
        const normalized_data = {
            auditMetadata: audit_data.auditMetadata,
            auditStatus: audit_data.auditStatus,
            startTime: audit_data.startTime,
            endTime: audit_data.endTime,
            samples: audit_data.samples,
            deficiencyCounter: audit_data.deficiencyCounter,
            ruleFileContent: audit_data.ruleFileContent
        };
        
        const data_string = JSON.stringify(normalized_data);
        
        // Använd Web Crypto API för SHA-256 hash
        if (window.crypto && window.crypto.subtle) {
            const encoder = new TextEncoder();
            const data = encoder.encode(data_string);
            const hash_buffer = await window.crypto.subtle.digest('SHA-256', data);
            const hash_array = Array.from(new Uint8Array(hash_buffer));
            const hash_hex = hash_array.map(b => b.toString(16).padStart(2, '0')).join('');
            return hash_hex;
        } else {
            // Fallback: Enkel hash för äldre webbläsare (mindre säker men fungerar)
            let hash = 0;
            for (let i = 0; i < data_string.length; i++) {
                const char = data_string.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Konvertera till 32-bit integer
            }
            return Math.abs(hash).toString(16);
        }
    } catch (error) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[ExportLogic] Error calculating hash:', error);
        return null;
    }
}

