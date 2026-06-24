/**
 * @fileoverview Automatisk URL-skärmdump vid blur i stickprovsformuläret.
 */

import {
    can_upload_audit_media,
    capture_audit_url_screenshot,
    delete_audit_media
} from '../../api/audit_media_api.js';
import { update_sample_attach_media_button } from './sample_attach_media.js';

export type SampleUrlAutoScreenshotComponentLike = {
    url_input: HTMLInputElement | null;
    url_form_group_ref: HTMLElement | null;
    sample_attached_media_filenames: string[];
    url_auto_screenshot_filename: string | null;
    url_auto_screenshot_source_url: string | null;
    url_auto_screenshot_generation: number;
    current_editing_sample_id: string | null;
    getState?: () => { auditId?: string | null } | null;
    get_t_internally: () => (key: string, params?: Record<string, unknown>) => string;
    Helpers?: { add_protocol_if_missing?: (url: string) => string };
    save_form_data_immediately: (is_autosave?: boolean, should_trim?: boolean, skip_render?: boolean) => void;
    _persist_new_sample_draft: (should_trim: boolean) => void;
};

type SampleDataWithAutoScreenshot = {
    url?: string | null;
    urlAutoScreenshotFilename?: string | null;
    attachedMediaFilenames?: unknown;
};

export function normalize_url_for_screenshot(raw: string, add_protocol?: (url: string) => string): string {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    return add_protocol ? add_protocol(trimmed) : trimmed;
}

export function is_url_field_visible_for_screenshot(component: SampleUrlAutoScreenshotComponentLike): boolean {
    if (!component.url_form_group_ref || !component.url_input) return false;
    return component.url_form_group_ref.style.display !== 'none';
}

export function remove_filename_from_list(filenames: string[], filename: string | null | undefined): string[] {
    if (!filename) return [...filenames];
    return filenames.filter((name) => name !== filename);
}

export function replace_auto_screenshot_filename(
    filenames: string[],
    old_filename: string | null | undefined,
    new_filename: string
): string[] {
    const without_old = remove_filename_from_list(filenames, old_filename);
    if (without_old.includes(new_filename)) {
        return without_old;
    }
    return [...without_old, new_filename];
}

export function should_skip_url_screenshot_capture(
    normalized_url: string,
    last_captured_url: string | null,
    auto_filename: string | null
): boolean {
    return Boolean(normalized_url && normalized_url === last_captured_url && auto_filename);
}

export function sync_sample_auto_screenshot_state_from_data(
    component: SampleUrlAutoScreenshotComponentLike,
    effective_sample_data: SampleDataWithAutoScreenshot | null | undefined
): void {
    const auto_filename = effective_sample_data?.urlAutoScreenshotFilename;
    component.url_auto_screenshot_filename =
        typeof auto_filename === 'string' && auto_filename.trim() ? auto_filename.trim() : null;
    const sample_url = normalize_url_for_screenshot(String(effective_sample_data?.url || ''));
    component.url_auto_screenshot_source_url =
        component.url_auto_screenshot_filename && sample_url ? sample_url : null;
}

async function remove_auto_screenshot_quietly(
    component: SampleUrlAutoScreenshotComponentLike,
    audit_id: string
): Promise<void> {
    const auto_filename = component.url_auto_screenshot_filename;
    if (!auto_filename) {
        component.url_auto_screenshot_source_url = null;
        return;
    }

    component.sample_attached_media_filenames = remove_filename_from_list(
        component.sample_attached_media_filenames,
        auto_filename
    );
    component.url_auto_screenshot_filename = null;
    component.url_auto_screenshot_source_url = null;

    try {
        await delete_audit_media(audit_id, auto_filename);
    } catch {
        // Tyst — filen kan redan vara borttagen
    }

    update_sample_attach_media_button(component);
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

/**
 * Tar bort auto-skärmdump när URL-fältet döljs eller rensas (t.ex. kategori utan URL).
 */
export async function clear_sample_auto_screenshot_if_needed(
    component: SampleUrlAutoScreenshotComponentLike
): Promise<void> {
    const audit_id = component.getState?.()?.auditId ?? null;
    if (!component.url_auto_screenshot_filename) {
        component.url_auto_screenshot_source_url = null;
        return;
    }
    if (!audit_id || !can_upload_audit_media(audit_id)) {
        component.sample_attached_media_filenames = remove_filename_from_list(
            component.sample_attached_media_filenames,
            component.url_auto_screenshot_filename
        );
        component.url_auto_screenshot_filename = null;
        component.url_auto_screenshot_source_url = null;
        return;
    }
    await remove_auto_screenshot_quietly(component, audit_id);
}

/**
 * Hanterar blur på URL-fält — tar eller byter skärmdump i bakgrunden utan notis.
 */
export async function handle_sample_url_blur(component: SampleUrlAutoScreenshotComponentLike): Promise<void> {
    if (!is_url_field_visible_for_screenshot(component)) {
        return;
    }

    const audit_id = component.getState?.()?.auditId ?? null;
    if (!audit_id || !can_upload_audit_media(audit_id)) {
        return;
    }

    const normalized_url = read_normalized_url_from_input(component);
    const generation = (component.url_auto_screenshot_generation || 0) + 1;
    component.url_auto_screenshot_generation = generation;

    if (!normalized_url) {
        await remove_auto_screenshot_quietly(component, audit_id);
        return;
    }

    if (
        should_skip_url_screenshot_capture(
            normalized_url,
            component.url_auto_screenshot_source_url,
            component.url_auto_screenshot_filename
        )
    ) {
        return;
    }

    const previous_auto_filename = component.url_auto_screenshot_filename;

    try {
        const t = component.get_t_internally();
        const result = await capture_audit_url_screenshot(
            audit_id,
            normalized_url,
            t('sample_screenshot_filename_suffix')
        );

        if (component.url_auto_screenshot_generation !== generation) {
            return;
        }

        if (previous_auto_filename && previous_auto_filename !== result.filename) {
            try {
                await delete_audit_media(audit_id, previous_auto_filename);
            } catch {
                // Tyst
            }
        }

        component.sample_attached_media_filenames = replace_auto_screenshot_filename(
            component.sample_attached_media_filenames,
            previous_auto_filename,
            result.filename
        );
        component.url_auto_screenshot_filename = result.filename;
        component.url_auto_screenshot_source_url = normalized_url;
        update_sample_attach_media_button(component);
        persist_sample_form_after_auto_screenshot(component);
    } catch {
        if (component.url_auto_screenshot_generation !== generation) {
            return;
        }
        // Ogiltig eller oåtkomlig URL — ingen skärmdump, tyst avbryt
    }
}

export function on_sample_attach_media_saved(
    component: SampleUrlAutoScreenshotComponentLike,
    filenames: string[]
): void {
    const auto_filename = component.url_auto_screenshot_filename;
    if (auto_filename && !filenames.includes(auto_filename)) {
        component.url_auto_screenshot_filename = null;
        component.url_auto_screenshot_source_url = null;
    }
}
