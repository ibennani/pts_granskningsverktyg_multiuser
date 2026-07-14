/**
 * @fileoverview Uppgiftsrad-UI för modalen Hämta information.
 */

import {
    build_status_icon_tooltip_icon_html,
    type FileDownloadHelpers,
} from '../../utils/file_download_button_ui.js';
import type { SampleUrlAnalyzeTaskId } from './sample_url_analyze_tasks.js';

export type SampleUrlAnalyzeTaskUiState = 'pending' | 'loading' | 'success' | 'failed';

export type SampleUrlAnalyzeTaskRowElements = {
    id: SampleUrlAnalyzeTaskId;
    row: HTMLLIElement;
    status_el: HTMLSpanElement;
    sr_status_el: HTMLSpanElement;
};

const ICON_SIZE = 16;

function status_icon_class(state: 'generating' | 'ready' | 'error'): string {
    if (state === 'generating') {
        return 'generic-tooltip__icon generic-tooltip__icon--generating';
    }
    if (state === 'ready') {
        return 'generic-tooltip__icon generic-tooltip__icon--ready';
    }
    return 'generic-tooltip__icon generic-tooltip__icon--error';
}

function status_icon_state(state: SampleUrlAnalyzeTaskUiState): 'generating' | 'ready' | 'error' | null {
    if (state === 'loading') {
        return 'generating';
    }
    if (state === 'success') {
        return 'ready';
    }
    if (state === 'failed') {
        return 'error';
    }
    return null;
}

function sr_status_key(state: SampleUrlAnalyzeTaskUiState): string {
    if (state === 'loading') {
        return 'sample_url_analyze_task_status_running';
    }
    if (state === 'success') {
        return 'sample_url_analyze_task_status_success';
    }
    if (state === 'failed') {
        return 'sample_url_analyze_task_status_failed';
    }
    return 'sample_url_analyze_task_status_pending';
}

export function create_sample_url_analyze_task_row(
    Helpers: FileDownloadHelpers & {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    },
    t: (key: string) => string,
    id: SampleUrlAnalyzeTaskId,
    label_key: string
): SampleUrlAnalyzeTaskRowElements {
    const sr_status_el = Helpers.create_element('span', {
        class_name: 'visually-hidden sample-url-analyze-task__sr-status',
        text_content: t(sr_status_key('pending')),
    }) as HTMLSpanElement;

    const status_el = Helpers.create_element('span', {
        class_name: 'sample-url-analyze-task__status',
        attributes: { 'aria-hidden': 'true' },
    }) as HTMLSpanElement;

    const label_el = Helpers.create_element('span', {
        class_name: 'sample-url-analyze-task__label',
        text_content: t(label_key),
    });

    const content_el = Helpers.create_element('span', {
        class_name: 'sample-url-analyze-task__content',
        children: [label_el, status_el],
    });

    const row = Helpers.create_element('li', {
        class_name: 'sample-url-analyze-task',
        attributes: {
            'data-task-id': id,
        },
        children: [content_el, sr_status_el],
    }) as HTMLLIElement;

    return { id, row, status_el, sr_status_el };
}

export function set_sample_url_analyze_task_row_state(
    row_elements: SampleUrlAnalyzeTaskRowElements,
    state: SampleUrlAnalyzeTaskUiState,
    Helpers: FileDownloadHelpers,
    t: (key: string) => string
): void {
    row_elements.sr_status_el.textContent = t(sr_status_key(state));
    row_elements.row.classList.toggle('sample-url-analyze-task--loading', state === 'loading');
    row_elements.row.classList.toggle('sample-url-analyze-task--success', state === 'success');
    row_elements.row.classList.toggle('sample-url-analyze-task--failed', state === 'failed');

    const icon_state = status_icon_state(state);
    if (!icon_state) {
        row_elements.status_el.innerHTML = '';
        return;
    }

    const icon_html = build_status_icon_tooltip_icon_html(Helpers, icon_state, ICON_SIZE);
    row_elements.status_el.innerHTML = `<span class="${status_icon_class(icon_state)}">${icon_html}</span>`;
}

export function reset_sample_url_analyze_task_rows(
    rows: SampleUrlAnalyzeTaskRowElements[],
    Helpers: FileDownloadHelpers,
    t: (key: string) => string
): void {
    for (const row of rows) {
        set_sample_url_analyze_task_row_state(row, 'pending', Helpers, t);
    }
}
