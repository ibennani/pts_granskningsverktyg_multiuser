/**
 * @fileoverview Unified capture för Hämta information (en API-runda, två synliga tasks).
 */
import {
    start_audit_snapshot_capture,
    cancel_audit_snapshot_capture,
    type AuditSnapshotCaptureResponse,
} from '../../api/audit_snapshot_api.js';
import { can_upload_audit_media } from '../../api/audit_media_api.js';
import {
    apply_page_title_to_description,
    type SampleUrlPageTitleComponentLike,
} from './sample_url_page_title.js';
import {
    normalize_url_for_screenshot,
    replace_auto_screenshot_filename,
    should_skip_url_screenshot_capture,
    should_skip_url_screenshot_when_attached_media_exists,
} from './sample_url_auto_screenshot_logic.js';
import { update_sample_attach_media_button } from './sample_attach_media.js';
import type { SampleUrlAnalyzeFlowHost } from './sample_url_analyze_tasks.js';
import type {
    SampleUrlAnalyzeTaskCallbacks,
    SampleUrlAnalyzeTaskId,
    SampleUrlAnalyzeTaskOutcome,
} from './sample_url_analyze_tasks.js';

export type SampleUrlAnalyzeCaptureHost = SampleUrlAnalyzeFlowHost & {
    get_pending_sample_id: () => string;
    get_t_internally: () => (key: string, params?: Record<string, unknown>) => string;
    Helpers: NonNullable<SampleUrlAnalyzeFlowHost['Helpers']> & {
        generate_uuid_v4: () => string;
    };
};

let active_capture_id: string | null = null;
let active_abort_controller: AbortController | null = null;

export function get_active_sample_url_capture_id(): string | null {
    return active_capture_id;
}

export async function cancel_active_sample_url_capture(audit_id: string | null): Promise<void> {
    if (active_abort_controller) {
        active_abort_controller.abort();
    }
    if (audit_id && active_capture_id) {
        try {
            await cancel_audit_snapshot_capture(audit_id, active_capture_id);
        } catch {
            // best-effort
        }
    }
    active_capture_id = null;
    active_abort_controller = null;
}

function map_task_outcome(outcome: string): SampleUrlAnalyzeTaskOutcome {
    if (outcome === 'success' || outcome === 'skipped') {
        return outcome === 'skipped' ? 'success' : 'success';
    }
    return 'failed';
}

function apply_screenshot_from_capture(
    host: SampleUrlAnalyzeCaptureHost,
    response: AuditSnapshotCaptureResponse
): SampleUrlAnalyzeTaskOutcome {
    if (response.screenshot.outcome === 'failed') {
        return 'failed';
    }
    if (response.screenshot.outcome === 'skipped' || !response.screenshot.filename) {
        return 'success';
    }

    const normalized_url = normalize_url_for_screenshot(
        host.url_input?.value || '',
        host.Helpers?.add_protocol_if_missing
    );
    const attached = [...host.sample_attached_media_filenames];
    const next_attached = replace_auto_screenshot_filename(
        attached,
        host.url_auto_screenshot_filename,
        response.screenshot.filename
    );
    host.sample_attached_media_filenames = next_attached;
    host.url_auto_screenshot_filename = response.screenshot.filename;
    host.url_auto_screenshot_source_url = normalized_url;

    update_sample_attach_media_button({
        sample_attach_media_btn: host.sample_attach_media_btn,
        sample_attached_media_filenames: host.sample_attached_media_filenames,
        get_t_internally: host.get_t_internally,
        sample_url_screenshot_in_progress: false,
    });

    if (host.current_editing_sample_id) {
        host.save_form_data_immediately(true, false, true);
    } else {
        host._persist_new_sample_draft(false);
    }
    return 'success';
}

function apply_page_title_from_capture(
    host: SampleUrlAnalyzeCaptureHost,
    response: AuditSnapshotCaptureResponse
): SampleUrlAnalyzeTaskOutcome {
    if (response.pageTitle.outcome === 'failed' || !response.pageTitle.value) {
        return 'failed';
    }
    const page_title_host: SampleUrlPageTitleComponentLike = {
        url_input: host.url_input,
        url_form_group_ref: host.url_form_group_ref,
        description_input: host.description_input,
        previous_url_page_title: host.previous_url_page_title,
        previous_sample_type_value: host.previous_sample_type_value,
        url_page_title_generation: host.url_page_title_generation,
        current_editing_sample_id: host.current_editing_sample_id,
        getState: host.getState,
        Helpers: host.Helpers,
        ensure_audit_id_for_media: host.ensure_audit_id_for_media,
        save_form_data_immediately: host.save_form_data_immediately.bind(host),
        _persist_new_sample_draft: host._persist_new_sample_draft.bind(host),
        set_previous_url_page_title: (title) => {
            host.previous_url_page_title = title;
        },
        bump_url_page_title_generation: () => {
            host.url_page_title_generation += 1;
            return host.url_page_title_generation;
        },
        is_url_page_title_generation_current: () => true,
        description_label_element: host.description_label_element,
        get_page_title_label_loading_count: () => host.page_title_label_loading_count,
        set_page_title_label_loading_count: (count) => {
            host.page_title_label_loading_count = count;
        },
        get_t_internally: host.get_t_internally,
    };
    apply_page_title_to_description(page_title_host, response.pageTitle.value);
    return 'success';
}

export async function run_unified_sample_url_analyze_tasks(
    host: SampleUrlAnalyzeCaptureHost,
    callbacks: SampleUrlAnalyzeTaskCallbacks
): Promise<void> {
    const generation = host.bump_url_analyze_generation();
    const task_ids: SampleUrlAnalyzeTaskId[] = ['page_title', 'screenshot'];

    const is_current = () => host.is_url_analyze_generation_current(generation);

    let audit_id = host.getState?.()?.auditId ?? null;
    if (!audit_id && host.ensure_audit_id_for_media) {
        audit_id = await host.ensure_audit_id_for_media();
    }
    if (!audit_id || !can_upload_audit_media(String(audit_id))) {
        for (const id of task_ids) {
            if (!is_current()) return;
            callbacks.on_task_start(id);
            callbacks.on_task_complete(id, 'failed');
        }
        return;
    }

    const normalized_url = normalize_url_for_screenshot(
        host.url_input?.value || '',
        host.Helpers?.add_protocol_if_missing
    );
    if (!normalized_url) {
        for (const id of task_ids) {
            if (!is_current()) return;
            callbacks.on_task_start(id);
            callbacks.on_task_complete(id, 'failed');
        }
        return;
    }

    const attached_filenames = [...host.sample_attached_media_filenames];
    const auto_filename = host.url_auto_screenshot_filename;
    const skip_screenshot_attach =
        should_skip_url_screenshot_when_attached_media_exists(attached_filenames, auto_filename) ||
        should_skip_url_screenshot_capture(
            normalized_url,
            host.url_auto_screenshot_source_url,
            auto_filename,
            attached_filenames
        );

    const capture_id = host.Helpers.generate_uuid_v4();
    active_capture_id = capture_id;
    active_abort_controller = new AbortController();

    for (const id of task_ids) {
        if (!is_current()) return;
        callbacks.on_task_start(id);
    }

    try {
        const response = await start_audit_snapshot_capture(
            String(audit_id),
            {
                captureId: capture_id,
                sampleId: host.get_pending_sample_id(),
                url: normalized_url,
                attachScreenshotToSample: !skip_screenshot_attach,
            },
            active_abort_controller.signal
        );

        if (!is_current()) return;

        const page_outcome = map_task_outcome(response.pageTitle.outcome);
        const title_result =
            page_outcome === 'success'
                ? apply_page_title_from_capture(host, response)
                : 'failed';
        callbacks.on_task_complete('page_title', title_result);

        if (!is_current()) return;

        const screenshot_result =
            response.screenshot.outcome === 'failed'
                ? 'failed'
                : apply_screenshot_from_capture(host, response);
        callbacks.on_task_complete('screenshot', screenshot_result);
    } catch (err) {
        if (!is_current()) return;
        const aborted = err instanceof Error && err.name === 'AbortError';
        if (aborted) return;
        callbacks.on_task_complete('page_title', 'failed');
        callbacks.on_task_complete('screenshot', 'failed');
    } finally {
        active_capture_id = null;
        active_abort_controller = null;
    }
}
