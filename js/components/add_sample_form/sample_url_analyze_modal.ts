/**
 * @fileoverview Modal för hämtning av sidtitel och skärmavbild i granskningsdelsformuläret.
 */

import { app_runtime_refs } from '../../utils/app_runtime_refs.js';
import {
    cancel_sample_url_analyze_tasks,
    run_sample_url_analyze_tasks,
    type SampleUrlAnalyzeFlowHost,
} from './sample_url_analyze_flow.js';
import {
    capture_sample_url_analyze_fetch_snapshot,
    rollback_sample_url_analyze_fetch,
    type SampleUrlAnalyzeFetchSnapshot,
} from './sample_url_analyze_fetch_snapshot.js';
import {
    build_sample_url_analyze_progress_message,
    build_sample_url_analyze_progress_value_text,
    type SampleUrlAnalyzeProgressState,
} from './sample_url_analyze_progress.js';
import {
    create_sample_url_analyze_task_row,
    reset_sample_url_analyze_task_rows,
    set_sample_url_analyze_task_row_state,
    type SampleUrlAnalyzeTaskRowElements,
} from './sample_url_analyze_task_ui.js';
import {
    get_sample_url_analyze_tasks,
    type SampleUrlAnalyzeTaskId,
    type SampleUrlAnalyzeTaskOutcome,
} from './sample_url_analyze_tasks.js';
import type { FileDownloadHelpers } from '../../utils/file_download_button_ui.js';
import {
    create_snapshot_queue_status_controller,
    type SnapshotQueueStatusController,
} from '../../logic/snapshot_queue_status_ui.js';

type SampleUrlAnalyzeModalHandle = {
    close: (focus_element?: HTMLElement | null) => void;
    dialog_element_ref?: HTMLDialogElement | null;
};

type ShowSampleUrlAnalyzeModalOptions = {
    host: SampleUrlAnalyzeFlowHost;
    trigger_button: HTMLButtonElement | null;
    Helpers: FileDownloadHelpers & {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    };
    t: (key: string, params?: Record<string, unknown>) => string;
};

type ModalActionPhase = 'idle' | 'running' | 'done';

type SampleUrlAnalyzeModalUi = {
    task_rows: Map<SampleUrlAnalyzeTaskId, SampleUrlAnalyzeTaskRowElements>;
    progress_live_el: HTMLParagraphElement;
    error_detail_el: HTMLParagraphElement;
    progress_bar_el: HTMLDivElement;
    run_btn: HTMLButtonElement;
    stop_btn: HTMLButtonElement;
    close_btn: HTMLButtonElement;
    actions_el: HTMLElement;
    task_list_el: HTMLOListElement;
    intro_el: HTMLElement | null;
    fetch_in_progress: boolean;
    fetch_snapshot: SampleUrlAnalyzeFetchSnapshot | null;
    completed_count: number;
    failed_count: number;
    total_count: number;
    capacity_el: HTMLParagraphElement;
    elapsed_el: HTMLParagraphElement;
    queue_status: SnapshotQueueStatusController | null;
};

function remove_modal_intro(ui: SampleUrlAnalyzeModalUi): void {
    ui.intro_el?.remove();
}

function restore_modal_intro(ui: SampleUrlAnalyzeModalUi): void {
    if (!ui.intro_el || ui.intro_el.isConnected) {
        return;
    }
    ui.task_list_el.parentElement?.insertBefore(ui.intro_el, ui.task_list_el);
}

function create_initial_progress_state(total: number): SampleUrlAnalyzeProgressState {
    return {
        completed: 0,
        total,
        failed: 0,
        phase: 'idle',
    };
}

function apply_progress_state(
    ui: SampleUrlAnalyzeModalUi,
    t: ShowSampleUrlAnalyzeModalOptions['t'],
    state: SampleUrlAnalyzeProgressState
): void {
    const message = build_sample_url_analyze_progress_message(t, state);
    const value_text = build_sample_url_analyze_progress_value_text(t, state);

    ui.progress_live_el.textContent = message;
    const percent = state.total > 0 ? Math.round((state.completed / state.total) * 100) : 0;
    ui.progress_bar_el.style.width = `${percent}%`;
    ui.progress_bar_el.setAttribute('aria-valuemin', '0');
    ui.progress_bar_el.setAttribute('aria-valuemax', String(state.total));
    ui.progress_bar_el.setAttribute('aria-valuenow', String(state.completed));
    ui.progress_bar_el.setAttribute('aria-valuetext', value_text);
}

function set_modal_action_phase(
    ui: SampleUrlAnalyzeModalUi,
    phase: ModalActionPhase,
    t: ShowSampleUrlAnalyzeModalOptions['t']
): void {
    ui.fetch_in_progress = phase === 'running';
    ui.run_btn.hidden = phase !== 'idle';
    ui.stop_btn.hidden = phase !== 'running';
    ui.close_btn.hidden = phase === 'running';

    ui.run_btn.setAttribute('data-sample-url-analyze-busy', phase === 'running' ? 'true' : 'false');
    ui.task_list_el.setAttribute('aria-busy', phase === 'running' ? 'true' : 'false');
    ui.actions_el.classList.toggle('modal-confirm-actions--fetch-done', phase === 'done');

    if (phase === 'done') {
        ui.close_btn.textContent = t('sample_url_analyze_modal_close');
        ui.close_btn.classList.remove('button-default');
        ui.close_btn.classList.add('button-primary');
        return;
    }

    ui.close_btn.textContent = t('sample_url_analyze_modal_close_without_fetch');
    ui.close_btn.classList.remove('button-primary');
    ui.close_btn.classList.add('button-default');
}

function build_progress_state(
    ui: SampleUrlAnalyzeModalUi,
    phase: SampleUrlAnalyzeProgressState['phase']
): SampleUrlAnalyzeProgressState {
    return {
        completed: ui.completed_count,
        total: ui.total_count,
        failed: ui.failed_count,
        phase,
    };
}

function clear_fetch_error_detail(ui: SampleUrlAnalyzeModalUi): void {
    ui.error_detail_el.hidden = true;
    ui.error_detail_el.textContent = '';
}

function show_fetch_error_detail(
    ui: SampleUrlAnalyzeModalUi,
    t: ShowSampleUrlAnalyzeModalOptions['t'],
    detail: string
): void {
    const trimmed = String(detail || '').trim();
    if (!trimmed) {
        clear_fetch_error_detail(ui);
        return;
    }
    ui.error_detail_el.hidden = false;
    ui.error_detail_el.textContent = `${t('sample_url_analyze_error_detail_label')} ${trimmed}`;
}

function handle_task_complete(
    ui: SampleUrlAnalyzeModalUi,
    Helpers: ShowSampleUrlAnalyzeModalOptions['Helpers'],
    t: ShowSampleUrlAnalyzeModalOptions['t'],
    id: SampleUrlAnalyzeTaskId,
    outcome: SampleUrlAnalyzeTaskOutcome
): void {
    const row = ui.task_rows.get(id);
    if (!row) {
        return;
    }

    ui.completed_count += 1;
    if (outcome === 'failed') {
        ui.failed_count += 1;
    }

    set_sample_url_analyze_task_row_state(
        row,
        outcome === 'success' ? 'success' : 'failed',
        Helpers,
        t
    );

    const all_done = ui.completed_count >= ui.total_count;
    apply_progress_state(
        ui,
        t,
        build_progress_state(ui, all_done ? 'done' : 'running')
    );

    if (all_done) {
        ui.fetch_snapshot = null;
        ui.queue_status?.stop_elapsed_hint();
        ui.queue_status?.stop();
        set_modal_action_phase(ui, 'done', t);
    }
}

function start_fetch(
    host: SampleUrlAnalyzeFlowHost,
    ui: SampleUrlAnalyzeModalUi,
    Helpers: ShowSampleUrlAnalyzeModalOptions['Helpers'],
    t: ShowSampleUrlAnalyzeModalOptions['t']
): void {
    if (ui.fetch_in_progress || ui.run_btn.getAttribute('data-sample-url-analyze-busy') === 'true') {
        return;
    }

    ui.fetch_snapshot = capture_sample_url_analyze_fetch_snapshot(host);
    ui.completed_count = 0;
    ui.failed_count = 0;
    clear_fetch_error_detail(ui);
    reset_sample_url_analyze_task_rows([...ui.task_rows.values()], Helpers, t);

    for (const row of ui.task_rows.values()) {
        set_sample_url_analyze_task_row_state(row, 'loading', Helpers, t);
    }

    remove_modal_intro(ui);
    set_modal_action_phase(ui, 'running', t);
    apply_progress_state(ui, t, build_progress_state(ui, 'running'));
    ui.queue_status?.start();
    ui.queue_status?.start_elapsed_hint();

    void run_sample_url_analyze_tasks(host, {
        on_task_start: () => {},
        on_fetch_error: (detail) => {
            show_fetch_error_detail(ui, t, detail);
        },
        on_task_complete: (id: SampleUrlAnalyzeTaskId, outcome: SampleUrlAnalyzeTaskOutcome) => {
            handle_task_complete(ui, Helpers, t, id, outcome);
        },
    });
}

async function stop_fetch_and_rollback(
    host: SampleUrlAnalyzeFlowHost,
    ui: SampleUrlAnalyzeModalUi,
    Helpers: ShowSampleUrlAnalyzeModalOptions['Helpers'],
    t: ShowSampleUrlAnalyzeModalOptions['t']
): Promise<void> {
    if (!ui.fetch_in_progress || !ui.fetch_snapshot) {
        return;
    }

    cancel_sample_url_analyze_tasks(host);
    await rollback_sample_url_analyze_fetch(host, ui.fetch_snapshot);

    ui.fetch_snapshot = null;
    ui.completed_count = 0;
    ui.failed_count = 0;
    clear_fetch_error_detail(ui);
    reset_sample_url_analyze_task_rows([...ui.task_rows.values()], Helpers, t);
    apply_progress_state(ui, t, create_initial_progress_state(ui.total_count));
    ui.progress_live_el.textContent = t('sample_url_analyze_progress_stopped');
    restore_modal_intro(ui);
    set_modal_action_phase(ui, 'idle', t);
    ui.queue_status?.stop();
    ui.run_btn.focus();
}

function close_modal(
    host: SampleUrlAnalyzeFlowHost,
    ui: SampleUrlAnalyzeModalUi,
    modal: SampleUrlAnalyzeModalHandle,
    trigger_button: HTMLButtonElement | null
): void {
    if (ui.fetch_in_progress) {
        cancel_sample_url_analyze_tasks(host);
    }
    ui.queue_status?.stop();
    modal.close(trigger_button);
}

export function show_sample_url_analyze_modal({
    host,
    trigger_button,
    Helpers,
    t,
}: ShowSampleUrlAnalyzeModalOptions): void {
    const ModalComponent = app_runtime_refs.modal_component as {
        show?: (
            opts: { h1_text: string; message_text: string },
            render: (container: HTMLElement, modal: SampleUrlAnalyzeModalHandle) => void
        ) => void;
    } | null;
    if (!ModalComponent?.show || !Helpers?.create_element) {
        return;
    }

    const tasks = get_sample_url_analyze_tasks();

    ModalComponent.show(
        {
            h1_text: t('sample_url_analyze_modal_title'),
            message_text: t('sample_url_analyze_modal_intro'),
        },
        (container, modal) => {
            modal.dialog_element_ref?.classList.add('modal-dialog--sample-url-analyze');
            container.classList.add('modal-body--sample-url-analyze');

            const intro_el = container.querySelector('.modal-message');
            const task_list_el = Helpers.create_element('ol', {
                class_name: 'sample-url-analyze-task-list',
                attributes: {
                    'aria-busy': 'false',
                },
            }) as HTMLOListElement;

            const task_rows = new Map<SampleUrlAnalyzeTaskId, SampleUrlAnalyzeTaskRowElements>();
            for (const task of tasks) {
                const row = create_sample_url_analyze_task_row(Helpers, t, task.id, task.label_key);
                task_rows.set(task.id, row);
                task_list_el.appendChild(row.row);
            }
            container.appendChild(task_list_el);

            const capacity_el = Helpers.create_element('p', {
                class_name: 'sample-url-analyze-modal-capacity',
                attributes: {
                    role: 'status',
                    'aria-live': 'polite',
                    hidden: 'true',
                },
            }) as HTMLParagraphElement;

            const elapsed_el = Helpers.create_element('p', {
                class_name: 'sample-url-analyze-modal-elapsed',
                attributes: {
                    role: 'status',
                    'aria-live': 'polite',
                    hidden: 'true',
                },
            }) as HTMLParagraphElement;

            const progress_track_el = Helpers.create_element('div', {
                class_name: 'sample-url-analyze-modal-progresstrack',
            });

            const progress_bar_el = Helpers.create_element('div', {
                class_name: 'sample-url-analyze-modal-progressbar sample-url-analyze-modal-progressbar--visible',
                attributes: {
                    role: 'progressbar',
                    'aria-valuemin': '0',
                    'aria-valuemax': String(tasks.length),
                    'aria-valuenow': '0',
                    'aria-valuetext': t('sample_url_analyze_progress_waiting', { total: tasks.length }),
                },
            }) as HTMLDivElement;

            const progress_live_el = Helpers.create_element('p', {
                class_name: 'sample-url-analyze-modal-progress',
                attributes: {
                    role: 'status',
                },
            }) as HTMLParagraphElement;

            const error_detail_el = Helpers.create_element('p', {
                class_name: 'sample-url-analyze-modal-error-detail',
                attributes: {
                    role: 'alert',
                    hidden: 'true',
                },
            }) as HTMLParagraphElement;

            progress_track_el.appendChild(progress_bar_el);
            container.append(capacity_el, elapsed_el, progress_track_el, progress_live_el, error_detail_el);

            const queue_status = create_snapshot_queue_status_controller({
                t,
                capacity_el,
                elapsed_el,
            });

            const actions = Helpers.create_element('div', {
                class_name: 'modal-confirm-actions',
            });

            const run_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-primary', 'sample-url-analyze-modal-run'],
                text_content: t('sample_url_analyze_modal_run'),
                attributes: {
                    type: 'button',
                    'data-sample-url-analyze-busy': 'false',
                },
            }) as HTMLButtonElement;

            const stop_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-default', 'sample-url-analyze-modal-stop'],
                text_content: t('sample_url_analyze_modal_stop_and_undo'),
                attributes: { type: 'button', hidden: 'true' },
            }) as HTMLButtonElement;

            const close_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-default', 'sample-url-analyze-modal-close'],
                text_content: t('sample_url_analyze_modal_close_without_fetch'),
                attributes: { type: 'button' },
            }) as HTMLButtonElement;

            const ui: SampleUrlAnalyzeModalUi = {
                task_rows,
                progress_live_el,
                error_detail_el,
                progress_bar_el,
                run_btn,
                stop_btn,
                close_btn,
                actions_el: actions,
                task_list_el,
                intro_el: intro_el instanceof HTMLElement ? intro_el : null,
                fetch_in_progress: false,
                fetch_snapshot: null,
                completed_count: 0,
                failed_count: 0,
                total_count: tasks.length,
                capacity_el,
                elapsed_el,
                queue_status,
            };

            apply_progress_state(ui, t, create_initial_progress_state(tasks.length));
            set_modal_action_phase(ui, 'idle', t);

            run_btn.addEventListener('click', () => {
                start_fetch(host, ui, Helpers, t);
            });

            stop_btn.addEventListener('click', () => {
                void stop_fetch_and_rollback(host, ui, Helpers, t);
            });

            close_btn.addEventListener('click', () => {
                close_modal(host, ui, modal, trigger_button);
            });

            actions.append(run_btn, stop_btn, close_btn);
            container.appendChild(actions);

            requestAnimationFrame(() => {
                run_btn.focus();
            });
        }
    );
}
