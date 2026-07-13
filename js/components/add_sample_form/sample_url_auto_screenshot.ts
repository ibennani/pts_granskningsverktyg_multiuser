/**
 * @fileoverview Automatisk URL-skärmdump vid klick på Analysera sida i granskningsdelsformuläret.
 */

import {
    can_upload_audit_media,
    capture_audit_url_screenshot,
    delete_audit_media
} from '../../api/audit_media_api.js';
import { update_sample_attach_media_button, update_sample_url_screenshot_live_status } from './sample_attach_media.js';
import {
    normalize_url_for_screenshot,
    on_sample_attach_media_saved,
    remove_filename_from_list,
    replace_auto_screenshot_filename,
    should_skip_url_screenshot_capture,
    should_skip_url_screenshot_when_attached_media_exists,
    sync_sample_auto_screenshot_state_from_data,
    is_url_form_group_visible
} from './sample_url_auto_screenshot_logic.js';

export {
    normalize_url_for_screenshot,
    on_sample_attach_media_saved,
    remove_filename_from_list,
    replace_auto_screenshot_filename,
    should_skip_url_screenshot_capture,
    should_skip_url_screenshot_when_attached_media_exists,
    sync_sample_auto_screenshot_state_from_data
} from './sample_url_auto_screenshot_logic.js';

export type SampleUrlAutoScreenshotComponentLike = {
    url_input: HTMLInputElement | null;
    url_form_group_ref: HTMLElement | null;
    sample_attach_media_btn: HTMLButtonElement | null;
    current_editing_sample_id: string | null;
    getState?: () => { auditId?: string | null } | null;
    get_t_internally: () => (key: string, params?: Record<string, unknown>) => string;
    Helpers?: { add_protocol_if_missing?: (url: string) => string };
    save_form_data_immediately: (is_autosave?: boolean, should_trim?: boolean, skip_render?: boolean) => void;
    _persist_new_sample_draft: (should_trim: boolean) => void;
    ensure_audit_id_for_media?: () => Promise<string | null>;
    get_attached_media_filenames: () => string[];
    set_attached_media_filenames: (filenames: string[]) => void;
    get_url_auto_screenshot_filename: () => string | null;
    get_url_auto_screenshot_source_url: () => string | null;
    set_url_auto_screenshot_tracking: (filename: string | null, source_url: string | null) => void;
    get_url_auto_screenshot_generation: () => number;
    set_url_auto_screenshot_generation: (generation: number) => void;
    is_url_screenshot_in_progress: () => boolean;
    set_url_screenshot_in_progress_flag: (in_progress: boolean) => void;
    show_url_screenshot_error?: (message: string) => void;
};

function announce_url_screenshot_status(
    component: SampleUrlAutoScreenshotComponentLike,
    status: 'capturing' | 'success' | 'failed' | 'idle'
): void {
    update_sample_url_screenshot_live_status(component, status);
}

function set_url_screenshot_in_progress(
    component: SampleUrlAutoScreenshotComponentLike,
    in_progress: boolean
): void {
    component.set_url_screenshot_in_progress_flag(in_progress);
    update_sample_attach_media_button({
        sample_attach_media_btn: component.sample_attach_media_btn,
        sample_attached_media_filenames: component.get_attached_media_filenames(),
        get_t_internally: component.get_t_internally,
        sample_url_screenshot_in_progress: in_progress
    });
}

export function is_url_field_visible_for_screenshot(component: SampleUrlAutoScreenshotComponentLike): boolean {
    return is_url_form_group_visible(component.url_form_group_ref, component.url_input);
}

async function remove_auto_screenshot_quietly(
    component: SampleUrlAutoScreenshotComponentLike,
    audit_id: string
): Promise<void> {
    const auto_filename = component.get_url_auto_screenshot_filename();
    if (!auto_filename) {
        component.set_url_auto_screenshot_tracking(null, null);
        return;
    }

    component.set_attached_media_filenames(
        remove_filename_from_list(component.get_attached_media_filenames(), auto_filename)
    );
    component.set_url_auto_screenshot_tracking(null, null);

    try {
        await delete_audit_media(audit_id, auto_filename);
    } catch {
        // Tyst — filen kan redan vara borttagen
    }

    update_sample_attach_media_button({
        sample_attach_media_btn: component.sample_attach_media_btn,
        sample_attached_media_filenames: component.get_attached_media_filenames(),
        get_t_internally: component.get_t_internally,
        sample_url_screenshot_in_progress: component.is_url_screenshot_in_progress()
    });
    persist_sample_form_after_auto_screenshot(component);
}

function persist_sample_form_after_auto_screenshot(component: SampleUrlAutoScreenshotComponentLike): void {
    if (component.current_editing_sample_id) {
        component.save_form_data_immediately(true, false, true);
    } else {
        component._persist_new_sample_draft(false);
    }
}

function read_normalized_url_from_input(component: SampleUrlAutoScreenshotComponentLike): string {
    const raw = component.url_input?.value || '';
    return normalize_url_for_screenshot(raw, component.Helpers?.add_protocol_if_missing);
}

function is_capture_generation_current(
    component: SampleUrlAutoScreenshotComponentLike,
    generation: number
): boolean {
    return component.get_url_auto_screenshot_generation() === generation;
}

function report_url_screenshot_failure(
    component: SampleUrlAutoScreenshotComponentLike,
    detail?: string
): void {
    const t = component.get_t_internally();
    const base = t('sample_screenshot_live_failed');
    const message = detail ? `${base}: ${detail}` : base;
    component.show_url_screenshot_error?.(message);
    announce_url_screenshot_status(component, 'failed');
}

/**
 * Tar bort auto-skärmdump när URL-fältet döljs eller rensas (t.ex. kategori utan URL).
 */
export async function clear_sample_auto_screenshot_if_needed(
    component: SampleUrlAutoScreenshotComponentLike
): Promise<void> {
    const audit_id = component.getState?.()?.auditId ?? null;
    if (!component.get_url_auto_screenshot_filename()) {
        component.set_url_auto_screenshot_tracking(null, null);
        return;
    }
    if (!audit_id || !can_upload_audit_media(audit_id)) {
        component.set_attached_media_filenames(
            remove_filename_from_list(
                component.get_attached_media_filenames(),
                component.get_url_auto_screenshot_filename()
            )
        );
        component.set_url_auto_screenshot_tracking(null, null);
        return;
    }
    await remove_auto_screenshot_quietly(component, audit_id);
}

/**
 * Hanterar klick på Analysera sida — tar eller byter skärmdump i bakgrunden utan notis.
 */
export async function handle_sample_url_blur(
    component: SampleUrlAutoScreenshotComponentLike
): Promise<void> {
    if (!is_url_field_visible_for_screenshot(component)) {
        return;
    }

    const audit_id_from_state = component.getState?.()?.auditId ?? null;
    let audit_id = audit_id_from_state ? String(audit_id_from_state) : null;
    if (!audit_id && component.ensure_audit_id_for_media) {
        audit_id = await component.ensure_audit_id_for_media();
    }
    if (!audit_id || !can_upload_audit_media(audit_id)) {
        return;
    }

    const normalized_url = read_normalized_url_from_input(component);
    if (!normalized_url) {
        await remove_auto_screenshot_quietly(component, audit_id);
        return;
    }

    const attached_filenames = component.get_attached_media_filenames();
    const auto_filename = component.get_url_auto_screenshot_filename();

    if (should_skip_url_screenshot_when_attached_media_exists(attached_filenames, auto_filename)) {
        return;
    }

    if (
        should_skip_url_screenshot_capture(
            normalized_url,
            component.get_url_auto_screenshot_source_url(),
            auto_filename,
            attached_filenames
        )
    ) {
        return;
    }

    if (component.is_url_screenshot_in_progress()) {
        return;
    }

    const previous_auto_filename = auto_filename;
    const generation = component.get_url_auto_screenshot_generation() + 1;
    component.set_url_auto_screenshot_generation(generation);

    announce_url_screenshot_status(component, 'capturing');
    set_url_screenshot_in_progress(component, true);

    try {
        const t = component.get_t_internally();
        const result = await capture_audit_url_screenshot(
            audit_id,
            normalized_url,
            t('sample_screenshot_filename_suffix')
        );

        if (!is_capture_generation_current(component, generation)) {
            return;
        }

        if (!result?.filename) {
            throw new Error('Saknar filnamn i svar från servern');
        }

        if (previous_auto_filename && previous_auto_filename !== result.filename) {
            try {
                await delete_audit_media(audit_id, previous_auto_filename);
            } catch {
                // Tyst
            }
        }

        component.set_attached_media_filenames(
            replace_auto_screenshot_filename(attached_filenames, previous_auto_filename, result.filename)
        );
        component.set_url_auto_screenshot_tracking(result.filename, normalized_url);
        update_sample_attach_media_button({
            sample_attach_media_btn: component.sample_attach_media_btn,
            sample_attached_media_filenames: component.get_attached_media_filenames(),
            get_t_internally: component.get_t_internally,
            sample_url_screenshot_in_progress: false
        });
        announce_url_screenshot_status(component, 'success');
        persist_sample_form_after_auto_screenshot(component);
    } catch (err) {
        if (!is_capture_generation_current(component, generation)) {
            return;
        }
        const detail = err instanceof Error ? err.message : String(err);
        report_url_screenshot_failure(component, detail);
    } finally {
        if (is_capture_generation_current(component, generation)) {
            set_url_screenshot_in_progress(component, false);
        }
    }
}
