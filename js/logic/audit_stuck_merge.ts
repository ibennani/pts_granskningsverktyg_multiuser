/**
 * @fileoverview Bevarar lokala «kört fast»-texter vid merge mot serverstate.
 */

type RequirementResultLike = {
    stuckProblemDescription?: string;
    lastStatusUpdate?: string | null;
    lastStatusUpdateBy?: string | null;
};

type SampleLike = {
    id?: string | number;
    requirementResults?: Record<string, RequirementResultLike>;
};

function should_keep_local_stuck(
    local_result: RequirementResultLike,
    server_result: RequirementResultLike | undefined
): boolean {
    const local_stuck = String(local_result.stuckProblemDescription || '').trim();
    if (!local_stuck) return false;
    const server_stuck = String(server_result?.stuckProblemDescription || '').trim();
    if (!server_stuck) return true;
    const local_ts = local_result.lastStatusUpdate || '';
    const server_ts = server_result?.lastStatusUpdate || '';
    if (local_ts && server_ts) return local_ts > server_ts;
    if (local_ts && !server_ts) return true;
    return local_stuck !== server_stuck;
}

/**
 * Slår in lokala stuckProblemDescription i server-samples när lokalt innehåll är nyare.
 */
export function merge_local_stuck_into_server_samples(
    local_samples: SampleLike[] | null | undefined,
    server_samples: SampleLike[] | null | undefined
): SampleLike[] {
    if (!Array.isArray(server_samples)) return [];
    if (!Array.isArray(local_samples) || local_samples.length === 0) {
        return JSON.parse(JSON.stringify(server_samples)) as SampleLike[];
    }

    const merged = JSON.parse(JSON.stringify(server_samples)) as SampleLike[];
    const merged_by_id = new Map(merged.map((sample) => [String(sample.id), sample]));

    for (const local_sample of local_samples) {
        const sample_id = String(local_sample.id ?? '');
        if (!sample_id) continue;
        const target = merged_by_id.get(sample_id);
        if (!target) continue;

        const local_results = local_sample.requirementResults || {};
        if (!target.requirementResults) target.requirementResults = {};

        for (const [req_key, local_result] of Object.entries(local_results)) {
            if (!local_result || typeof local_result !== 'object') continue;
            const server_result = target.requirementResults[req_key];
            if (!should_keep_local_stuck(local_result, server_result)) continue;

            target.requirementResults[req_key] = {
                ...(server_result && typeof server_result === 'object' ? server_result : {}),
                stuckProblemDescription: String(local_result.stuckProblemDescription || ''),
                lastStatusUpdate: local_result.lastStatusUpdate ?? server_result?.lastStatusUpdate ?? null,
                lastStatusUpdateBy: local_result.lastStatusUpdateBy ?? server_result?.lastStatusUpdateBy ?? null
            };
        }
    }

    return merged;
}
