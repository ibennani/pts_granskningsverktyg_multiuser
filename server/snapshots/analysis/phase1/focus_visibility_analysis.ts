/**
 * @fileoverview Fas 1.2 – fokusutseende (computed style diff).
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { BROWSER_GET_COMPUTED_FOCUS_STYLES, BROWSER_GET_FOCUSED_ELEMENT_INFO } from '../snapshot_analysis_browser_scripts.js';
import { build_element_identity_from_eval } from '../snapshot_element_identity.js';

const FOCUS_PROPS = [
    'outlineStyle', 'outlineWidth', 'outlineColor', 'outlineOffset', 'boxShadow',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
    'backgroundColor', 'color',
] as const;

function diff_styles(before: Record<string, string>, after: Record<string, string>): string[] {
    const changed: string[] = [];
    for (const prop of FOCUS_PROPS) {
        if (before[prop] !== after[prop]) changed.push(prop);
    }
    return changed;
}

export async function run_focus_visibility_analysis(
    ctx: AnalysisContext
): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const keyboard_steps = (ctx.shared.keyboard_steps || []) as Array<{ elementIdentity?: unknown }>;
    const records: Array<Record<string, unknown>> = [];

    if (keyboard_steps.length === 0) {
        return {
            module: 'focus-visibility',
            version: 1,
            phase: 1,
            status: 'skipped',
            durationMs: Date.now() - started,
            recordCount: 0,
            truncated: false,
            skipReason: 'no-keyboard-data',
            warnings: [],
            data: { records: [] },
        };
    }

    const sample_indices = keyboard_steps
        .map((_, i) => i)
        .filter((i) => i < 25);

    for (const idx of sample_indices) {
        if (ctx.should_stop()) break;
        await ctx.page.keyboard.press('Tab');
        await new Promise((r) => setTimeout(r, 25));
        const before = await ctx.page.evaluate(BROWSER_GET_COMPUTED_FOCUS_STYLES);
        const info = await ctx.page.evaluate(BROWSER_GET_FOCUSED_ELEMENT_INFO);
        const after = await ctx.page.evaluate(BROWSER_GET_COMPUTED_FOCUS_STYLES);
        if (!info || !before || !after) continue;
        const changed = diff_styles(before as Record<string, string>, after as Record<string, string>);
        records.push({
            elementIdentity: build_element_identity_from_eval({
                id: info.id,
                tagName: info.tagName,
                role: info.role,
                domPath: info.domPath,
            }),
            before,
            focused: after,
            changedProperties: changed,
            visualChangeDetected: changed.length > 0,
        });
    }

    return {
        module: 'focus-visibility',
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
