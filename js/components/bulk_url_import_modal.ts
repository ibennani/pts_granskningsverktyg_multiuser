/**
 * @fileoverview Modal med progress per URL vid bulkimport av granskningsdelar.
 */
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import {
    advance_bulk_import_step_progress,
    build_bulk_import_live_status_text,
    calculate_bulk_import_total_steps,
    create_bulk_import_step_progress,
    format_bulk_import_sample_label,
    type BulkImportStepProgressState,
} from '../logic/bulk_url_import_step_progress.js';
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
    type BulkImportCreatedItem,
} from '../logic/bulk_sample_url_import_orchestrator.js';
import { format_elapsed_duration_sv } from '../utils/format_elapsed_duration_sv.js';
import {
    format_bulk_url_import_log_line,
    emit_bulk_url_import_log,
    type BulkUrlImportLogEvent,
} from '../logic/bulk_url_import_logger.js';
import { get_default_content_type_ids } from '../../shared/rulefile/content_type_defaults.js';
import { create_snapshot_queue_status_controller } from '../logic/snapshot_queue_status_ui.js';

type BulkUrlImportModalDeps = {
    getState: () => Record<string, unknown>;
    dispatch: (action: { type: string; payload?: unknown }) => void;
    StoreActionTypes: {
        ADD_SAMPLE: string;
        UPDATE_SAMPLE: string;
        DELETE_SAMPLE?: string;
    };
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
    on_finished: (summary: { saved_count: number; failed_count: number }) => void;
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

function resolve_sample_label(
    rows: BulkImportPreparedRow[],
    meta?: { row_id?: string; url?: string }
): string {
    const row = meta?.row_id
        ? rows.find((entry) => entry.row_id === meta.row_id)
        : rows.find((entry) => entry.url === meta?.url);
    const url = row?.url || meta?.url || '';
    return format_bulk_import_sample_label(url, row?.page_title);
}

function apply_step_progress(
    progress_live_el: HTMLParagraphElement,
    progress_bar_el: HTMLDivElement,
    t: BulkUrlImportModalDeps['t'],
    state: BulkImportStepProgressState
): void {
    const message = build_bulk_import_live_status_text(t, state);
    progress_live_el.textContent = message;
    const current = state.phase === 'done' ? state.total : Math.max(state.current, 0);
    const percent = state.total > 0 ? Math.round((current / state.total) * 100) : 0;
    progress_bar_el.style.width = `${percent}%`;
    progress_bar_el.setAttribute('aria-valuemin', '0');
    progress_bar_el.setAttribute('aria-valuemax', String(state.total));
    progress_bar_el.setAttribute('aria-valuenow', String(current));
    progress_bar_el.setAttribute('aria-valuetext', message);
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

function format_bulk_import_error_message(
    t: BulkUrlImportModalDeps['t'],
    message: string
): string {
    if (message === 'bulk_url_import_no_audit') {
        return t('bulk_url_import_no_audit');
    }
    if (message === 'web_monitoring_only_feature_unavailable') {
        return t('web_monitoring_only_feature_unavailable');
    }
    return t('bulk_url_import_log_unexpected_error', { error: message });
}

function render_import_summary(
    deps: BulkUrlImportModalDeps,
    container_el: HTMLElement,
    created_items: BulkImportCreatedItem[],
    elapsed_ms: number,
    failed_count: number,
    modal: BulkUrlImportModalHandle,
    trigger_button: HTMLButtonElement | null
): void {
    const summary_wrap = deps.Helpers.create_element('div', {
        class_name: 'bulk-url-import-modal-summary',
    });
    summary_wrap.appendChild(deps.Helpers.create_element('h2', {
        class_name: 'bulk-url-import-modal-summary__heading',
        text_content: deps.t('bulk_url_import_summary_heading'),
    }));

    const duration_el = deps.Helpers.create_element('p', {
        class_name: 'bulk-url-import-modal-summary__duration',
        text_content: deps.t('bulk_url_import_summary_duration', {
            duration: format_elapsed_duration_sv(elapsed_ms),
        }),
    });
    summary_wrap.appendChild(duration_el);

    if (created_items.length > 0) {
        const list = deps.Helpers.create_element('ul', {
            class_name: 'bulk-url-import-modal-summary__list',
        });
        for (const item of created_items) {
            const li = deps.Helpers.create_element('li');
            li.textContent = deps.t('bulk_url_import_summary_item', {
                category: item.category_label,
                label: item.label,
            });
            list.appendChild(li);
        }
        summary_wrap.appendChild(list);
    } else {
        summary_wrap.appendChild(deps.Helpers.create_element('p', {
            text_content: deps.t('bulk_url_import_summary_none'),
        }));
    }

    if (failed_count > 0) {
        summary_wrap.appendChild(deps.Helpers.create_element('p', {
            class_name: 'bulk-url-import-modal-summary__failed',
            text_content: deps.t('bulk_url_import_summary_failed', { count: failed_count }),
        }));
    }

    const finish_actions = deps.Helpers.create_element('div', {
        class_name: 'bulk-url-import-modal-finish',
    });
    const finish_button = deps.Helpers.create_element('button', {
        class_name: ['button', 'button-default'],
        attributes: { type: 'button' },
        text_content: created_items.length > 0
            ? deps.t('bulk_url_import_modal_go_to_samples')
            : deps.t('bulk_url_import_modal_close'),
    }) as HTMLButtonElement;
    finish_button.addEventListener('click', () => {
        deps.on_finished({
            saved_count: created_items.length,
            failed_count,
        });
        modal.close(trigger_button);
    });
    finish_actions.appendChild(finish_button);
    summary_wrap.appendChild(finish_actions);
    container_el.appendChild(summary_wrap);
    finish_button.focus();
}

async function run_import_in_modal(
    deps: BulkUrlImportModalDeps,
    rows: BulkImportPreparedRow[],
    row_elements: Map<string, BulkUrlImportModalRowElements>,
    ui: {
        progress_live_el: HTMLParagraphElement;
        progress_bar_el: HTMLDivElement;
        capacity_el: HTMLParagraphElement;
        elapsed_el: HTMLParagraphElement;
        task_list_el: HTMLOListElement;
        log_list_el: HTMLOListElement;
        container_el: HTMLElement;
    },
    modal: BulkUrlImportModalHandle,
    trigger_button: HTMLButtonElement | null
): Promise<void> {
    const { Helpers, t } = deps;
    ui.task_list_el.setAttribute('aria-busy', 'true');
    const queue_status = create_snapshot_queue_status_controller({
        t,
        capacity_el: ui.capacity_el,
        elapsed_el: ui.elapsed_el,
    });
    queue_status.start();

    let step_progress: BulkImportStepProgressState = {
        ...create_bulk_import_step_progress(rows.length, t),
        phase: 'running',
    };
    apply_step_progress(ui.progress_live_el, ui.progress_bar_el, t, step_progress);

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
    };

    const started_at = Date.now();
    let created_items: BulkImportCreatedItem[] = [];

    try {
        const result = await run_full_bulk_url_import(
            {
                getState: deps.getState,
                dispatch: deps.dispatch,
                StoreActionTypes: deps.StoreActionTypes,
                generate_uuid: Helpers.generate_uuid_v4,
                add_protocol_if_missing: Helpers.add_protocol_if_missing,
                on_row_updated: sync_row_ui,
                wait_for_snapshot_ready: deps.wait_for_snapshot_ready,
                t: deps.t,
                log_import_step: (message_key, params, meta) => {
                    if (message_key === 'bulk_url_import_log_capture_start') {
                        queue_status.start_elapsed_hint();
                    }
                    if (
                        message_key === 'bulk_url_import_log_capture_title'
                        || message_key === 'bulk_url_import_log_capture_failed'
                    ) {
                        queue_status.stop_elapsed_hint();
                    }
                    if (message_key === 'bulk_url_import_log_sidrapport_wait') {
                        queue_status.start_elapsed_hint();
                    }
                    if (
                        message_key === 'bulk_url_import_log_sidrapport_ready'
                        || message_key === 'bulk_url_import_log_sidrapport_timeout'
                    ) {
                        queue_status.stop_elapsed_hint();
                    }
                    emit_bulk_url_import_log(
                        (event) => append_log_line(ui.log_list_el, event),
                        t(message_key, params),
                        { level: meta?.level ?? 'info', row_id: meta?.row_id, url: meta?.url }
                    );
                    step_progress = advance_bulk_import_step_progress(
                        step_progress,
                        t,
                        message_key,
                        params,
                        resolve_sample_label(rows, meta)
                    );
                    apply_step_progress(ui.progress_live_el, ui.progress_bar_el, t, step_progress);
                },
            },
            rows,
            deps.sample_category_id
        );
        created_items = result.created_items;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        append_log_line(ui.log_list_el, {
            level: 'error',
            message: format_bulk_import_error_message(t, message),
        });
        for (const row of rows) {
            if (row.status !== 'saved' && row.status !== 'failed') {
                sync_row_ui({ ...row, status: 'failed' });
            }
        }
    }

    ui.task_list_el.setAttribute('aria-busy', 'false');
    ui.progress_live_el.setAttribute('aria-busy', 'false');
    queue_status.stop();

    const failed_count = rows.filter((row) => row.status === 'failed').length;
    const elapsed_ms = Date.now() - started_at;

    step_progress = {
        ...step_progress,
        phase: 'done',
        current: step_progress.total,
        activity_text: t('bulk_url_import_step_batch_done_ok', {
            success: created_items.length,
        }),
    };
    apply_step_progress(ui.progress_live_el, ui.progress_bar_el, t, step_progress);

    render_import_summary(
        deps,
        ui.container_el,
        created_items,
        elapsed_ms,
        failed_count,
        modal,
        trigger_button
    );
}

export function show_bulk_url_import_modal(
    deps: BulkUrlImportModalDeps,
    urls: string[],
    trigger_button: HTMLButtonElement | null
): boolean {
    const ModalComponent = app_runtime_refs.modal_component as {
        show?: (
            opts: { h1_text: string; message_text: string },
            render: (container: HTMLElement, modal: BulkUrlImportModalHandle) => void
        ) => void;
    } | null;
    if (!ModalComponent?.show) {
        emit_bulk_url_import_log(undefined, 'ModalComponent.show saknas', { level: 'warn' });
        return false;
    }

    const state = deps.getState();
    const rule_metadata = (state?.ruleFileContent as { metadata?: unknown } | undefined)?.metadata;
    const default_content_type_ids = get_default_content_type_ids(rule_metadata);

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
        selected_content_type_ids: [...default_content_type_ids],
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

            const capacity_el = deps.Helpers.create_element('p', {
                class_name: 'sample-url-analyze-modal-capacity',
                attributes: {
                    role: 'status',
                    'aria-live': 'polite',
                    hidden: 'true',
                },
            }) as HTMLParagraphElement;

            const elapsed_el = deps.Helpers.create_element('p', {
                class_name: 'sample-url-analyze-modal-elapsed',
                attributes: {
                    role: 'status',
                    'aria-live': 'polite',
                    hidden: 'true',
                },
            }) as HTMLParagraphElement;

            const progress_track_el = deps.Helpers.create_element('div', {
                class_name: 'sample-url-analyze-modal-progresstrack',
            });

            const progress_bar_el = deps.Helpers.create_element('div', {
                class_name: 'sample-url-analyze-modal-progressbar sample-url-analyze-modal-progressbar--visible',
                attributes: {
                    role: 'progressbar',
                    'aria-valuemin': '0',
                    'aria-valuemax': String(calculate_bulk_import_total_steps(rows.length)),
                    'aria-valuenow': '0',
                    'aria-valuetext': '',
                },
            }) as HTMLDivElement;

            const progress_live_el = deps.Helpers.create_element('p', {
                class_name: 'sample-url-analyze-modal-progress',
                attributes: {
                    role: 'status',
                    'aria-live': 'polite',
                    'aria-atomic': 'true',
                    'aria-busy': 'true',
                },
            }) as HTMLParagraphElement;

            progress_track_el.appendChild(progress_bar_el);
            container.append(capacity_el, elapsed_el, progress_track_el, progress_live_el);

            const log_heading = deps.Helpers.create_element('h2', {
                class_name: 'bulk-url-import-modal-log__heading',
                text_content: deps.t('bulk_url_import_modal_log_heading'),
            });
            const log_list_el = deps.Helpers.create_element('ol', {
                class_name: 'bulk-url-import-modal-log',
            }) as HTMLOListElement;
            container.append(log_heading, log_list_el);

            void run_import_in_modal(deps, rows, row_elements, {
                progress_live_el,
                progress_bar_el,
                capacity_el,
                elapsed_el,
                task_list_el,
                log_list_el,
                container_el: container,
            }, modal, trigger_button);
        }
    );
    return true;
}
