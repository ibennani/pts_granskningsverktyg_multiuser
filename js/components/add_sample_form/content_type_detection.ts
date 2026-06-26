/**
 * @fileoverview Automatisk innehållstyp-detektering via URL i granskningsdelsformuläret.
 */

import {
    can_upload_audit_media,
    detect_content_types_from_url,
} from '../../api/audit_media_api.js';
import { normalize_url_for_screenshot } from './sample_url_auto_screenshot_logic.js';
import {
    collect_allowed_content_type_ids,
    should_apply_detected_content_types,
} from './content_type_detection_logic.js';
import {
    get_selected_content_type_ids,
    sync_content_type_selection_from_dom,
} from './content_type_accordion.js';

export type ContentTypeDetectionComponentLike = {
    url_input: HTMLInputElement | null;
    url_form_group_ref: HTMLElement | null;
    content_types_section_panel_inner: HTMLElement | null;
    content_type_analyze_btn: HTMLButtonElement | null;
    content_type_analyze_live_region: HTMLElement | null;
    content_type_detection_in_progress?: boolean;
    content_type_detection_generation?: number;
    getState?: () => {
        auditId?: string | null;
        ruleFileContent?: Parameters<typeof collect_allowed_content_type_ids>[0];
    } | null;
    get_t_internally: () => (key: string, params?: Record<string, unknown>) => string;
    Helpers?: { add_protocol_if_missing?: (url: string) => string };
    ensure_audit_id_for_media?: () => Promise<string | null>;
    save_form_data_immediately: (is_autosave?: boolean, should_trim?: boolean, skip_render?: boolean) => void;
    _updateParentCheckboxState?: (parent_checkbox: HTMLInputElement) => void;
    handle_autosave_input?: () => void;
};

export function is_content_type_analyze_available(component: ContentTypeDetectionComponentLike): boolean {
    if (!component.url_form_group_ref || !component.url_input) return false;
    const group = component.url_form_group_ref;
    if (group.style.display === 'none' || group.hidden) return false;
    if (group.getClientRects().length === 0) return false;
    const raw = component.url_input?.value || '';
    return Boolean(normalize_url_for_screenshot(raw, component.Helpers?.add_protocol_if_missing));
}

export function update_content_type_analyze_visibility(component: ContentTypeDetectionComponentLike): void {
    const btn = component.content_type_analyze_btn;
    if (!btn) return;
    const show = is_content_type_analyze_available(component);
    btn.hidden = !show;
    btn.style.display = show ? '' : 'none';
}

function set_detection_live_status(
    component: ContentTypeDetectionComponentLike,
    message: string
): void {
    const region = component.content_type_analyze_live_region;
    if (!region) return;
    region.textContent = message;
}

function set_detection_in_progress(
    component: ContentTypeDetectionComponentLike,
    in_progress: boolean
): void {
    component.content_type_detection_in_progress = in_progress;
    const btn = component.content_type_analyze_btn;
    if (btn) {
        btn.textContent = in_progress
            ? component.get_t_internally()('content_type_analyze_capturing')
            : component.get_t_internally()('content_type_analyze_button');
    }
}

export function apply_detected_content_types(
    component: ContentTypeDetectionComponentLike,
    detected_ids: string[]
): number {
    const panel_inner = component.content_types_section_panel_inner;
    if (!panel_inner) return 0;

    let applied = 0;
    for (const id of detected_ids) {
        const checkbox = panel_inner.querySelector(
            `input[name="selectedContentTypes"][value="${CSS.escape(id)}"]`
        ) as HTMLInputElement | null;
        if (!checkbox || checkbox.checked) continue;

        checkbox.checked = true;
        applied += 1;

        const parent_id = checkbox.dataset.childFor;
        if (parent_id && component._updateParentCheckboxState) {
            const parent_checkbox = panel_inner.querySelector(
                `input[data-parent-id="${CSS.escape(parent_id)}"]`
            ) as HTMLInputElement | null;
            if (parent_checkbox) {
                component._updateParentCheckboxState(parent_checkbox);
            }
        }
    }

    sync_content_type_selection_from_dom(component);
    return applied;
}

export async function handle_analyze_page_content_click(
    component: ContentTypeDetectionComponentLike
): Promise<void> {
    if (!is_content_type_analyze_available(component)) {
        return;
    }

    const t = component.get_t_internally();
    let audit_id = component.getState?.()?.auditId ? String(component.getState()?.auditId) : null;
    if (!audit_id && component.ensure_audit_id_for_media) {
        audit_id = await component.ensure_audit_id_for_media();
    }
    if (!audit_id || !can_upload_audit_media(audit_id)) {
        set_detection_live_status(component, t('content_type_analyze_failed'));
        return;
    }

    const normalized_url = normalize_url_for_screenshot(
        component.url_input?.value || '',
        component.Helpers?.add_protocol_if_missing
    );
    const allowed_ids = collect_allowed_content_type_ids(component.getState?.()?.ruleFileContent);
    if (allowed_ids.length === 0) {
        set_detection_live_status(component, t('content_type_analyze_no_allowed_ids'));
        return;
    }

    const generation = (component.content_type_detection_generation || 0) + 1;
    component.content_type_detection_generation = generation;

    set_detection_in_progress(component, true);
    set_detection_live_status(component, t('content_type_analyze_capturing'));

    try {
        const result = await detect_content_types_from_url(audit_id, normalized_url, allowed_ids);
        if (component.content_type_detection_generation !== generation) {
            return;
        }

        const detected_ids = result.detectedContentTypeIds || [];
        const selected_before = get_selected_content_type_ids(component);

        if (should_apply_detected_content_types(selected_before)) {
            if (detected_ids.length === 0) {
                set_detection_live_status(component, t('content_type_analyze_none_found'));
                return;
            }
            const applied = apply_detected_content_types(component, detected_ids);
            component.save_form_data_immediately(true, false, true);
            set_detection_live_status(
                component,
                t('content_type_analyze_applied', { count: applied || detected_ids.length })
            );
            return;
        }

        if (detected_ids.length === 0) {
            set_detection_live_status(component, t('content_type_analyze_none_found'));
            return;
        }

        set_detection_live_status(
            component,
            t('content_type_analyze_existing_selection', { count: detected_ids.length })
        );
    } catch {
        if (component.content_type_detection_generation !== generation) {
            return;
        }
        set_detection_live_status(component, t('content_type_analyze_failed'));
    } finally {
        if (component.content_type_detection_generation === generation) {
            set_detection_in_progress(component, false);
        }
    }
}
