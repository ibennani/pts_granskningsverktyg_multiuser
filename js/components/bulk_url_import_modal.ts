/**
 * @fileoverview Modal med progress per URL vid bulkimport av granskningsdelar.
 */
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import {
    build_sample_url_analyze_progress_message,
    build_sample_url_analyze_progress_value_text,
    type SampleUrlAnalyzeProgressState,
} from './add_sample_form/sample_url_analyze_progress.js';
import {
    create_bulk_url_import_modal_row,
    set_bulk_url_import_modal_row_state,
    type BulkUrlImportModalRowElements,
    type BulkUrlImportRowUiState,
} from './bulk_url_import_modal_row.js';
import {
    run_full_bulk_url_import,
    type BulkImportPreparedRow,
    type BulkImportRowStatus,
} from '../logic/bulk_sample_url_import_orchestrator.js';
import {
    format_bulk_url_import_log_line,
    emit_bulk_url_import_log,
    type BulkUrlImportLogEvent,
} from '../logic/bulk_url_import_logger.js';

type BulkUrlImportModalDeps = {
    getState: () => Record<string, unknown>;
    dispatch: (action: { type: string; payload?: unknown }) => void;
    StoreActionTypes: Record<string, string>;
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        generate_uuid_v4: () => string;
        add_protocol_if_missing?: (url: string) => string;
    };
    t: (key: string, params?: Record<string, unknown>) => string;
    sample_category_id: string;
    wait_for_snapshot_ready: (
        audit_id: string,
        capture_id: string,
        timeout_ms: number
    ) => Promise<boolean>;
    on_complete: () => void;
};

type BulkUrlImportModalHandle = {
    close: (focus_element?: HTMLElement | null) => void;
    dialog_element_ref?: HTMLDialogElement | null;
};

function row_status_to_ui(status: BulkImportRowStatus): BulkUrlImportRowUiState {
    if (status === 'waiting') return 'pending';
    if (status === 'failed') return 'failed';
    if (status === 'saved') return 'success';
    return 'loading';
}

function build_progress_state(
    completed: number,
    total: number,
    failed: number,
    phase: SampleUrlAnalyzeProgressState['phase']
): SampleUrlAnalyzeProgressState {
    return { completed, total, failed, phase };
}

function apply_progress(
    progress_live_el: HTMLParagraphElement,
    progress_bar_el: HTMLDivElement,
    t: BulkUrlImportModalDeps['t'],
    state: SampleUrlAnalyzeProgressState
): void {
    progress_live_el.textContent = build_sample_url_analyze_progress_message(t, state);
    progress_bar_el.setAttribute('aria-valuemin', '0');
    progress_bar_el.setAttribute('aria-valuemax', String(state.total));
    progress_bar_el.setAttribute('aria-valuenow', String(state.completed));
    progress_bar_el.setAttribute(
        'aria-valuetext',
        build_sample_url_analyze_progress_value_text(t, state)
    );
}

function count_finished_rows(rows: BulkImportPreparedRow[]): { completed: number; failed: number } {
    let completed = 0;
    let failed = 0;
    for (const row of rows) {
        if (row.status === 'saved') {
            completed += 1;
        } else if (row.status === 'failed') {
            completed += 1;
            failed += 1;
        }
    }
    return { completed, failed };
}

function append_log_line(
    log_list_el: HTMLOListElement,
    event: BulkUrlImportLogEvent
): void {
    const line = format_bulk_url_import_log_line(event);
    const item = document.createElement('li');
    item.className = `bulk-url-import-modal-log__line bulk-url-import-modal-log__line--${event.level}`;
    item.textContent = line;
    log_list_el.appendChild(item);
    log_list_el.scrollTop = log_list_el.scrollHeight;
}

async function run_import_in_modal(
    deps: BulkUrlImportModalDeps,
    rows: BulkImportPreparedRow[],
    row_elements: Map<string, BulkUrlImportModalRowElements>,
    ui: {
        progress_live_el: HTMLParagraphElement;
        progress_bar_el: HTMLDivElement;
        task_list_el: HTMLOListElement;
        log_list_el: HTMLOListElement;
    },
    modal: BulkUrlImportModalHandle,
    trigger_button: HTMLButtonElement | null
): Promise<void> {
    const { Helpers, t } = deps;
    ui.task_list_el.setAttribute('aria-busy', 'true');
    apply_progress(
        ui.progress_live_el,
        ui.progress_bar_el,
        t,
        build_progress_state(0, rows.length, 0, 'running')
    );

    const sync_row_ui = (row: BulkImportPreparedRow) => {
        const index = rows.findIndex((entry) => entry.row_id === row.row_id);
        if (index >= 0) {
            rows[index] = row;
        }
        const elements = row_elements.get(row.row_id);
        if (!elements) return;
        set_bulk_url_import_modal_row_state(
            elements,
            row_status_to_ui(row.status),
            Helpers,
            t
        );
        const counts = count_finished_rows(rows);
        const all_done = counts.completed >= rows.length;
        apply_progress(
            ui.progress_live_el,
            ui.progress_bar_el,
            t,
            build_progress_state(counts.completed, rows.length, counts.failed, all_done ? 'done' : 'running')
        );
    };

    try {
        await run_full_bulk_url_import(
            {
                getState: deps.getState,
                dispatch: deps.dispatch,
                StoreActionTypes: deps.StoreActionTypes,
                generate_uuid: Helpers.generate_uuid_v4,
                add_protocol_if_missing: Helpers.add_protocol_if_missing,
                on_row_updated: sync_row_ui,
                wait_for_snapshot_ready: deps.wait_for_snapshot_ready,
                log_import_step: (message_key, params, meta) => {
                    emit_bulk_url_import_log(
                        (event) => append_log_line(ui.log_list_el, event),
                        t(message_key, params),
                        meta
                    );
                },
            },
            rows,
            deps.sample_category_id
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        append_log_line(ui.log_list_el, {
            level: 'error',
            message: t('bulk_url_import_log_unexpected_error', { error: message }),
        });
        for (const row of rows) {
            if (row.status !== 'saved' && row.status !== 'failed') {
                sync_row_ui({ ...row, status: 'failed' });
            }
        }
    }

    ui.task_list_el.setAttribute('aria-busy', 'false');
    const final_counts = count_finished_rows(rows);
    apply_progress(
        ui.progress_live_el,
        ui.progress_bar_el,
        t,
        build_progress_state(final_counts.completed, rows.length, final_counts.failed, 'done')
    );

    deps.on_complete();
    modal.close(trigger_button);
}

export function show_bulk_url_import_modal(
    deps: BulkUrlImportModalDeps,
    urls: string[],
    trigger_button: HTMLButtonElement | null
): void {
    const ModalComponent = app_runtime_refs.modal_component as {
        show?: (
            opts: { h1_text: string; message_text: string },
            render: (container: HTMLElement, modal: BulkUrlImportModalHandle) => void
        ) => void;
    } | null;
    if (!ModalComponent?.show) return;

    const rows: BulkImportPreparedRow[] = urls.map((url) => ({
        row_id: deps.Helpers.generate_uuid_v4(),
        url,
        status: 'waiting',
        error_message: null,
        page_title: null,
        screenshot_filename: null,
        sample_id: null,
        capture_id: null,
        suggested_sample_type_id: null,
        suggested_sample_type_confidence: 0,
        detected_content_type_ids: [],
        selected_content_type_ids: [],
        include_in_save: true,
    }));

    ModalComponent.show(
        {
            h1_text: deps.t('bulk_url_import_modal_title'),
            message_text: deps.t('bulk_url_import_modal_intro'),
        },
        (container, modal) => {
            modal.dialog_element_ref?.classList.add('modal-dialog--sample-url-analyze');
            container.classList.add('modal-body--sample-url-analyze');

            const intro_el = container.querySelector('.modal-message');
            intro_el?.remove();

            const task_list_el = deps.Helpers.create_element('ol', {
                class_name: 'sample-url-analyze-task-list',
                attributes: { 'aria-busy': 'true' },
            }) as HTMLOListElement;

            const row_elements = new Map<string, BulkUrlImportModalRowElements>();
            for (const row of rows) {
                const elements = create_bulk_url_import_modal_row(
                    deps.Helpers,
                    deps.t,
                    row.row_id,
                    row.url
                );
                row_elements.set(row.row_id, elements);
                task_list_el.appendChild(elements.row);
            }
            container.appendChild(task_list_el);

            const progress_bar_el = deps.Helpers.create_element('div', {
                class_name: 'visually-hidden sample-url-analyze-modal-progressbar',
                attributes: {
                    role: 'progressbar',
                    'aria-valuemin': '0',
                    'aria-valuemax': String(rows.length),
                    'aria-valuenow': '0',
                    'aria-valuetext': deps.t('sample_url_analyze_progress_waiting', { total: rows.length }),
                },
            }) as HTMLDivElement;

            const progress_live_el = deps.Helpers.create_element('p', {
                class_name: 'sample-url-analyze-modal-progress',
                attributes: { role: 'status' },
            }) as HTMLParagraphElement;

            container.append(progress_bar_el, progress_live_el);

            const log_heading = deps.Helpers.create_element('h2', {
                class_name: 'bulk-url-import-modal-log__heading',
                text_content: t('bulk_url_import_modal_log_heading'),
            });
            const log_list_el = deps.Helpers.create_element('ol', {
                class_name: 'bulk-url-import-modal-log',
                attributes: {
                    'aria-live': 'polite',
                    'aria-relevant': 'additions',
                },
            }) as HTMLOListElement;
            container.append(log_heading, log_list_el);

            void run_import_in_modal(deps, rows, row_elements, {
                progress_live_el,
                progress_bar_el,
                task_list_el,
                log_list_el,
            }, modal, trigger_button);
        }
    );
}
