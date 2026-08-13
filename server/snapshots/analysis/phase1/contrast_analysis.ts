/**
 * @fileoverview Fas 1.5 – kontrastunderlag.
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { BROWSER_COLLECT_CONTRAST_CANDIDATES } from '../snapshot_analysis_browser_scripts_loader.js';
import {
    contrast_ratio,
    is_large_text_candidate,
    parse_font_size_px,
    parse_font_weight,
} from '../snapshot_contrast_utils.js';
import { build_element_identity_from_eval } from '../snapshot_element_identity.js';

export async function run_contrast_analysis(ctx: AnalysisContext): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const raw = (await ctx.page.evaluate(BROWSER_COLLECT_CONTRAST_CANDIDATES)) as Array<
        Record<string, unknown>
    >;
    const records: Array<Record<string, unknown>> = [];

    for (const item of raw) {
        const measurable = item.measurable === true;
        const font_size_px = parse_font_size_px(String(item.fontSize || '16px'));
        const font_weight = parse_font_weight(String(item.fontWeight || '400'));
        const entry: Record<string, unknown> = {
            elementIdentity: build_element_identity_from_eval({
                id: item.id as string | null,
                tagName: item.tagName as string,
            }),
            textExcerpt: item.textExcerpt,
            foregroundColor: item.foregroundColor,
            resolvedBackgroundColor: item.backgroundColor,
            opacity: item.opacity,
            fontSize: item.fontSize,
            fontWeight: item.fontWeight,
            boundingBox: item.boundingBox,
            measurable,
            largeTextCandidate: is_large_text_candidate(font_size_px, font_weight),
        };
        if (measurable) {
            const ratio = contrast_ratio(
                String(item.foregroundColor),
                String(item.backgroundColor)
            );
            entry.contrastRatio = ratio;
        } else {
            entry.reason = item.reason || 'complex-background';
        }
        records.push(entry);
    }

    return {
        module: 'contrast',
        version: 1,
        phase: 1,
        status: 'success',
        durationMs: Date.now() - started,
        recordCount: records.length,
        truncated: raw.length >= 120,
        skipReason: null,
        warnings: [],
        data: { records },
    };
}
