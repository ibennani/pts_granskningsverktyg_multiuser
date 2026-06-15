/**
 * @file Hjälp för fokus och utkast i AI-inställningsvyn.
 */

import type { AiSettingsData } from './ai_settings_view_helpers.ts';
import type { AiSettingsDraft } from './ai_settings_draft.ts';

export interface AiSettingsFocusInfo {
    element_id: string | null;
    element_name: string | null;
    selection_start: number | null;
    selection_end: number | null;
}

export function capture_ai_settings_focus(root: HTMLElement | null): AiSettingsFocusInfo | null {
    const active = document.activeElement;
    if (!active || !root?.contains(active)) return null;
    const input = active as HTMLInputElement | HTMLTextAreaElement;
    return {
        element_id: active.id || null,
        element_name: active.getAttribute('name'),
        selection_start: input.selectionStart ?? null,
        selection_end: input.selectionEnd ?? null
    };
}

export function restore_ai_settings_focus(
    root: HTMLElement | null,
    focus_info: AiSettingsFocusInfo | null
): void {
    if (!focus_info || !root) return;
    let element: HTMLElement | null = null;
    if (focus_info.element_id) {
        element = root.querySelector(`#${CSS.escape(focus_info.element_id)}`);
    }
    if (!element && focus_info.element_name) {
        element = root.querySelector(`[name="${CSS.escape(focus_info.element_name)}"]`);
    }
    if (!element) return;
    try {
        element.focus({ preventScroll: true });
    } catch {
        element.focus();
    }
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    if (
        focus_info.selection_start !== null &&
        focus_info.selection_end !== null &&
        typeof input.setSelectionRange === 'function'
    ) {
        try {
            input.setSelectionRange(focus_info.selection_start, focus_info.selection_end);
        } catch {
            // Ignorera om fälttypen inte stödjer markering
        }
    }
}

export function merge_ai_settings_for_render(
    saved: AiSettingsData,
    draft: AiSettingsDraft | null
): AiSettingsData {
    if (!draft) return saved;
    return {
        ...saved,
        enabled: draft.enabled,
        provider: draft.provider,
        base_url: draft.base_url,
        model: draft.model,
        timeout_ms: draft.timeout_ms
    };
}

export function apply_ai_settings_draft_to_view(
    draft: AiSettingsDraft,
    target: {
        _discovered_models: string[];
        _selected_model: string;
        _test_result: AiSettingsDraft['test_result'];
        _enabled_ui: boolean | null;
    }
): void {
    target._enabled_ui = null;
    target._discovered_models = [...(draft.discovered_models || [])];
    target._selected_model = draft.selected_model || '';
    target._test_result = draft.test_result;
}

export function resolve_enabled_from_saved_and_draft(
    saved: AiSettingsData,
    draft: AiSettingsDraft | null,
    enabled_ui_override: boolean | null
): boolean {
    if (enabled_ui_override !== null) return enabled_ui_override;
    if (draft) return draft.enabled === true;
    return saved.enabled === true;
}
