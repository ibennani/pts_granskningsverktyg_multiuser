/**
 * @fileoverview Fas 1 – identifiering av större sidblock per sidrapport.
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { structure_fingerprint_hash, build_structure_node_from_eval } from '../../../../shared/recurring/structure_fingerprint.js';

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

const SKIP_LINK_RE = /skip|hoppa.*innehåll/i;

export async function run_page_block_detection_analysis(
    ctx: AnalysisContext
): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const candidates = await ctx.page.evaluate(() => {
        const results: Array<Record<string, unknown>> = [];

        function bbox(el: Element) {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
        }

        function child_summary(el: Element) {
            return Array.from(el.children)
                .slice(0, 12)
                .map((c) => ({
                    tagName: c.tagName.toLowerCase(),
                    role: c.getAttribute('role'),
                }));
        }

        function push_candidate(
            el: Element,
            candidateType: string,
            signals: string[],
            ownership: string,
            score: number
        ) {
            const text = (el.textContent || '').trim();
            if (SKIP_LINK_RE.test(text) && text.length < 80) return;
            const id = el.id ? `#${el.id}` : el.tagName.toLowerCase();
            results.push({
                candidateType,
                score,
                confidence: Math.min(score, 1),
                matchedSignals: signals,
                rootIdentity: id,
                boundingBox: bbox(el),
                structureNode: {
                    tagName: el.tagName.toLowerCase(),
                    role: el.getAttribute('role'),
                    children: child_summary(el),
                },
                ownership,
            });
        }

        const header = document.querySelector('header,[role="banner"]');
        if (header) push_candidate(header, 'header', ['semantic-header'], 'header', 0.9);

        const nav = document.querySelector('nav,[role="navigation"]');
        if (nav) push_candidate(nav, 'menu', ['semantic-nav'], 'menu', 0.85);

        const footer = document.querySelector('footer,[role="contentinfo"]');
        if (footer) push_candidate(footer, 'footer', ['semantic-footer'], 'footer', 0.9);

        const aside_nav = document.querySelector('aside nav, [role="complementary"] nav');
        if (aside_nav) {
            push_candidate(aside_nav, 'section_navigation', ['local-nav'], 'section_navigation', 0.7);
        }

        return results;
    });

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
