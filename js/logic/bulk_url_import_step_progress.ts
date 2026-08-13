/**
 * @fileoverview Stegbaserad live-status för bulkimport-modalen.
 */

export type BulkImportStepProgressState = {
    current: number;
    total: number;
    activity_text: string;
    phase: 'idle' | 'running' | 'done';
};

type TranslationFn = (key: string, params?: Record<string, unknown>) => string;

const ROW_STEP_KEYS = new Set([
    'bulk_url_import_log_row_start',
    'bulk_url_import_log_capture_start',
    'bulk_url_import_log_register_sample',
    'bulk_url_import_log_capture_title',
    'bulk_url_import_log_capture_screenshot',
    'bulk_url_import_log_capture_classify',
    'bulk_url_import_log_save_dispatch',
    'bulk_url_import_log_sidrapport_wait',
    'bulk_url_import_log_sidrapport_ready',
    'bulk_url_import_log_summary',
    'bulk_url_import_log_row_done',
]);

const BATCH_STEP_KEYS = new Set([
    'bulk_url_import_log_batch_start',
    'bulk_url_import_log_batch_audit',
    'bulk_url_import_log_batch_done',
    'bulk_url_import_log_recurring_start',
    'bulk_url_import_log_recurring_created',
    'bulk_url_import_log_recurring_sync',
    'bulk_url_import_log_recurring_done',
    'bulk_url_import_log_recurring_none',
]);

const FAILURE_STEP_KEYS = new Set([
    'bulk_url_import_log_capture_failed',
    'bulk_url_import_log_row_failed',
    'bulk_url_import_log_sidrapport_timeout',
    'bulk_url_import_log_save_skip',
]);

const LIVE_ACTIVITY_KEY_BY_LOG_KEY: Record<string, string> = {
    bulk_url_import_log_batch_start: 'bulk_url_import_step_batch_start',
    bulk_url_import_log_batch_audit: 'bulk_url_import_step_batch_prep',
    bulk_url_import_log_row_start: 'bulk_url_import_step_row_start',
    bulk_url_import_log_capture_start: 'bulk_url_import_step_fetch',
    bulk_url_import_log_register_sample: 'bulk_url_import_step_register',
    bulk_url_import_log_capture_title: 'bulk_url_import_step_title',
    bulk_url_import_log_capture_screenshot: 'bulk_url_import_step_screenshot',
    bulk_url_import_log_capture_classify: 'bulk_url_import_step_classify',
    bulk_url_import_log_capture_failed: 'bulk_url_import_step_capture_failed',
    bulk_url_import_log_save_dispatch: 'bulk_url_import_step_save',
    bulk_url_import_log_sidrapport_wait: 'bulk_url_import_step_sidrapport_wait',
    bulk_url_import_log_sidrapport_ready: 'bulk_url_import_step_sidrapport_ready',
    bulk_url_import_log_sidrapport_timeout: 'bulk_url_import_step_sidrapport_timeout',
    bulk_url_import_log_summary: 'bulk_url_import_step_content_types',
    bulk_url_import_log_row_done: 'bulk_url_import_step_row_done',
    bulk_url_import_log_row_failed: 'bulk_url_import_step_row_failed',
    bulk_url_import_log_save_skip: 'bulk_url_import_step_save_skip',
    bulk_url_import_log_recurring_start: 'bulk_url_import_step_recurring_start',
    bulk_url_import_log_recurring_created: 'bulk_url_import_step_recurring_create',
    bulk_url_import_log_recurring_sync: 'bulk_url_import_step_recurring_done',
    bulk_url_import_log_recurring_done: 'bulk_url_import_step_recurring_done',
    bulk_url_import_log_recurring_none: 'bulk_url_import_step_recurring_done',
};

const RECURRING_PHASE_STEPS = 4;
const STEPS_PER_ROW = 11;
const BATCH_PREP_STEPS = 2;

export function calculate_bulk_import_total_steps(row_count: number): number {
    const recurring_steps = row_count >= 2 ? RECURRING_PHASE_STEPS : 0;
    return BATCH_PREP_STEPS + STEPS_PER_ROW * row_count + recurring_steps + 1;
}

export function format_bulk_import_sample_label(
    url: string,
    page_title: string | null | undefined
): string {
    const trimmed_title = typeof page_title === 'string' ? page_title.trim() : '';
    if (trimmed_title) {
        return trimmed_title.length > 60 ? `${trimmed_title.slice(0, 57)}…` : trimmed_title;
    }
    try {
        const parsed = new URL(url.includes('://') ? url : `https://${url}`);
        const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
        return `${parsed.hostname}${path}`;
    } catch {
        return url;
    }
}

export function create_bulk_import_step_progress(
    row_count: number,
    t: TranslationFn
): BulkImportStepProgressState {
    const total = calculate_bulk_import_total_steps(row_count);
    return {
        current: 0,
        total,
        activity_text: t('bulk_url_import_step_batch_prep'),
        phase: 'idle',
    };
}

function should_advance_step(message_key: string): boolean {
    return (
        ROW_STEP_KEYS.has(message_key)
        || BATCH_STEP_KEYS.has(message_key)
        || FAILURE_STEP_KEYS.has(message_key)
    );
}

function build_batch_done_text(
    t: TranslationFn,
    params: Record<string, unknown> | undefined
): string {
    const failed = Number(params?.failed ?? 0);
    const success = Number(params?.success ?? 0);
    if (failed > 0) {
        return t('bulk_url_import_step_batch_done_partial', { success, failed });
    }
    return t('bulk_url_import_step_batch_done_ok', { success });
}

function build_activity_text(
    t: TranslationFn,
    message_key: string,
    params: Record<string, unknown> | undefined,
    sample_label: string
): string {
    if (message_key === 'bulk_url_import_log_batch_done') {
        return build_batch_done_text(t, params);
    }
    const activity_key = LIVE_ACTIVITY_KEY_BY_LOG_KEY[message_key];
    if (!activity_key) {
        return t('bulk_url_import_step_batch_prep');
    }
    return t(activity_key, {
        ...params,
        sample: sample_label,
    });
}

export function advance_bulk_import_step_progress(
    state: BulkImportStepProgressState,
    t: TranslationFn,
    message_key: string,
    params: Record<string, unknown> | undefined,
    sample_label: string
): BulkImportStepProgressState {
    const activity_text = build_activity_text(t, message_key, params, sample_label);
    let current = state.current;
    if (should_advance_step(message_key)) {
        current = Math.min(state.current + 1, state.total);
    }
    if (message_key === 'bulk_url_import_log_batch_done') {
        current = state.total;
    }
    const phase = message_key === 'bulk_url_import_log_batch_done' ? 'done' : 'running';
    return { ...state, current, activity_text, phase };
}

export function build_bulk_import_live_status_text(
    t: TranslationFn,
    state: BulkImportStepProgressState
): string {
    if (state.phase === 'idle' && state.current === 0) {
        return t('bulk_url_import_live_step', {
            current: 0,
            total: state.total,
            activity: state.activity_text,
        });
    }
    const current = state.phase === 'done' ? state.total : state.current;
    return t('bulk_url_import_live_step', {
        current,
        total: state.total,
        activity: state.activity_text,
    });
}
