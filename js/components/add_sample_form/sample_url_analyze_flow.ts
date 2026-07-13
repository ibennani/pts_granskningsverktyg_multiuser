/**
 * @fileoverview Orkestrerar sidtitel + skärmdump vid klick på «Hämta information».
 */

import { handle_sample_url_blur } from './sample_url_auto_screenshot.js';
import {
    build_sample_url_page_title_form_host,
    handle_sample_url_page_title_on_blur,
    type SampleUrlPageTitleFormHostSource
} from './sample_url_page_title.js';
import {
    build_sample_url_screenshot_form_host,
    type SampleUrlScreenshotFormHostSource
} from './sample_url_screenshot_form_host.js';
import { set_sample_url_analyze_status, type SampleUrlAnalyzeStatusHost } from './sample_url_analyze_status.js';
import { READY_RESET_MS } from '../../utils/file_download_button_ui.js';

export type SampleUrlAnalyzeFlowHost = SampleUrlAnalyzeStatusHost &
    SampleUrlPageTitleFormHostSource &
    SampleUrlScreenshotFormHostSource & {
        url_analyze_generation: number;
        bump_url_analyze_generation: () => number;
        is_url_analyze_generation_current: (generation: number) => boolean;
    };

export async function run_sample_url_analyze_flow(host: SampleUrlAnalyzeFlowHost): Promise<void> {
    const generation = host.bump_url_analyze_generation();
    set_sample_url_analyze_status(host, 'loading');

    const page_title_host = build_sample_url_page_title_form_host(host);
    const screenshot_host = build_sample_url_screenshot_form_host(host);

    try {
        await Promise.all([
            handle_sample_url_page_title_on_blur(page_title_host),
            handle_sample_url_blur(screenshot_host)
        ]);
        if (!host.is_url_analyze_generation_current(generation)) {
            return;
        }
        set_sample_url_analyze_status(host, 'success');
        await new Promise((resolve) => setTimeout(resolve, READY_RESET_MS));
        if (host.is_url_analyze_generation_current(generation)) {
            set_sample_url_analyze_status(host, 'idle');
        }
    } catch {
        if (!host.is_url_analyze_generation_current(generation)) {
            return;
        }
        set_sample_url_analyze_status(host, 'failed');
        await new Promise((resolve) => setTimeout(resolve, READY_RESET_MS));
        if (host.is_url_analyze_generation_current(generation)) {
            set_sample_url_analyze_status(host, 'idle');
        }
    }
}
