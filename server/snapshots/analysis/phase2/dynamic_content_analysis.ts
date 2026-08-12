/**
 * @fileoverview Fas 2.5 – kort dynamisk observation.
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { get_snapshot_analysis_dynamic_ms } from '../snapshot_analysis_config.js';

export async function run_dynamic_content_analysis(
    ctx: AnalysisContext
): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const total_ms = get_snapshot_analysis_dynamic_ms();
    const snapshots: Array<Record<string, unknown>> = [];

    const collect = async (label: string) => {
        const data = await ctx.page.evaluate(() => {
            const animations = document.getAnimations().slice(0, 40).map((a) => ({
                id: (a as Animation).id || null,
                playState: a.playState,
                currentTime: a.currentTime,
                startTime: a.startTime,
            }));
            return { animationCount: animations.length, animations };
        });
        snapshots.push({ label, elapsedMs: Date.now() - started, ...data });
    };

    await collect('t0');
    await new Promise((r) => setTimeout(r, Math.min(2000, total_ms / 2)));
    if (!ctx.should_stop()) await collect('t2s');
    await new Promise((r) => setTimeout(r, Math.min(3000, total_ms / 2)));
    if (!ctx.should_stop()) await collect('t5s');

    return {
        module: 'dynamics',
        version: 1,
        phase: 2,
        status: 'success',
        durationMs: Date.now() - started,
        recordCount: snapshots.length,
        truncated: false,
        skipReason: null,
        warnings: [],
        data: { observations: snapshots, videoCreated: false },
    };
}
