/**
 * @fileoverview Fas 1.7 – begränsade säkra interaktioner.
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { BROWSER_COLLECT_SAFE_INTERACTION_CANDIDATES } from '../snapshot_analysis_browser_scripts.js';
import { classify_safe_interaction } from '../snapshot_safe_interaction.js';
import { get_snapshot_analysis_interaction_max } from '../snapshot_analysis_config.js';
import { build_element_identity_from_eval } from '../snapshot_element_identity.js';
import { selector_from_element_id } from '../snapshot_element_identity.js';

export async function run_safe_interaction_analysis(
    ctx: AnalysisContext
): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const max = get_snapshot_analysis_interaction_max();
    const initial_url = ctx.page.url();
    const candidates = await ctx.page.evaluate(BROWSER_COLLECT_SAFE_INTERACTION_CANDIDATES);
    const records: Array<Record<string, unknown>> = [];
    let stopped_reason: string | null = null;

    for (const candidate of candidates) {
        if (records.length >= max || ctx.should_stop()) break;
        const verdict = classify_safe_interaction({
            tagName: String(candidate.tagName),
            type: candidate.type as string | null,
            role: candidate.role as string | null,
            href: candidate.href as string | null,
            ariaExpanded: candidate.ariaExpanded as string | null,
            ariaControls: candidate.ariaControls as string | null,
            ariaHaspopup: candidate.ariaHaspopup as string | null,
            text: candidate.text as string | null,
            isSummary: candidate.isSummary === true,
        });
        if (!verdict.safe) {
            records.push({
                elementIdentity: build_element_identity_from_eval({
                    id: candidate.id as string | null,
                    tagName: candidate.tagName as string,
                }),
                skipped: true,
                skipReason: verdict.reason,
            });
            continue;
        }

        const selector = selector_from_element_id(candidate.id as string | null);
        if (!selector) continue;

        const before = await ctx.page.evaluate((sel) => {
            const el = document.querySelector(sel) as HTMLElement | null;
            if (!el) return null;
            return {
                ariaExpanded: el.getAttribute('aria-expanded'),
                ariaPressed: el.getAttribute('aria-pressed'),
                hidden: el.hidden,
                visibility: getComputedStyle(el).visibility,
            };
        }, selector);

        try {
            await ctx.page.click(selector);
            await new Promise((r) => setTimeout(r, 150));
        } catch {
            records.push({ selector, error: 'click-failed' });
            continue;
        }

        if (ctx.page.url() !== initial_url) {
            stopped_reason = 'navigation-detected';
            ctx.mark_page_state_corrupted();
            break;
        }

        const after = await ctx.page.evaluate((sel) => {
            const el = document.querySelector(sel) as HTMLElement | null;
            if (!el) return null;
            return {
                ariaExpanded: el.getAttribute('aria-expanded'),
                ariaPressed: el.getAttribute('aria-pressed'),
                hidden: el.hidden,
                visibility: getComputedStyle(el).visibility,
            };
        }, selector);

        records.push({
            elementIdentity: build_element_identity_from_eval({
                id: candidate.id as string | null,
                tagName: candidate.tagName as string,
            }),
            before,
            after,
            safeReason: verdict.reason,
        });

        try {
            await ctx.page.click(selector);
        } catch {
            // återställning misslyckades
        }
    }

    ctx.shared.safe_interaction_candidates = records;

    return {
        module: 'interactions',
        version: 1,
        phase: 1,
        status: stopped_reason ? 'partial' : 'success',
        durationMs: Date.now() - started,
        recordCount: records.length,
        truncated: records.length >= max,
        skipReason: stopped_reason,
        warnings: [],
        data: { interactions: records, stoppedReason: stopped_reason },
    };
}
