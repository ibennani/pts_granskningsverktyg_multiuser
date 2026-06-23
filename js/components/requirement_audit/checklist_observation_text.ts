/**
 * @fileoverview Observationstext, cache och synk för ChecklistHandler.
 */

import { resolve_map_entry } from '../../audit_logic.js';
import { find_pass_criterion_def_by_storage_id } from '../../logic/entity_id_match.js';
import { is_slide_out_in_progress, toggle_slide_hidden_element } from './criteria_panel.js';
import {
    apply_observation_wrapper_visibility,
    effective_pc_status,
    should_show_observation_wrapper
} from './checklist_observation_visibility.js';

export type ChecklistObservationTextHost = {
    container_ref: HTMLElement | null;
    requirement_definition_ref: { checks?: Array<{ id?: string; key?: string; passCriteria?: Array<{ id?: unknown; key?: unknown; failureStatementTemplate?: string }> | null }> } | null;
    requirement_result_ref: { checkResults?: Record<string, unknown> } | null;
    Helpers?: { init_auto_resize_for_textarea?: (el: HTMLTextAreaElement) => void };
    get_pc_observation_draft?: ((check_id: string, pc_id: string) => string | undefined) | null;
    on_observation_draft_update_callback?: ((check_id: string, pc_id: string, text: string) => void) | null;
    on_observation_hide_commit_callback?: (() => void) | null;
    _observation_dom_cache?: Map<string, string>;
    _observation_hidden_with_text_keys?: Set<string>;
};

export function observation_cache_key(check_id: string, pc_id: string): string {
    return `${String(check_id)}\0${String(pc_id)}`;
}

export function get_pc_failure_template(
    host: ChecklistObservationTextHost,
    check_id: string,
    pc_id: string
): string {
    const check_def = host.requirement_definition_ref?.checks?.find(
        (c) => String(c?.id ?? c?.key) === String(check_id)
    );
    const pc_def = find_pass_criterion_def_by_storage_id(check_def?.passCriteria ?? null, pc_id) as {
        failureStatementTemplate?: string;
    } | null | undefined;
    return typeof pc_def?.failureStatementTemplate === 'string' ? pc_def.failureStatementTemplate : '';
}

export function cache_observation_text(
    host: ChecklistObservationTextHost,
    check_id: string,
    pc_id: string,
    text: string
): void {
    if (!host._observation_dom_cache) {
        host._observation_dom_cache = new Map();
    }
    host._observation_dom_cache.set(observation_cache_key(check_id, pc_id), text);
}

export function get_cached_observation_text(
    host: ChecklistObservationTextHost,
    check_id: string,
    pc_id: string
): string | undefined {
    return host._observation_dom_cache?.get(observation_cache_key(check_id, pc_id));
}

export function set_pc_observation_detail(
    check_results: Record<string, unknown> | null | undefined,
    check_id: string,
    pc_id: string,
    text: string
): void {
    if (!check_results) return;
    const chk = resolve_map_entry(check_results, check_id);
    const check_result = chk?.value as {
        passCriteria?: Record<string, unknown>;
    } | null;
    if (!check_result) return;
    if (!check_result.passCriteria || typeof check_result.passCriteria !== 'object') {
        check_result.passCriteria = {};
    }
    const pc = resolve_map_entry(check_result.passCriteria, pc_id);
    if (pc?.value && typeof pc.value === 'object' && pc.value !== null) {
        (pc.value as { observationDetail?: string }).observationDetail = text;
        return;
    }
    const status = typeof pc?.value === 'string' ? pc.value : 'not_audited';
    const storage_key = pc?.storageKey ?? String(pc_id);
    check_result.passCriteria[storage_key] = {
        status,
        observationDetail: text,
        timestamp: null,
        attachedMediaFilenames: []
    };
}

export function persist_observation_dom_value(
    host: ChecklistObservationTextHost,
    check_id: string,
    pc_id: string,
    text: string
): void {
    cache_observation_text(host, check_id, pc_id, text);
    set_pc_observation_detail(host.requirement_result_ref?.checkResults ?? null, check_id, pc_id, text);
    if (typeof host.on_observation_draft_update_callback === 'function') {
        host.on_observation_draft_update_callback(check_id, pc_id, text);
    }
}

export function pick_user_observation_text(
    host: ChecklistObservationTextHost,
    check_id: string,
    pc_id: string,
    observation_textarea: HTMLTextAreaElement | null = null
): string {
    const dom_value = observation_textarea?.value ?? '';
    if (String(dom_value).trim()) {
        return dom_value;
    }
    const cached = get_cached_observation_text(host, check_id, pc_id);
    if (typeof cached === 'string') {
        return cached;
    }
    const draft = typeof host.get_pc_observation_draft === 'function'
        ? host.get_pc_observation_draft(check_id, pc_id)
        : undefined;
    if (typeof draft === 'string') {
        return draft;
    }
    return '';
}

export function observation_was_hidden_with_user_text(
    host: ChecklistObservationTextHost,
    check_id: string,
    pc_id: string
): boolean {
    return host._observation_hidden_with_text_keys?.has(observation_cache_key(check_id, pc_id)) === true;
}

export function snapshot_observation_before_hide(
    host: ChecklistObservationTextHost,
    check_id: string,
    pc_id: string,
    textarea: HTMLTextAreaElement
): void {
    const text = textarea.value ?? '';
    persist_observation_dom_value(host, check_id, pc_id, text);
    if (!host._observation_hidden_with_text_keys) {
        host._observation_hidden_with_text_keys = new Set();
    }
    if (String(text).trim()) {
        host._observation_hidden_with_text_keys.add(observation_cache_key(check_id, pc_id));
    }
    if (host.on_observation_hide_commit_callback) {
        host.on_observation_hide_commit_callback();
    }
}

export function restore_observation_textarea_after_show(
    host: ChecklistObservationTextHost,
    check_id: string,
    pc_id: string,
    textarea: HTMLTextAreaElement
): boolean {
    const key = observation_cache_key(check_id, pc_id);
    if (!host._observation_hidden_with_text_keys?.has(key)) {
        return false;
    }
    const text = pick_user_observation_text(host, check_id, pc_id, textarea);
    if (textarea.value !== text) {
        textarea.value = text;
        persist_observation_dom_value(host, check_id, pc_id, text);
    }
    if (host.Helpers?.init_auto_resize_for_textarea) {
        host.Helpers.init_auto_resize_for_textarea(textarea);
    }
    return true;
}

export function sync_observation_wrapper_visibility(
    host: ChecklistObservationTextHost,
    observation_wrapper: Element | null,
    overall_manual_status: string,
    pc_data: string | { status?: string } | null,
    check_id: string | null = null,
    pc_id: string | null = null,
    { animate = false }: { animate?: boolean } = {}
): { applied: boolean; deferred_hide: boolean } {
    const pc_status = typeof pc_data === 'string' ? pc_data : pc_data?.status;
    const textarea = observation_wrapper?.querySelector?.('textarea.pc-observation-detail-textarea') as HTMLTextAreaElement | null ?? null;
    const wrapper_el = observation_wrapper instanceof HTMLElement ? observation_wrapper : null;
    const was_hidden = wrapper_el ? wrapper_el.hidden : true;
    const should_show = should_show_observation_wrapper(overall_manual_status, pc_status);

    if (wrapper_el && is_slide_out_in_progress(wrapper_el)) {
        return { applied: false, deferred_hide: false };
    }
    if (should_show === !was_hidden) {
        return { applied: false, deferred_hide: false };
    }

    if (textarea && check_id != null && pc_id != null && !should_show) {
        snapshot_observation_before_hide(host, check_id, pc_id, textarea);
    }

    let result = { applied: false, deferred_hide: false };
    if (!should_show && wrapper_el) {
        const active = document.activeElement;
        if (active instanceof Node && wrapper_el.contains(active)) {
            return { applied: false, deferred_hide: true };
        }
    }

    if (wrapper_el && animate) {
        const changed = toggle_slide_hidden_element(wrapper_el, should_show, { animate: true });
        result = { applied: changed, deferred_hide: false };
    } else {
        result = apply_observation_wrapper_visibility(
            observation_wrapper,
            overall_manual_status,
            pc_status
        );
    }

    if (textarea && check_id != null && pc_id != null && should_show && was_hidden) {
        restore_observation_textarea_after_show(host, check_id, pc_id, textarea);
    }

    return result;
}

export function flush_all_observation_textareas_to_memory(host: ChecklistObservationTextHost): void {
    if (!host.container_ref || !host.requirement_result_ref?.checkResults) return;
    host.container_ref.querySelectorAll('textarea.pc-observation-detail-textarea').forEach((el) => {
        const textarea = el as HTMLTextAreaElement;
        const pc_item = textarea.closest('.pass-criterion-item[data-pc-id]') as HTMLElement | null;
        const check_item = textarea.closest('.check-item[data-check-id]') as HTMLElement | null;
        if (!pc_item || !check_item) return;
        const check_id = check_item.dataset.checkId;
        const pc_id = pc_item.dataset.pcId;
        if (!check_id || !pc_id) return;
        persist_observation_dom_value(host, check_id, pc_id, textarea.value ?? '');
    });
}

export function resolve_observation_target_for_textarea(
    host: ChecklistObservationTextHost,
    check_id: string,
    pc_id: string,
    pc_data: { status?: string; observationDetail?: string },
    overall_manual_status: string,
    observation_textarea: HTMLTextAreaElement | null = null
): string {
    if (observation_was_hidden_with_user_text(host, check_id, pc_id)) {
        return pick_user_observation_text(host, check_id, pc_id, observation_textarea);
    }
    const dom_value = observation_textarea?.value ?? '';
    if (String(dom_value).trim()) {
        return dom_value;
    }
    const cached = get_cached_observation_text(host, check_id, pc_id);
    if (typeof cached === 'string' && String(cached).trim()) {
        return cached;
    }
    const draft = typeof host.get_pc_observation_draft === 'function'
        ? host.get_pc_observation_draft(check_id, pc_id)
        : undefined;
    if (typeof draft === 'string' && String(draft).trim()) {
        return draft;
    }
    const store_value = pc_data?.observationDetail ?? '';
    if (String(store_value).trim()) {
        return store_value;
    }
    if (effective_pc_status(overall_manual_status, pc_data?.status) === 'failed') {
        const template = get_pc_failure_template(host, check_id, pc_id);
        if (template) return template;
    }
    return '';
}

export function should_apply_observation_textarea_sync(
    host: ChecklistObservationTextHost,
    observation_textarea: HTMLTextAreaElement | null,
    target_value: string,
    should_sync_obs: boolean,
    overall_manual_status: string,
    pc_status: string,
    check_id: string,
    pc_id: string
): boolean {
    if (!should_sync_obs || !observation_textarea) return false;
    if (effective_pc_status(overall_manual_status, pc_status) !== 'failed') {
        return false;
    }
    const current = observation_textarea.value ?? '';
    const target = target_value ?? '';
    if (String(current).trim() && current !== target) {
        persist_observation_dom_value(host, check_id, pc_id, current);
        return false;
    }
    if (String(target).trim() === '' && String(current).trim() !== '') {
        return false;
    }
    return current !== target;
}

export function sync_observation_textarea_from_target(
    host: ChecklistObservationTextHost,
    observation_textarea: HTMLTextAreaElement | null,
    target_value: string,
    check_id: string,
    pc_id: string
): void {
    if (!observation_textarea || observation_textarea.value === target_value) return;
    observation_textarea.value = target_value;
    persist_observation_dom_value(host, check_id, pc_id, target_value);
    if (host.Helpers?.init_auto_resize_for_textarea) {
        host.Helpers.init_auto_resize_for_textarea(observation_textarea);
    }
}
