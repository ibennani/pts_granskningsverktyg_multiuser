/**
 * @fileoverview Fas 2.8 – iframes.
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { get_snapshot_analysis_iframe_max } from '../snapshot_analysis_config.js';

export async function run_iframe_analysis(ctx: AnalysisContext): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const inventory = await ctx.page.evaluate(() => {
        return Array.from(document.querySelectorAll('iframe')).map((frame) => {
            const rect = frame.getBoundingClientRect();
            return {
                url: frame.src || null,
                name: frame.name || null,
                title: frame.title || null,
                visible: rect.width > 1 && rect.height > 1,
                boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                width: rect.width,
                height: rect.height,
            };
        });
    });

    const deep: Array<Record<string, unknown>> = [];
    const frames = ctx.page.frames();
    let deep_count = 0;
    const max_deep = get_snapshot_analysis_iframe_max();

    for (const frame of frames) {
        if (deep_count >= max_deep || ctx.should_stop()) break;
        if (frame === ctx.page.mainFrame()) continue;
        const url = frame.url();
        if (!url || url === 'about:blank') continue;
        try {
            const controls = await frame.evaluate(() =>
                Array.from(document.querySelectorAll('button, a, input'))
                    .slice(0, 20)
                    .map((el) => ({
                        tagName: el.tagName.toLowerCase(),
                        role: el.getAttribute('role'),
                        text: el.textContent?.trim().slice(0, 80) || null,
                    }))
            );
            deep.push({ url, controls, sameOrigin: true });
            deep_count += 1;
        } catch {
            deep.push({ url, sameOrigin: false, partial: true });
        }
    }

    return {
        module: 'iframes',
        version: 1,
        phase: 2,
        status: 'success',
        durationMs: Date.now() - started,
        recordCount: inventory.length,
        truncated: deep_count >= max_deep,
        skipReason: null,
        warnings: [],
        data: { inventory, deepAnalysis: deep },
    };
}
