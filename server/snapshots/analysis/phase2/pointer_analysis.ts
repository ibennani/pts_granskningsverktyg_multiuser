/**
 * @fileoverview Fas 2.7 – enkel pointeranalys.
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { classify_safe_interaction } from '../snapshot_safe_interaction.js';
import { selector_from_element_id } from '../snapshot_element_identity.js';

export async function run_pointer_analysis(ctx: AnalysisContext): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const records: Array<Record<string, unknown>> = [];
    const buttons = await ctx.page.evaluate(() =>
        Array.from(document.querySelectorAll('button'))
            .slice(0, 10)
            .map((b) => ({
                id: b.id,
                text: b.textContent?.trim().slice(0, 80) || null,
                ariaExpanded: b.getAttribute('aria-expanded'),
            }))
    );

    for (const btn of buttons) {
        if (!btn.id || ctx.should_stop()) continue;
        const verdict = classify_safe_interaction({
            tagName: 'button',
            text: btn.text,
            ariaExpanded: btn.ariaExpanded,
        });
        if (!verdict.safe) {
            records.push({ id: btn.id, skipped: true, reason: verdict.reason });
            continue;
        }
        const events: string[] = [];
        const sel = selector_from_element_id(btn.id);
        if (!sel) continue;
        await ctx.page.evaluate((selector) => {
            const el = document.querySelector(selector);
            if (!el) return;
            const log = (type: string) => () => {
                (window as unknown as { __gv_pointer_log: string[] }).__gv_pointer_log.push(type);
            };
            (window as unknown as { __gv_pointer_log: string[] }).__gv_pointer_log = [];
            el.addEventListener('pointerdown', log('pointerdown'));
            el.addEventListener('mousedown', log('mousedown'));
            el.addEventListener('pointerup', log('pointerup'));
            el.addEventListener('mouseup', log('mouseup'));
            el.addEventListener('click', log('click'));
        }, sel);
        try {
            await ctx.page.click(sel);
        } catch {
            continue;
        }
        const sequence = await ctx.page.evaluate(() => {
            const log = (window as unknown as { __gv_pointer_log?: string[] }).__gv_pointer_log || [];
            return log;
        });
        events.push(...sequence);
        records.push({ id: btn.id, eventSequence: events });
    }

    return {
        module: 'pointer',
        version: 1,
        phase: 2,
        status: 'success',
        durationMs: Date.now() - started,
        recordCount: records.length,
        truncated: false,
        skipReason: null,
        warnings: [],
        data: { pointers: records },
    };
}
