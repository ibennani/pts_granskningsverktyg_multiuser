/**
 * @fileoverview Fas 2.9 – 200 % textförstoring (inte DPR 2).
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { with_baseline_viewport } from '../snapshot_viewport_baseline.js';
import { write_analysis_png } from '../snapshot_analysis_io.js';

export async function run_text_resize_analysis(ctx: AnalysisContext): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const method = 'root-font-size-200-percent';
    const limitations = [
        'Approximates browser text resize via documentElement font-size, not full user agent zoom.',
        'deviceScaleFactor 2 is unrelated to WCAG 200% text resize.',
    ];
    let screenshot_taken = false;
    let candidates: Array<Record<string, unknown>> = [];

    await with_baseline_viewport(ctx.page, async () => {
        const before = await ctx.page.evaluate(() => ({
            rootFontSize: getComputedStyle(document.documentElement).fontSize,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
        }));
        await ctx.page.evaluate(() => {
            document.documentElement.style.fontSize = '200%';
        });
        candidates = await ctx.page.evaluate(() => {
            const issues: Array<Record<string, unknown>> = [];
            document.querySelectorAll('p, button, a, input, label').forEach((el) => {
                const html = el as HTMLElement;
                if (html.scrollWidth > html.clientWidth + 1) {
                    issues.push({
                        tagName: html.tagName.toLowerCase(),
                        id: html.id || null,
                        scrollWidth: html.scrollWidth,
                        clientWidth: html.clientWidth,
                    });
                }
            });
            return issues.slice(0, 40);
        });
        if (candidates.length > 0 && ctx.screenshot_budget.remaining > 0) {
            const png = await ctx.page.screenshot({ type: 'png', fullPage: false });
            await write_analysis_png(
                ctx.temp_dir,
                'analysis/phase2/text-resize-200-anomaly.png',
                Buffer.from(png)
            );
            ctx.screenshot_budget.remaining -= 1;
            screenshot_taken = true;
        }
        await ctx.page.evaluate((prev) => {
            document.documentElement.style.fontSize = prev || '';
        }, before.rootFontSize);
    });

    return {
        module: 'text-resize-200',
        version: 1,
        phase: 2,
        status: 'success',
        durationMs: Date.now() - started,
        recordCount: candidates.length,
        truncated: false,
        skipReason: null,
        warnings: [],
        data: { method, limitations, overflowCandidates: candidates, screenshotTaken: screenshot_taken },
    };
}
