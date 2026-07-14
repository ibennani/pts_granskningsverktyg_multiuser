/**
 * @fileoverview Snapshot och återställning vid stopp av hämtning i modalen Hämta information.
 */

import { can_upload_audit_media, delete_audit_media } from '../../api/audit_media_api.js';
import { update_sample_attach_media_button } from './sample_attach_media.js';
import type { SampleUrlAnalyzeFlowHost } from './sample_url_analyze_tasks.js';

export type SampleUrlAnalyzeFetchSnapshot = {
    description: string;
    previous_url_page_title: string;
    attached_media_filenames: string[];
    url_auto_screenshot_filename: string | null;
    url_auto_screenshot_source_url: string | null;
};

export function capture_sample_url_analyze_fetch_snapshot(
    host: SampleUrlAnalyzeFlowHost
): SampleUrlAnalyzeFetchSnapshot {
    return {
        description: host.description_input?.value || '',
        previous_url_page_title: host.previous_url_page_title,
        attached_media_filenames: [...host.sample_attached_media_filenames],
        url_auto_screenshot_filename: host.url_auto_screenshot_filename,
        url_auto_screenshot_source_url: host.url_auto_screenshot_source_url,
    };
}

function abort_inflight_sample_url_tasks(host: SampleUrlAnalyzeFlowHost): void {
    host.url_page_title_generation += 1;
    host.url_auto_screenshot_generation += 1;
    host.bump_url_analyze_generation();
}

async function delete_auto_screenshot_file(
    host: SampleUrlAnalyzeFlowHost,
    filename: string
): Promise<void> {
    const audit_id_from_state = host.getState?.()?.auditId ?? null;
    let audit_id = audit_id_from_state ? String(audit_id_from_state) : null;
    if (!audit_id && host.ensure_audit_id_for_media) {
        audit_id = await host.ensure_audit_id_for_media();
    }
    if (!audit_id || !can_upload_audit_media(audit_id)) {
        return;
    }

    try {
        await delete_audit_media(audit_id, filename);
    } catch {
        // Tyst — filen kan redan vara borttagen
    }
}

function persist_after_rollback(host: SampleUrlAnalyzeFlowHost): void {
    if (host.current_editing_sample_id) {
        host.save_form_data_immediately(true, false, true);
    } else {
        host._persist_new_sample_draft(false);
    }
}

export async function rollback_sample_url_analyze_fetch(
    host: SampleUrlAnalyzeFlowHost,
    snapshot: SampleUrlAnalyzeFetchSnapshot
): Promise<void> {
    abort_inflight_sample_url_tasks(host);

    const current_auto_filename = host.url_auto_screenshot_filename;
    if (
        current_auto_filename &&
        current_auto_filename !== snapshot.url_auto_screenshot_filename
    ) {
        await delete_auto_screenshot_file(host, current_auto_filename);
    }

    if (host.description_input) {
        host.description_input.value = snapshot.description;
    }
    host.previous_url_page_title = snapshot.previous_url_page_title;
    host.sample_attached_media_filenames = [...snapshot.attached_media_filenames];
    host.url_auto_screenshot_filename = snapshot.url_auto_screenshot_filename;
    host.url_auto_screenshot_source_url = snapshot.url_auto_screenshot_source_url;
    host.sample_url_screenshot_in_progress = false;

    update_sample_attach_media_button({
        sample_attach_media_btn: host.sample_attach_media_btn,
        sample_attached_media_filenames: host.sample_attached_media_filenames,
        get_t_internally: host.get_t_internally,
        sample_url_screenshot_in_progress: false,
    });

    persist_after_rollback(host);
}
