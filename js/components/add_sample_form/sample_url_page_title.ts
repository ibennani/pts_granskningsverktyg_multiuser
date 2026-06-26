/**
 * @fileoverview Hämtar sidtitel från URL och fyller beskrivningsfältet i granskningsdelsformuläret.
 */

import { can_upload_audit_media, fetch_audit_url_page_title } from '../../api/audit_media_api.js';
import { normalize_url_for_screenshot, is_url_form_group_visible } from './sample_url_auto_screenshot_logic.js';
import {
    sanitize_page_title_for_description,
    should_apply_page_title_to_description
} from './sample_url_page_title_logic.js';
import {
    begin_sample_description_page_title_loading,
    end_sample_description_page_title_loading,
    type SampleUrlPageTitleLabelComponentLike
} from './sample_url_page_title_label.js';

export type SampleUrlPageTitleFormHostSource = {
    url_input: HTMLInputElement | null;
    url_form_group_ref: HTMLElement | null;
    description_input: HTMLInputElement | null;
    description_label_element: HTMLLabelElement | null;
    previous_url_page_title: string;
    previous_sample_type_value: string;
    url_page_title_generation: number;
    page_title_label_loading_count: number;
    current_editing_sample_id: string | null;
    getState?: () => { auditId?: string | null } | null;
    Helpers?: {
        add_protocol_if_missing?: (url: string) => string;
        sanitize_plain_input?: (value: string, opts?: { trim?: boolean }) => string;
        get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
    };
    get_t_internally: () => (key: string, params?: Record<string, unknown>) => string;
    ensure_audit_id_for_media?: () => Promise<string | null>;
    save_form_data_immediately: (is_autosave?: boolean, should_trim?: boolean, skip_render?: boolean) => void;
    _persist_new_sample_draft: (should_trim: boolean) => void;
};

export function build_sample_url_page_title_form_host(
    form: SampleUrlPageTitleFormHostSource
): SampleUrlPageTitleComponentLike {
    return {
        url_input: form.url_input,
        url_form_group_ref: form.url_form_group_ref,
        description_input: form.description_input,
        description_label_element: form.description_label_element,
        previous_url_page_title: form.previous_url_page_title,
        previous_sample_type_value: form.previous_sample_type_value,
        url_page_title_generation: form.url_page_title_generation,
        current_editing_sample_id: form.current_editing_sample_id,
        getState: form.getState ? () => form.getState!() : undefined,
        Helpers: form.Helpers,
        get_t_internally: () => form.get_t_internally(),
        get_page_title_label_loading_count: () => form.page_title_label_loading_count,
        set_page_title_label_loading_count: (count) => {
            form.page_title_label_loading_count = count;
        },
        ensure_audit_id_for_media: form.ensure_audit_id_for_media
            ? () => form.ensure_audit_id_for_media!()
            : undefined,
        save_form_data_immediately: (is_autosave, should_trim, skip_render) => {
            form.save_form_data_immediately(is_autosave, should_trim, skip_render);
        },
        _persist_new_sample_draft: (should_trim) => {
            form._persist_new_sample_draft(should_trim);
        },
        set_previous_url_page_title: (title) => {
            form.previous_url_page_title = title;
        },
        bump_url_page_title_generation: () => {
            form.url_page_title_generation += 1;
            return form.url_page_title_generation;
        },
        is_url_page_title_generation_current: (generation) => form.url_page_title_generation === generation
    };
}

export type SampleUrlPageTitleComponentLike = SampleUrlPageTitleLabelComponentLike & {
    url_input: HTMLInputElement | null;
    url_form_group_ref: HTMLElement | null;
    description_input: HTMLInputElement | null;
    previous_url_page_title: string;
    previous_sample_type_value: string;
    url_page_title_generation: number;
    getState?: () => { auditId?: string | null } | null;
    Helpers?: {
        add_protocol_if_missing?: (url: string) => string;
        sanitize_plain_input?: (value: string, opts?: { trim?: boolean }) => string;
        get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
    };
    ensure_audit_id_for_media?: () => Promise<string | null>;
    save_form_data_immediately: (is_autosave?: boolean, should_trim?: boolean, skip_render?: boolean) => void;
    _persist_new_sample_draft: (should_trim: boolean) => void;
    current_editing_sample_id: string | null;
    set_previous_url_page_title: (title: string) => void;
    bump_url_page_title_generation: () => number;
    is_url_page_title_generation_current: (generation: number) => boolean;
};

export {
    begin_sample_description_page_title_loading,
    end_sample_description_page_title_loading
} from './sample_url_page_title_label.js';

function persist_after_page_title(component: SampleUrlPageTitleComponentLike): void {
    if (component.current_editing_sample_id) {
        component.save_form_data_immediately(true, false, true);
    } else {
        component._persist_new_sample_draft(false);
    }
}

export function apply_page_title_to_description(
    component: SampleUrlPageTitleComponentLike,
    raw_page_title: string
): boolean {
    if (!component.description_input) return false;

    const page_title = sanitize_page_title_for_description(raw_page_title);
    if (!page_title || page_title === 'sida') return false;

    const current_description = component.description_input.value || '';
    if (
        !should_apply_page_title_to_description(
            current_description,
            component.previous_url_page_title,
            component.previous_sample_type_value
        )
    ) {
        return false;
    }

    const safe_title = component.Helpers?.sanitize_plain_input
        ? component.Helpers.sanitize_plain_input(page_title, { trim: true })
        : page_title;

    if (!safe_title) return false;

    component.description_input.value = safe_title;
    component.set_previous_url_page_title(safe_title);
    persist_after_page_title(component);
    return true;
}

async function resolve_audit_id_for_page_title(component: SampleUrlPageTitleComponentLike): Promise<string | null> {
    const audit_id_from_state = component.getState?.()?.auditId ?? null;
    let audit_id = audit_id_from_state ? String(audit_id_from_state) : null;
    if (!audit_id && component.ensure_audit_id_for_media) {
        audit_id = await component.ensure_audit_id_for_media();
    }
    if (!audit_id || !can_upload_audit_media(audit_id)) {
        return null;
    }
    return audit_id;
}

/**
 * Hämtar sidtitel när URL-fältet tappar fokus — visar laddning på etiketten direkt.
 */
export async function handle_sample_url_page_title_on_blur(
    component: SampleUrlPageTitleComponentLike
): Promise<void> {
    if (!is_url_form_group_visible(component.url_form_group_ref, component.url_input)) {
        return;
    }

    const normalized_url = normalize_url_for_screenshot(
        component.url_input?.value || '',
        component.Helpers?.add_protocol_if_missing
    );
    if (!normalized_url) {
        return;
    }

    const generation = component.bump_url_page_title_generation();
    begin_sample_description_page_title_loading(component);

    try {
        const audit_id = await resolve_audit_id_for_page_title(component);
        if (!audit_id || !component.is_url_page_title_generation_current(generation)) {
            return;
        }

        const result = await fetch_audit_url_page_title(audit_id, normalized_url);
        if (!component.is_url_page_title_generation_current(generation)) {
            return;
        }
        apply_page_title_to_description(component, result.pageTitle);
    } catch {
        // Tyst — användaren kan skriva beskrivning manuellt
    } finally {
        end_sample_description_page_title_loading(component);
    }
}

/**
 * @deprecated Använd handle_sample_url_page_title_on_blur vid URL-blur.
 */
export async function fetch_and_apply_page_title_from_url(
    component: SampleUrlPageTitleComponentLike
): Promise<void> {
    await handle_sample_url_page_title_on_blur(component);
}
