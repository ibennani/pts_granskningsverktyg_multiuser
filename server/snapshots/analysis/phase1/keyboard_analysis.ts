/**
 * @fileoverview Fas 1.1 – tangentbordsnavigation (Tab-sekvens).
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { build_element_identity_from_eval, identity_key, sanitize_href } from '../snapshot_element_identity.js';
import { get_snapshot_analysis_tab_max_steps } from '../snapshot_analysis_config.js';
import { BROWSER_GET_FOCUSED_ELEMENT_INFO } from '../snapshot_analysis_browser_scripts_loader.js';

export async function run_keyboard_analysis(ctx: AnalysisContext): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const max_steps = get_snapshot_analysis_tab_max_steps();
    const steps: Array<Record<string, unknown>> = [];
    const seen_keys = new Set<string>();
    let truncated = false;
    let stopped_reason: string | null = null;
    const initial_url = ctx.page.url();

    for (let i = 0; i < max_steps; i++) {
        if (ctx.should_stop()) {
            truncated = true;
            stopped_reason = 'budget-or-cancel';
            break;
        }
        if (i > 0 && i % 8 === 0 && ctx.should_stop()) {
            truncated = true;
            stopped_reason = 'budget-or-cancel';
            break;
        }

        const step_started = Date.now() - started;
        await ctx.page.keyboard.press('Tab');
        await new Promise((r) => setTimeout(r, 30));

        if (ctx.page.url() !== initial_url) {
            stopped_reason = 'navigation-detected';
            break;
        }

        const info = await ctx.page.evaluate(BROWSER_GET_FOCUSED_ELEMENT_INFO);
        if (!info) {
            steps.push({
                index: i,
                timestampMs: step_started,
                focusState: 'none-or-body',
            });
            continue;
        }

        const identity = build_element_identity_from_eval({
            id: info.id,
            tagName: info.tagName,
            role: info.role,
            name: info.name,
            domPath: info.domPath,
        });
        const key = identity_key(identity);
        if (seen_keys.has(key)) {
            stopped_reason = 'focus-cycle-detected';
            steps.push({
                index: i,
                timestampMs: step_started,
                elementIdentity: identity,
                focusState: 'cycle',
            });
            break;
        }
        seen_keys.add(key);

        steps.push({
            index: i,
            timestampMs: step_started,
            elementIdentity: identity,
            tagName: info.tagName,
            type: info.type,
            role: info.role,
            accessibleName: info.accessibleName,
            id: info.id,
            name: info.name,
            href: sanitize_href(info.href),
            tabindex: info.tabIndex,
            disabled: info.disabled,
            ariaDisabled: info.ariaDisabled,
            ariaHidden: info.ariaHidden,
            boundingBox: info.boundingBox,
            scroll: { x: info.scrollX, y: info.scrollY },
            viewport: { width: info.viewportWidth, height: info.viewportHeight },
            visible: info.visible,
            fullyWithinViewport: info.fullyWithinViewport,
            focusState: 'focused',
        });
    }

    if (steps.length >= max_steps) truncated = true;

    const backward_steps: Array<Record<string, unknown>> = [];
    const backward_max = Math.min(15, steps.length);
    for (let i = 0; i < backward_max; i++) {
        if (ctx.should_stop()) break;
        await ctx.page.keyboard.down('Shift');
        await ctx.page.keyboard.press('Tab');
        await ctx.page.keyboard.up('Shift');
        await new Promise((r) => setTimeout(r, 20));
        const info = await ctx.page.evaluate(BROWSER_GET_FOCUSED_ELEMENT_INFO);
        backward_steps.push({ index: i, hasFocus: Boolean(info) });
    }

    ctx.shared.keyboard_steps = steps;

    return {
        module: 'keyboard',
        version: 1,
        phase: 1,
        status: stopped_reason === 'navigation-detected' ? 'partial' : 'success',
        durationMs: Date.now() - started,
        recordCount: steps.length,
        truncated,
        skipReason: stopped_reason,
        warnings: [],
        data: { forwardSteps: steps, backwardSteps: backward_steps, stoppedReason: stopped_reason },
    };
}
