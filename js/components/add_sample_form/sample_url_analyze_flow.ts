/**
 * @fileoverview Orkestrerar uppgifter vid hämtning av sidinfo i granskningsdelsformuläret.
 */

import {
    type SampleUrlAnalyzeFlowHost,
    type SampleUrlAnalyzeTaskCallbacks,
} from './sample_url_analyze_tasks.js';
import {
    run_unified_sample_url_analyze_tasks,
    cancel_active_sample_url_capture,
    type SampleUrlAnalyzeCaptureHost,
} from './sample_url_analyze_capture.js';

export type { SampleUrlAnalyzeFlowHost } from './sample_url_analyze_tasks.js';

export async function run_sample_url_analyze_tasks(
    host: SampleUrlAnalyzeFlowHost,
    callbacks: SampleUrlAnalyzeTaskCallbacks
): Promise<void> {
    await run_unified_sample_url_analyze_tasks(host as SampleUrlAnalyzeCaptureHost, callbacks);
}

export function cancel_sample_url_analyze_tasks(host: SampleUrlAnalyzeFlowHost): void {
    host.bump_url_analyze_generation();
    const audit_id = host.getState?.()?.auditId ?? null;
    void cancel_active_sample_url_capture(audit_id ? String(audit_id) : null);
}
