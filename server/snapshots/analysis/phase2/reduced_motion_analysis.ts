/**
 * @fileoverview Fas 2.6 – prefers-reduced-motion.
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';

export async function run_reduced_motion_analysis(
    ctx: AnalysisContext
): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();

    try {
        const before = await ctx.page.evaluate(() => ({
            animationCount: document.getAnimations().length,
            prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        }));

        await ctx.page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        await new Promise((r) => setTimeout(r, 300));

        const after = await ctx.page.evaluate(() => ({
            animationCount: document.getAnimations().length,
            prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        }));

        await ctx.page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

        return {
            module: 'reduced-motion',
            version: 1,
            phase: 2,
            status: 'success',
            durationMs: Date.now() - started,
            recordCount: 2,
            truncated: false,
            skipReason: null,
            warnings: [],
            data: { before, after, method: 'emulateMediaFeatures' },
        };
    } catch (err) {
        return {
            module: 'reduced-motion',
            version: 1,
            phase: 2,
            status: 'skipped',
            durationMs: Date.now() - started,
            recordCount: 0,
            truncated: false,
            skipReason: 'emulation-unavailable',
            warnings: [String(err instanceof Error ? err.message : err)],
            data: { limitations: ['Could not emulate prefers-reduced-motion without reload'] },
        };
    }
}
