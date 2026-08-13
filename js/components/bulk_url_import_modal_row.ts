/**
 * @fileoverview Uppgiftsrad-UI för bulkimport-modalen (samma mönster som sidtitel/skärmdump).
 */
import {
    build_status_icon_tooltip_icon_html,
    type FileDownloadHelpers,
} from '../utils/file_download_button_ui.js';

export type BulkUrlImportRowUiState = 'pending' | 'loading' | 'success' | 'failed';

export type BulkUrlImportModalRowElements = {
    row_id: string;
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

function status_icon_state(state: BulkUrlImportRowUiState): 'generating' | 'ready' | 'error' | null {
    if (state === 'loading') return 'generating';
    if (state === 'success') return 'ready';
    if (state === 'failed') return 'error';
    return null;
}

function sr_status_key(state: BulkUrlImportRowUiState): string {
    if (state === 'loading') return 'sample_url_analyze_task_status_running';
    if (state === 'success') return 'sample_url_analyze_task_status_success';
    if (state === 'failed') return 'sample_url_analyze_task_status_failed';
    return 'sample_url_analyze_task_status_pending';
}

export function create_bulk_url_import_modal_row(
    Helpers: FileDownloadHelpers & {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    },
    t: (key: string) => string,
    row_id: string,
    url_label: string
): BulkUrlImportModalRowElements {
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
        text_content: url_label,
    });

    const content_el = Helpers.create_element('span', {
        class_name: 'sample-url-analyze-task__content',
        children: [label_el, status_el],
    });

    const row = Helpers.create_element('li', {
        class_name: 'sample-url-analyze-task bulk-url-import-modal-task',
        attributes: { 'data-bulk-url-row-id': row_id },
        children: [content_el, sr_status_el],
    }) as HTMLLIElement;

    return { row_id, row, status_el, sr_status_el };
}

export function set_bulk_url_import_modal_row_state(
    row_elements: BulkUrlImportModalRowElements,
    state: BulkUrlImportRowUiState,
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
