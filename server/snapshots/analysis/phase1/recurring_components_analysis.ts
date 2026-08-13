/**
 * @fileoverview Fas 1 – inventerar större kandidater för återkommande innehåll och konfigurerade innehållstyper.
 */
import { createHash } from 'node:crypto';
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { BROWSER_COLLECT_RECURRING_COMPONENT_CANDIDATES } from '../recurring/recurring_components_browser_scripts_loader.js';
import {
    collect_content_type_selector_evidence,
    collect_content_type_selector_evidence_by_root,
} from './content_type_selector_evidence.js';

function sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
}

export async function run_recurring_components_analysis(
    ctx: AnalysisContext
): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const warnings: string[] = [];
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

    let content_type_detection = {
        detectedContentTypeIds: [] as string[],
        evidence: [] as Array<Record<string, unknown>>,
        ruleCount: 0,
    };
    let content_type_detection_by_candidate: Array<Record<string, unknown>> = [];
    try {
        content_type_detection = await collect_content_type_selector_evidence(ctx.page, ctx.temp_dir);
        const roots = candidates
            .map((candidate, index) => ({
                key: `${String(candidate.candidateType || 'unknown')}:${index}`,
                domPath: String(candidate.domPath || '').trim(),
            }))
            .filter((root) => root.domPath);
        content_type_detection_by_candidate = await collect_content_type_selector_evidence_by_root(
            ctx.page,
            ctx.temp_dir,
            roots
        );
    } catch (error) {
        warnings.push(`content-type-selector-detection: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
        module: 'recurring-components',
        version: 3,
        phase: 1,
        status: warnings.length ? 'partial' : 'success',
        durationMs: Date.now() - started,
        recordCount: candidates.length + content_type_detection.evidence.length + content_type_detection_by_candidate.length,
        truncated: candidates.length >= 30,
        skipReason: null,
        warnings,
        data: {
            candidates,
            countsByType: by_type,
            detectionMode: 'deterministic-dom-heuristics',
            contentTypeDetection: content_type_detection,
            contentTypeDetectionByCandidate: content_type_detection_by_candidate,
        },
    };
}
