/**
 * @fileoverview Hjälpfunktioner för automatisk innehållstyp-detektering i granskningsdelsformuläret.
 */

import {
    sync_content_type_selection_from_dom,
} from './content_type_accordion.js';

export type ContentTypeDetectionComponentLike = {
    content_types_section_panel_inner: HTMLElement | null;
    content_type_analyze_live_region: HTMLElement | null;
    getState?: () => {
        ruleFileContent?: { metadata?: Record<string, unknown> } | null;
    } | null;
    save_form_data_immediately: (is_autosave?: boolean, should_trim?: boolean, skip_render?: boolean) => void;
    _updateParentCheckboxState?: (parent_checkbox: HTMLInputElement) => void;
};

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
