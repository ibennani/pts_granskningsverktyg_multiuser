/**
 * @fileoverview Orkestrerar uppgifter vid hämtning av sidinfo i granskningsdelsformuläret.
 */

import {
    get_sample_url_analyze_tasks,
    type SampleUrlAnalyzeFlowHost,
    type SampleUrlAnalyzeTaskCallbacks,
    type SampleUrlAnalyzeTaskOutcome,
} from './sample_url_analyze_tasks.js';

export type { SampleUrlAnalyzeFlowHost } from './sample_url_analyze_tasks.js';

function map_task_outcome(
    outcome: SampleUrlAnalyzeTaskOutcome | 'aborted'
): SampleUrlAnalyzeTaskOutcome | 'aborted' {
    return outcome;
}

export async function run_sample_url_analyze_tasks(
    host: SampleUrlAnalyzeFlowHost,
    callbacks: SampleUrlAnalyzeTaskCallbacks
): Promise<void> {
    const generation = host.bump_url_analyze_generation();
    const is_current = () => host.is_url_analyze_generation_current(generation);
    const tasks = get_sample_url_analyze_tasks();

    for (const task of tasks) {
        if (!is_current()) {
            return;
        }
        callbacks.on_task_start(task.id);
        const outcome = map_task_outcome(await task.run(host));
        if (!is_current()) {
            return;
        }
        if (outcome === 'aborted') {
            return;
        }
        callbacks.on_task_complete(task.id, outcome);
    }
}

export function cancel_sample_url_analyze_tasks(host: SampleUrlAnalyzeFlowHost): void {
    host.bump_url_analyze_generation();
    host.url_page_title_generation += 1;
    host.url_auto_screenshot_generation += 1;
}
