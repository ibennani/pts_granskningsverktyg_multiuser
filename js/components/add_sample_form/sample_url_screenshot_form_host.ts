/**
 * @fileoverview Bygger ett host-objekt med closures mot stickprovsformuläret för URL-skärmdump.
 */

import type { SampleUrlAutoScreenshotComponentLike } from './sample_url_auto_screenshot.js';

export type SampleUrlScreenshotFormHostSource = {
    url_input: HTMLInputElement | null;
    url_form_group_ref: HTMLElement | null;
    sample_attach_media_btn: HTMLButtonElement | null;
    current_editing_sample_id: string | null;
    sample_attached_media_filenames: string[];
    url_auto_screenshot_filename: string | null;
    url_auto_screenshot_source_url: string | null;
    url_auto_screenshot_generation: number;
    sample_url_screenshot_in_progress: boolean;
    getState?: () => { auditId?: string | null } | null;
    get_t_internally: () => (key: string, params?: Record<string, unknown>) => string;
    Helpers?: { add_protocol_if_missing?: (url: string) => string };
    save_form_data_immediately: (is_autosave?: boolean, should_trim?: boolean, skip_render?: boolean) => void;
    _persist_new_sample_draft: (should_trim: boolean) => void;
    ensure_audit_id_for_media?: () => Promise<string | null>;
    NotificationComponent?: { show_global_message?: (message: string, level: string) => void };
};

export function build_sample_url_screenshot_form_host(
    form: SampleUrlScreenshotFormHostSource
): SampleUrlAutoScreenshotComponentLike {
    return {
        url_input: form.url_input,
        url_form_group_ref: form.url_form_group_ref,
        sample_attach_media_btn: form.sample_attach_media_btn,
        current_editing_sample_id: form.current_editing_sample_id,
        getState: form.getState ? () => form.getState!() : undefined,
        get_t_internally: () => form.get_t_internally(),
        Helpers: form.Helpers,
        save_form_data_immediately: (is_autosave, should_trim, skip_render) => {
            form.save_form_data_immediately(is_autosave, should_trim, skip_render);
        },
        _persist_new_sample_draft: (should_trim) => {
            form._persist_new_sample_draft(should_trim);
        },
        ensure_audit_id_for_media: form.ensure_audit_id_for_media
            ? () => form.ensure_audit_id_for_media!()
            : undefined,
        get_attached_media_filenames: () => [...form.sample_attached_media_filenames],
        set_attached_media_filenames: (filenames) => {
            form.sample_attached_media_filenames = [...filenames];
        },
        get_url_auto_screenshot_filename: () => form.url_auto_screenshot_filename,
        get_url_auto_screenshot_source_url: () => form.url_auto_screenshot_source_url,
        set_url_auto_screenshot_tracking: (filename, source_url) => {
            form.url_auto_screenshot_filename = filename;
            form.url_auto_screenshot_source_url = source_url;
        },
        get_url_auto_screenshot_generation: () => form.url_auto_screenshot_generation,
        set_url_auto_screenshot_generation: (generation) => {
            form.url_auto_screenshot_generation = generation;
        },
        is_url_screenshot_in_progress: () => Boolean(form.sample_url_screenshot_in_progress),
        set_url_screenshot_in_progress_flag: (in_progress) => {
            form.sample_url_screenshot_in_progress = in_progress;
        },
        show_url_screenshot_error: (message) => {
            form.NotificationComponent?.show_global_message?.(message, 'error');
        }
    };
}
