/**
 * @fileoverview Fas 1 – menyinteraktion (enda tillåtna auto-interaktion för recurring).
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { get_baseline_viewport } from '../snapshot_viewport_baseline.js';

const MOBILE_WIDTH = 320;

export async function run_menu_navigation_analysis(
    ctx: AnalysisContext
): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const records: Array<Record<string, unknown>> = [];

    const trigger = await ctx.page.evaluate(() => {
        const candidates = Array.from(
            document.querySelectorAll('button,[role="button"],a')
        ).filter((el) => {
            const expanded = el.getAttribute('aria-expanded');
            const controls = el.getAttribute('aria-controls');
            const haspopup = el.getAttribute('aria-haspopup');
            return expanded !== null || controls || haspopup;
        });
        const el = candidates[0] as HTMLElement | undefined;
        if (!el) return null;
        return {
            tagName: el.tagName.toLowerCase(),
            id: el.id || null,
            ariaExpanded: el.getAttribute('aria-expanded'),
            ariaControls: el.getAttribute('aria-controls'),
            text: (el.textContent || '').trim().slice(0, 80),
        };
    });

    if (!trigger?.id) {
        return {
            module: 'menu-navigation',
            version: 1,
            phase: 1,
            status: 'skipped',
            durationMs: Date.now() - started,
            recordCount: 0,
            truncated: false,
            skipReason: 'no-menu-trigger',
            warnings: [],
            data: { records: [] },
        };
    }

    const selector = `#${trigger.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    try {
        await ctx.page.click(selector);
        await new Promise((r) => setTimeout(r, 200));
        const opened = await ctx.page.evaluate((sel) => {
            const el = document.querySelector(sel) as HTMLElement | null;
            return {
                ariaExpanded: el?.getAttribute('aria-expanded'),
                linkCount: document.querySelectorAll('nav a,[role="navigation"] a').length,
            };
        }, selector);
        records.push({ viewport: 'desktop', trigger, opened });
        await ctx.page.click(selector).catch(() => {});
    } catch {
        records.push({ viewport: 'desktop', trigger, error: 'click-failed' });
    }

    const baseline = get_baseline_viewport();
    await ctx.page.setViewport({ width: MOBILE_WIDTH, height: baseline.height, deviceScaleFactor: baseline.deviceScaleFactor });
    await new Promise((r) => setTimeout(r, 150));
    records.push({ viewport: '320px', note: 'mobile-menu-scan' });
    await ctx.page.setViewport(baseline);

    return {
        module: 'menu-navigation',
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
