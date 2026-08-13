/**
 * @fileoverview Fas 1.6 – klickytors storlek.
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { BROWSER_COLLECT_TARGET_SIZES } from '../snapshot_analysis_browser_scripts_loader.js';
import { build_element_identity_from_eval } from '../snapshot_element_identity.js';

export async function run_target_size_analysis(ctx: AnalysisContext): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const raw = (await ctx.page.evaluate(BROWSER_COLLECT_TARGET_SIZES)) as Array<
        Record<string, unknown>
    >;
    const records = raw.map((item, index) => {
        const record = {
            elementIdentity: build_element_identity_from_eval({
                id: item.id as string | null,
                tagName: item.tagName as string,
            }),
            role: item.role,
            accessibleName: item.accessibleName,
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            viewport: { width: item.viewportWidth, height: item.viewportHeight },
        };
        if (index > 0) {
            const prev = raw[index - 1];
            const dx = Math.abs(Number(item.x) - Number(prev.x));
            const dy = Math.abs(Number(item.y) - Number(prev.y));
            return { ...record, nearestTargetDistance: Math.round(Math.sqrt(dx * dx + dy * dy)) };
        }
        return record;
    });

    return {
        module: 'target-size',
        version: 1,
        phase: 1,
        status: 'success',
        durationMs: Date.now() - started,
        recordCount: records.length,
        truncated: false,
        skipReason: null,
        warnings: [],
        data: { records },
    };
}
