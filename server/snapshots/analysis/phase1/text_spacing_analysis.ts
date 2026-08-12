/**
 * @fileoverview Fas 1.4 – textavstånd (WCAG text-spacing).
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { with_baseline_viewport } from '../snapshot_viewport_baseline.js';
import {
    BROWSER_APPLY_TEXT_SPACING_CSS,
    BROWSER_COLLECT_TEXT_SPACING_ISSUES,
    BROWSER_REMOVE_TEXT_SPACING_CSS,
} from '../snapshot_analysis_browser_scripts_loader.js';
import { write_analysis_png } from '../snapshot_analysis_io.js';

export async function run_text_spacing_analysis(ctx: AnalysisContext): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    let issues: Array<Record<string, unknown>> = [];
    let cleanup_ok = true;
    let screenshot_taken = false;

    try {
        await with_baseline_viewport(ctx.page, async () => {
            await ctx.page.evaluate(BROWSER_APPLY_TEXT_SPACING_CSS);
            issues = await ctx.page.evaluate(BROWSER_COLLECT_TEXT_SPACING_ISSUES);
            if (issues.length > 0 && ctx.screenshot_budget.remaining > 0) {
                const png = await ctx.page.screenshot({ type: 'png', fullPage: false });
                await write_analysis_png(
                    ctx.temp_dir,
                    'analysis/phase1/text-spacing-anomaly.png',
                    Buffer.from(png)
                );
                ctx.screenshot_budget.remaining -= 1;
                screenshot_taken = true;
            }
        });
    } finally {
        cleanup_ok = await ctx.page.evaluate(BROWSER_REMOVE_TEXT_SPACING_CSS);
        if (!cleanup_ok) {
            ctx.warnings.push({
                code: 'analysis_cleanup_failed',
                message: 'Text spacing test CSS could not be removed',
            });
        }
    }

    return {
        module: 'text-spacing',
        version: 1,
        phase: 1,
        status: cleanup_ok ? 'success' : 'partial',
        durationMs: Date.now() - started,
        recordCount: issues.length,
        truncated: false,
        skipReason: null,
        warnings: cleanup_ok ? [] : ['cleanup-failed'],
        data: { candidates: issues, screenshotTaken: screenshot_taken, cssRemoved: cleanup_ok },
    };
}
