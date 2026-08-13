/**
 * @fileoverview Fas 1 – identifiering av större sidblock per sidrapport.
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { structure_fingerprint_hash, build_structure_node_from_eval } from '../../../../shared/recurring/structure_fingerprint.js';
import { BROWSER_COLLECT_PAGE_BLOCK_CANDIDATES } from '../snapshot_analysis_browser_scripts_loader.js';

export type RecurringBlockCandidate = {
    candidateType: string;
    score: number;
    confidence: number;
    matchedSignals: string[];
    rootIdentity: string;
    boundingBox: { x: number; y: number; width: number; height: number } | null;
    structureFingerprint: string;
    ownership: string;
};

export async function run_page_block_detection_analysis(
    ctx: AnalysisContext
): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const candidates = await ctx.page.evaluate(BROWSER_COLLECT_PAGE_BLOCK_CANDIDATES);

    const with_fingerprint = (candidates as Array<Record<string, unknown>>).map((c) => {
        const node = build_structure_node_from_eval(
            (c.structureNode as { tagName?: string; role?: string | null; children?: Array<{ tagName?: string; role?: string | null }> }) || {}
        );
        return {
            ...c,
            structureFingerprint: structure_fingerprint_hash(node),
        };
    });

    return {
        module: 'page-blocks',
        version: 1,
        phase: 1,
        status: 'success',
        durationMs: Date.now() - started,
        recordCount: with_fingerprint.length,
        truncated: false,
        skipReason: null,
        warnings: [],
        data: { candidates: with_fingerprint },
    };
}
