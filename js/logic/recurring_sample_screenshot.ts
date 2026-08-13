/**
 * @fileoverview Försöker skapa skärmdump för återkommande granskningsdel via evidens-sidrapporter.
 */
import { create_recurring_block_screenshot } from '../api/audit_snapshot_api.js';

export async function resolve_recurring_sample_screenshot_filename(
    audit_id: string,
    input: {
        label: string;
        candidateType: string;
        structureFingerprint: string;
        rootIdentity?: string;
        captureIds?: string[];
    }
): Promise<string | null> {
    const capture_ids = (input.captureIds ?? []).map((id) => String(id).trim()).filter(Boolean);
    for (const capture_id of capture_ids) {
        try {
            const result = await create_recurring_block_screenshot(audit_id, {
                captureId: capture_id,
                candidateType: input.candidateType,
                structureFingerprint: input.structureFingerprint,
                rootIdentity: input.rootIdentity,
                label: input.label,
            });
            if (result.filename) {
                return result.filename;
            }
        } catch {
            // prova nästa evidens-sidrapporter
        }
    }
    return null;
}
