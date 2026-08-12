/**
 * @fileoverview Fas 1 – inventerar större kandidater för återkommande innehåll.
 */
import { createHash } from 'node:crypto';
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { BROWSER_COLLECT_RECURRING_COMPONENT_CANDIDATES } from '../recurring/recurring_components_browser_scripts_loader.js';

function sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
}

export async function run_recurring_components_analysis(
    ctx: AnalysisContext
): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const raw = await ctx.page.evaluate(BROWSER_COLLECT_RECURRING_COMPONENT_CANDIDATES);
    const candidates = (Array.isArray(raw) ? raw : []).map((candidate) => {
        const record = candidate as Record<string, unknown>;
        const structure = typeof record.structure === 'string' ? record.structure : '';
        const fingerprint = structure ? sha256(structure) : null;
        const next = { ...record, structureFingerprint: fingerprint };
        delete next.structure;
        return next;
    });

    const by_type: Record<string, number> = {};
    for (const candidate of candidates) {
        const type = String(candidate.candidateType || 'unknown');
        by_type[type] = (by_type[type] || 0) + 1;
    }

    return {
        module: 'recurring-components',
        version: 1,
        phase: 1,
        status: 'success',
        durationMs: Date.now() - started,
        recordCount: candidates.length,
        truncated: candidates.length >= 30,
        skipReason: null,
        warnings: [],
        data: {
            candidates,
            countsByType: by_type,
            detectionMode: 'deterministic-dom-heuristics',
        },
    };
}
