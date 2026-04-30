/**
 * @fileoverview SHA-256 av normaliserad audit för HTML-exportmetadata.
 */

export async function calculate_audit_hash(audit_data: Record<string, unknown> | null | undefined): Promise<string | null> {
    try {
        if (!audit_data) return null;
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

        if (window.crypto && window.crypto.subtle) {
            const encoder = new TextEncoder();
            const data = encoder.encode(data_string);
            const hash_buffer = await window.crypto.subtle.digest('SHA-256', data);
            const hash_array = Array.from(new Uint8Array(hash_buffer));
            const hash_hex = hash_array.map((b) => b.toString(16).padStart(2, '0')).join('');
            return hash_hex;
        }
        let hash = 0;
        for (let i = 0; i < data_string.length; i++) {
            const char = data_string.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    } catch (error: unknown) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[ExportLogic] Error calculating hash:', error);
        return null;
    }
}
