/**
 * @fileoverview Fas 2.2 – fördjupade stateful components.
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { get_snapshot_analysis_dialog_tab_max } from '../snapshot_analysis_config.js';
import { classify_safe_interaction } from '../snapshot_safe_interaction.js';
import { selector_from_element_id } from '../snapshot_element_identity.js';

export async function run_stateful_component_analysis(
    ctx: AnalysisContext
): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const records: Array<Record<string, unknown>> = [];
    const candidates = await ctx.page.evaluate(() => {
        return Array.from(
            document.querySelectorAll('[aria-expanded], [role="dialog"], details, [aria-haspopup]')
        )
            .slice(0, 15)
            .map((el) => ({
                tagName: el.tagName.toLowerCase(),
                id: el.id || null,
                role: el.getAttribute('role'),
                ariaExpanded: el.getAttribute('aria-expanded'),
                text: el.textContent?.trim().slice(0, 80) || null,
            }));
    });

    for (const c of candidates) {
        if (ctx.should_stop()) break;
        const verdict = classify_safe_interaction(c);
        if (!verdict.safe) continue;
        if (!c.id) continue;
        const sel = selector_from_element_id(c.id);
        if (!sel) continue;
        const focus_before = await ctx.page.evaluate(() => document.activeElement?.tagName || null);
        try {
            await ctx.page.click(sel);
            await new Promise((r) => setTimeout(r, 100));
        } catch {
            continue;
        }
        const dialog_info = await ctx.page.evaluate(() => {
            const dlg = document.querySelector('[role="dialog"], dialog[open]') as HTMLElement | null;
            return dlg
                ? {
                      role: dlg.getAttribute('role'),
                      accessibleName: dlg.getAttribute('aria-label') || dlg.textContent?.slice(0, 100),
                  }
                : null;
        });
        const tab_steps: Array<string | null> = [];
        const max_tabs = get_snapshot_analysis_dialog_tab_max();
        for (let i = 0; i < max_tabs; i++) {
            if (ctx.should_stop()) break;
            await ctx.page.keyboard.press('Tab');
            tab_steps.push(
                await ctx.page.evaluate(() => document.activeElement?.tagName?.toLowerCase() || null)
            );
        }
        try {
            await ctx.page.keyboard.press('Escape');
        } catch {
            // ignore
        }
        const focus_after = await ctx.page.evaluate(() => document.activeElement?.tagName || null);
        records.push({
            trigger: c,
            focusBefore: focus_before,
            dialog: dialog_info,
            tabSteps: tab_steps,
            focusAfterClose: focus_after,
        });
    }

    return {
        module: 'stateful-components',
        version: 1,
        phase: 2,
        status: 'success',
        durationMs: Date.now() - started,
        recordCount: records.length,
        truncated: false,
        skipReason: null,
        warnings: [],
        data: { components: records },
    };
}
