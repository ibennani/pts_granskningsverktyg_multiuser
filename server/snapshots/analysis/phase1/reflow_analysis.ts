/**
 * @fileoverview Fas 1.3 – reflow vid 320 CSS-px.
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { with_baseline_viewport } from '../snapshot_viewport_baseline.js';
import { BROWSER_COLLECT_REFLOW_CANDIDATES } from '../snapshot_analysis_browser_scripts_loader.js';
import { write_analysis_png } from '../snapshot_analysis_io.js';

export async function run_reflow_analysis(ctx: AnalysisContext): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    let screenshot_taken = false;

    const result = await with_baseline_viewport(ctx.page, async () => {
        await ctx.page.setViewport({ width: 320, height: 800, deviceScaleFactor: 2 });
        const data = (await ctx.page.evaluate(BROWSER_COLLECT_REFLOW_CANDIDATES)) as {
            hasHorizontalOverflow?: boolean;
            candidates: unknown[];
        };
        if (data.hasHorizontalOverflow && ctx.screenshot_budget.remaining > 0) {
            const png = await ctx.page.screenshot({ type: 'png', fullPage: false });
            await write_analysis_png(ctx.temp_dir, 'analysis/phase1/reflow-320.png', Buffer.from(png));
            ctx.screenshot_budget.remaining -= 1;
            screenshot_taken = true;
        }
        return data;
    });

    return {
        module: 'reflow-320',
        version: 1,
        phase: 1,
        status: 'success',
        durationMs: Date.now() - started,
        recordCount: result.candidates.length,
        truncated: false,
        skipReason: null,
        warnings: [],
        data: { ...result, screenshotTaken: screenshot_taken },
    };
}
