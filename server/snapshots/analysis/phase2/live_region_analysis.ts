/**
 * @fileoverview Fas 2.1 – live regions och statusmeddelanden.
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { get_snapshot_analysis_dynamic_ms, get_snapshot_analysis_mutation_max } from '../snapshot_analysis_config.js';

export async function run_live_region_analysis(ctx: AnalysisContext): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const max_records = get_snapshot_analysis_mutation_max();
    const observe_ms = get_snapshot_analysis_dynamic_ms();

    const result = await ctx.page.evaluate(
        (max_rec, duration_ms) => {
            return new Promise<{
                records: Array<Record<string, unknown>>;
                truncated: boolean;
            }>((resolve) => {
                const records: Array<Record<string, unknown>> = [];
                const observer = new MutationObserver((mutations) => {
                    for (const m of mutations) {
                        if (records.length >= max_rec) return;
                        const target = m.target as HTMLElement;
                        const role = target.getAttribute?.('role');
                        const aria_live = target.getAttribute?.('aria-live');
                        if (!aria_live && !['status', 'alert', 'log'].includes(role || '')) {
                            if (m.type !== 'characterData') continue;
                        }
                        records.push({
                            timestampMs: Date.now() - start,
                            mutationType: m.type,
                            role,
                            ariaLive: aria_live,
                            beforeExcerpt: (m.oldValue || '').slice(0, 200),
                            afterExcerpt: target.textContent?.slice(0, 200) || null,
                        });
                    }
                });
                const start = Date.now();
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    characterData: true,
                    characterDataOldValue: true,
                    attributes: true,
                    attributeFilter: ['aria-live', 'role', 'aria-busy'],
                });
                setTimeout(() => {
                    observer.disconnect();
                    resolve({ records, truncated: records.length >= max_rec });
                }, duration_ms);
            });
        },
        max_records,
        observe_ms
    );

    return {
        module: 'live-regions',
        version: 1,
        phase: 2,
        status: 'success',
        durationMs: Date.now() - started,
        recordCount: result.records.length,
        truncated: result.truncated,
        skipReason: null,
        warnings: [],
        data: { records: result.records },
    };
}
