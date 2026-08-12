/**
 * @fileoverview Fas 2.4 – selektiv hover.
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { get_snapshot_analysis_hover_max } from '../snapshot_analysis_config.js';

export async function run_hover_analysis(ctx: AnalysisContext): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const max = get_snapshot_analysis_hover_max();
    const candidates = await ctx.page.evaluate((limit) => {
        const results: Array<{ selector: string; reason: string }> = [];
        const elements = document.querySelectorAll('[title], [aria-describedby], [aria-haspopup]');
        for (let i = 0; i < elements.length && results.length < limit; i++) {
            const el = elements[i] as HTMLElement;
            if (!el.id) continue;
        if (!el.id) continue;
            const reason = el.getAttribute('title')
                ? 'title'
                : el.getAttribute('aria-describedby')
                  ? 'aria-describedby'
                  : 'aria-haspopup';
            const sel = `#${el.id}`;
            results.push({ selector: sel, reason });
        }
        return results;
    }, max);

    const records: Array<Record<string, unknown>> = [];
    for (const c of candidates) {
        if (ctx.should_stop()) break;
        const before = await ctx.page.evaluate((sel) => {
            const el = document.querySelector(sel);
            return { childCount: el?.childNodes.length ?? 0, text: el?.textContent?.slice(0, 100) };
        }, c.selector);
        try {
            await ctx.page.hover(c.selector);
            await new Promise((r) => setTimeout(r, 200));
        } catch {
            continue;
        }
        const after = await ctx.page.evaluate(() => {
            const tooltips = document.querySelectorAll('[role="tooltip"], .tooltip, [class*="tooltip" i]');
            return {
                tooltipCount: tooltips.length,
                visibleText: Array.from(tooltips)
                    .map((t) => t.textContent?.trim().slice(0, 100))
                    .filter(Boolean),
            };
        });
        records.push({ selector: c.selector, reason: c.reason, before, after });
        await ctx.page.mouse.move(0, 0);
    }

    return {
        module: 'hover',
        version: 1,
        phase: 2,
        status: 'success',
        durationMs: Date.now() - started,
        recordCount: records.length,
        truncated: candidates.length >= max,
        skipReason: null,
        warnings: [],
        data: { hovers: records },
    };
}
