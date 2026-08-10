/**
 * @fileoverview Registrerade uppgifter för modalen Hämta information.
 */

import {
    build_sample_url_page_title_form_host,
    run_sample_url_page_title_task,
    type SampleUrlPageTitleFormHostSource
} from './sample_url_page_title.js';
import {
    build_sample_url_screenshot_form_host,
    type SampleUrlScreenshotFormHostSource
} from './sample_url_screenshot_form_host.js';
import { run_sample_url_screenshot_task } from './sample_url_auto_screenshot.js';

export type SampleUrlAnalyzeTaskId = 'page_title' | 'screenshot';

export type SampleUrlAnalyzeTaskOutcome = 'success' | 'failed';

export type SampleUrlAnalyzeTaskCallbacks = {
    on_task_start: (id: SampleUrlAnalyzeTaskId) => void;
    on_task_complete: (id: SampleUrlAnalyzeTaskId, outcome: SampleUrlAnalyzeTaskOutcome) => void;
};

export type SampleUrlAnalyzeFlowHost = SampleUrlPageTitleFormHostSource &
    SampleUrlScreenshotFormHostSource & {
        url_analyze_generation: number;
        bump_url_analyze_generation: () => number;
        is_url_analyze_generation_current: (generation: number) => boolean;
    };

export type SampleUrlAnalyzeTaskDefinition = {
    id: SampleUrlAnalyzeTaskId;
    label_key: string;
    run: (host: SampleUrlAnalyzeFlowHost) => Promise<SampleUrlAnalyzeTaskOutcome | 'aborted'>;
};

function map_page_title_outcome(
    outcome: Awaited<ReturnType<typeof run_sample_url_page_title_task>>
): SampleUrlAnalyzeTaskOutcome | 'aborted' {
    if (outcome === 'aborted') {
        return 'aborted';
    }
    return outcome;
}

function map_screenshot_outcome(
    outcome: Awaited<ReturnType<typeof run_sample_url_screenshot_task>>
): SampleUrlAnalyzeTaskOutcome | 'aborted' {
    if (outcome === 'aborted') {
        return 'aborted';
    }
    return outcome;
}

export function get_sample_url_analyze_tasks(): SampleUrlAnalyzeTaskDefinition[] {
    return [
        {
            id: 'page_title',
            label_key: 'sample_url_analyze_task_page_title',
            run: async (host) => {
                const page_title_host = build_sample_url_page_title_form_host(host);
                return map_page_title_outcome(await run_sample_url_page_title_task(page_title_host));
            },
        },
        {
            id: 'screenshot',
            label_key: 'sample_url_analyze_task_screenshot',
            run: async (host) => {
                const screenshot_host = build_sample_url_screenshot_form_host(host);
                return map_screenshot_outcome(await run_sample_url_screenshot_task(screenshot_host));
            },
        },
    ];
}

export function get_sample_url_analyze_task_ids(): SampleUrlAnalyzeTaskId[] {
    return get_sample_url_analyze_tasks().map((task) => task.id);
}
