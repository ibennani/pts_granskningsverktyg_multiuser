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
} from '../logic/bulk_sample_url_import_orchestrator.js';
import {
    format_bulk_url_import_log_line,
    emit_bulk_url_import_log,
    type BulkUrlImportLogEvent,
} from '../logic/bulk_url_import_logger.js';
import { get_default_content_type_ids } from '../../shared/rulefile/content_type_defaults.js';

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
    return t('bulk_url_import_log_unexpected_error', { error: message });
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
        container_el: HTMLElement;
    },
    modal: BulkUrlImportModalHandle,
    trigger_button: HTMLButtonElement | null
): Promise<void> {
    const { Helpers, t } = deps;
    ui.task_list_el.setAttribute('aria-busy', 'true');
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

    const saved_count = rows.filter((row) => row.status === 'saved').length;
    const failed_count = rows.filter((row) => row.status === 'failed').length;

    if (saved_count > 0) {
        deps.on_finished({ saved_count, failed_count });
        modal.close(trigger_button);
        return;
    }

    const finish_actions = deps.Helpers.create_element('div', {
        class_name: 'bulk-url-import-modal-finish',
    });
    const finish_button = deps.Helpers.create_element('button', {
        class_name: ['button', 'button-default'],
        attributes: { type: 'button' },
        text_content: t('bulk_url_import_modal_close'),
    }) as HTMLButtonElement;
    finish_button.addEventListener('click', () => {
        deps.on_finished({ saved_count, failed_count });
        modal.close(trigger_button);
    });
    finish_actions.appendChild(finish_button);
    ui.container_el.appendChild(finish_actions);
    finish_button.focus();
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

            const progress_bar_el = deps.Helpers.create_element('div', {
                class_name: 'visually-hidden sample-url-analyze-modal-progressbar',
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

            container.append(progress_bar_el, progress_live_el);

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
                task_list_el,
                log_list_el,
                container_el: container,
            }, modal, trigger_button);
        }
    );
    return true;
}
