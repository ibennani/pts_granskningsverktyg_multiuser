/**
 * @fileoverview Orkestrerar uppgifter vid hämtning av sidinfo i granskningsdelsformuläret.
 */

import {
    get_sample_url_analyze_tasks,
    type SampleUrlAnalyzeFlowHost,
    type SampleUrlAnalyzeTaskId,
    type SampleUrlAnalyzeTaskOutcome,
} from './sample_url_analyze_tasks.js';

export type { SampleUrlAnalyzeFlowHost } from './sample_url_analyze_tasks.js';

export type SampleUrlAnalyzeTaskCallbacks = {
    on_task_start: (id: SampleUrlAnalyzeTaskId) => void;
    on_task_complete: (id: SampleUrlAnalyzeTaskId, outcome: SampleUrlAnalyzeTaskOutcome) => void;
};

async function run_single_sample_url_analyze_task(
    host: SampleUrlAnalyzeFlowHost,
    generation: number,
    callbacks: SampleUrlAnalyzeTaskCallbacks,
    task: ReturnType<typeof get_sample_url_analyze_tasks>[number]
): Promise<void> {
    if (!host.is_url_analyze_generation_current(generation)) {
        return;
    }

    callbacks.on_task_start(task.id);

    const raw_outcome = await task.run(host);
    if (!host.is_url_analyze_generation_current(generation)) {
        return;
    }
    if (raw_outcome === 'aborted') {
        return;
    }

    callbacks.on_task_complete(task.id, raw_outcome);
}

export async function run_sample_url_analyze_tasks(
    host: SampleUrlAnalyzeFlowHost,
    callbacks: SampleUrlAnalyzeTaskCallbacks
): Promise<void> {
    const generation = host.bump_url_analyze_generation();
    const tasks = get_sample_url_analyze_tasks();

    await Promise.all(
        tasks.map((task) => run_single_sample_url_analyze_task(host, generation, callbacks, task))
    );
}

export function cancel_sample_url_analyze_tasks(host: SampleUrlAnalyzeFlowHost): void {
    host.bump_url_analyze_generation();
}
