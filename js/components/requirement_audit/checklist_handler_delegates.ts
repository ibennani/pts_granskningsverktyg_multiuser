/**
 * @fileoverview Tunn delegator-bindning för ChecklistHandler-metoder.
 */

import {
    acquire_status_change_flight,
    apply_status_button_active_state,
    build_button_focus_target,
    detect_user_event_source,
    reapply_pending_status_button_focus,
    release_status_change_flight,
    remember_status_button_trigger,
    resolve_status_button_element,
    restore_focus_to_button_if_needed,
    restore_focus_to_button_with_retry,
    should_skip_focus_restore_to_button,
    status_button_label,
    status_button_snapshot_key,
    status_change_flight_key,
    try_focus_button_target
} from './checklist_status_button_ui.js';
import {
    cache_observation_text,
    flush_all_observation_textareas_to_memory,
    get_cached_observation_text,
    get_pc_failure_template,
    observation_cache_key,
    observation_was_hidden_with_user_text,
    persist_observation_dom_value,
    pick_user_observation_text,
    resolve_observation_target_for_textarea,
    restore_observation_textarea_after_show,
    set_pc_observation_detail,
    should_apply_observation_textarea_sync,
    snapshot_observation_before_hide,
    sync_observation_textarea_from_target,
    sync_observation_wrapper_visibility
} from './checklist_observation_text.js';
import {
    handle_attach_media_click,
    handle_checklist_click,
    handle_copy_observation_click,
    handle_observation_flush_pointerdown,
    handle_pc_observation_focusin,
    handle_pc_observation_focusout,
    handle_status_button_pointerdown,
    handle_stuck_click,
    handle_textarea_input,
    schedule_heal_pc_after_focus_left,
    type StatusChangeInfo
} from './checklist_event_handlers.js';
import {
    build_initial_dom,
    button_aria_label_with_context,
    create_audit_toggle_button,
    create_pass_criterion_title_h4,
    create_update_badge,
    get_pc_result_data,
    get_plain_text_from_html,
    safe_parse_markdown_inline,
    set_pass_criterion_title_aria_label,
    sync_pass_criterion_deficiency_id_on_title
} from './checklist_dom_build.js';
import {
    defer_criteria_panel_sync,
    set_criteria_panel_visibility
} from './checklist_criteria_panel_ui.js';
import {
    heal_all_checklist_ui_from_data,
    heal_pc_ui_from_data,
    update_dom,
    update_dom_check_and_pass_criteria,
    update_dom_full,
    update_dom_pc_only,
    update_dom_single_check_wrapper,
    update_dom_stuck_button
} from './checklist_dom_update.js';
import { apply_optimistic_status_button_ui } from './checklist_handler_optimistic_ui.js';
import { as_checklist_module_host, type ChecklistHandlerCore } from './checklist_handler_types.js';

type HandlerProto = ChecklistHandlerCore & Record<string, unknown>;

function module_host(this: ChecklistHandlerCore) {
    return as_checklist_module_host(this);
}

export function attach_checklist_handler_delegates(proto: HandlerProto): void {
    proto.handle_checklist_click = function (this: ChecklistHandlerCore, event: Event) {
        handle_checklist_click(module_host.call(this), event);
    };
    proto.handle_textarea_input = function (this: ChecklistHandlerCore, event: Event) {
        handle_textarea_input(module_host.call(this), event);
    };
    proto.handle_attach_media_click = function (this: ChecklistHandlerCore, event: Event, attach_btn: HTMLButtonElement) {
        handle_attach_media_click(module_host.call(this), event, attach_btn);
    };
    proto.handle_stuck_click = function (this: ChecklistHandlerCore, event: Event, stuck_btn: HTMLButtonElement) {
        handle_stuck_click(module_host.call(this), event, stuck_btn);
    };
    proto.handle_copy_observation_click = function (this: ChecklistHandlerCore, event: Event, copy_btn: HTMLButtonElement) {
        handle_copy_observation_click(module_host.call(this), event, copy_btn);
    };
    proto.handle_pc_observation_focusin = function (this: ChecklistHandlerCore, event: FocusEvent) {
        handle_pc_observation_focusin(module_host.call(this), event);
    };
    proto.handle_pc_observation_focusout = function (this: ChecklistHandlerCore, event: FocusEvent) {
        handle_pc_observation_focusout(module_host.call(this), event);
    };
    proto.handle_status_button_pointerdown = function (this: ChecklistHandlerCore, event: Event) {
        handle_status_button_pointerdown(module_host.call(this), event);
    };
    proto.handle_observation_flush_pointerdown = function (this: ChecklistHandlerCore) {
        handle_observation_flush_pointerdown(module_host.call(this));
    };

    proto._apply_optimistic_status_button_ui = function (this: ChecklistHandlerCore, change_info: StatusChangeInfo) {
        apply_optimistic_status_button_ui(
            module_host.call(this) as unknown as Parameters<typeof apply_optimistic_status_button_ui>[0],
            change_info
        );
    };
    proto._build_button_focus_target = (button_element: HTMLElement | null) =>
        build_button_focus_target(button_element);
    proto._status_button_snapshot_key = (check_id: string, pc_id: string | null, action: string) =>
        status_button_snapshot_key(check_id, pc_id, action);
    proto._status_change_flight_key = (check_id: string, pc_id: string | null) =>
        status_change_flight_key(check_id, pc_id);
    proto._acquire_status_change_flight = function (this: ChecklistHandlerCore, check_id: string, pc_id: string | null) {
        return acquire_status_change_flight(module_host.call(this), check_id, pc_id);
    };
    proto._release_status_change_flight = function (this: ChecklistHandlerCore, check_id: string, pc_id: string | null) {
        release_status_change_flight(module_host.call(this), check_id, pc_id);
    };
    proto._detect_user_event_source = (event: Event) => detect_user_event_source(event);
    proto._status_button_label = (action: string) => status_button_label(action);

    proto._sync_observation_wrapper_visibility = function (
        this: ChecklistHandlerCore,
        observation_wrapper: Element | null,
        overall_manual_status: string,
        pc_data: unknown,
        check_id: string | null = null,
        pc_id: string | null = null,
        { animate = false } = {}
    ) {
        return sync_observation_wrapper_visibility(
            module_host.call(this), observation_wrapper, overall_manual_status,
            pc_data as { status?: string }, check_id, pc_id, { animate }
        );
    };
    proto._snapshot_observation_before_hide = function (
        this: ChecklistHandlerCore, check_id: string, pc_id: string, textarea: HTMLTextAreaElement
    ) {
        snapshot_observation_before_hide(module_host.call(this), check_id, pc_id, textarea);
    };
    proto._pick_user_observation_text = function (
        this: ChecklistHandlerCore, check_id: string, pc_id: string, observation_textarea: HTMLTextAreaElement | null = null
    ) {
        return pick_user_observation_text(module_host.call(this), check_id, pc_id, observation_textarea);
    };
    proto._restore_observation_textarea_after_show = function (
        this: ChecklistHandlerCore, check_id: string, pc_id: string, textarea: HTMLTextAreaElement
    ) {
        return restore_observation_textarea_after_show(module_host.call(this), check_id, pc_id, textarea);
    };
    proto._observation_was_hidden_with_user_text = function (this: ChecklistHandlerCore, check_id: string, pc_id: string) {
        return observation_was_hidden_with_user_text(module_host.call(this), check_id, pc_id);
    };
    proto._defer_criteria_panel_sync = function (
        this: ChecklistHandlerCore, check_wrapper: HTMLElement, panel: HTMLElement, should_show: boolean
    ) {
        return defer_criteria_panel_sync(module_host.call(this), check_wrapper, panel, should_show);
    };
    proto._set_criteria_panel_visibility = function (
        this: ChecklistHandlerCore,
        check_wrapper: Element, panel: Element, should_show: boolean, { animate = true } = {}
    ) {
        return set_criteria_panel_visibility(
            module_host.call(this), check_wrapper as HTMLElement, panel as HTMLElement, should_show, { animate }
        );
    };
    proto._heal_pc_ui_from_data = function (this: ChecklistHandlerCore, params: Parameters<typeof heal_pc_ui_from_data>[1]) {
        return heal_pc_ui_from_data(module_host.call(this), params);
    };
    proto._heal_all_checklist_ui_from_data = function (this: ChecklistHandlerCore, context = 'after_update_dom') {
        return heal_all_checklist_ui_from_data(module_host.call(this), context);
    };
    proto._remember_status_button_trigger = function (
        this: ChecklistHandlerCore,
        check_id: string, pc_id: string | null, action: string, trigger: StatusChangeInfo['trigger']
    ) {
        if (!trigger) return;
        remember_status_button_trigger(module_host.call(this), check_id, pc_id, action, trigger);
    };
    proto._apply_status_button_active_state = function (
        this: ChecklistHandlerCore,
        button_el: Element,
        should_be_active: boolean,
        target: { check_id: string; pc_id: string | null; action: string },
        opts: { skip_if_unchanged?: boolean } = {}
    ) {
        apply_status_button_active_state(module_host.call(this), button_el as HTMLElement, should_be_active, target, opts);
    };
    proto._resolve_status_button_element = function (
        this: ChecklistHandlerCore, button_target: Parameters<typeof resolve_status_button_element>[1]
    ) {
        return resolve_status_button_element(module_host.call(this), button_target);
    };
    proto._reapply_pending_status_button_focus = function (this: ChecklistHandlerCore) {
        reapply_pending_status_button_focus(module_host.call(this));
    };
    proto._try_focus_button_target = function (
        this: ChecklistHandlerCore, button_target: Parameters<typeof try_focus_button_target>[1]
    ) {
        return try_focus_button_target(module_host.call(this), button_target);
    };
    proto._should_skip_focus_restore_to_button = function (
        this: ChecklistHandlerCore, button_target: Parameters<typeof should_skip_focus_restore_to_button>[1]
    ) {
        return should_skip_focus_restore_to_button(module_host.call(this), button_target);
    };
    proto._restore_focus_to_button_if_needed = function (
        this: ChecklistHandlerCore, button_target: Parameters<typeof restore_focus_to_button_if_needed>[1]
    ) {
        restore_focus_to_button_if_needed(module_host.call(this), button_target);
    };
    proto._restore_focus_to_button_with_retry = function (
        this: ChecklistHandlerCore,
        button_target: Parameters<typeof restore_focus_to_button_with_retry>[1],
        opts: { restore_custom_flag_to?: boolean | null } = {}
    ) {
        restore_focus_to_button_with_retry(module_host.call(this), button_target, opts);
    };

    proto._safe_parse_markdown_inline = function (this: ChecklistHandlerCore, markdown_string: string) {
        return safe_parse_markdown_inline(module_host.call(this), markdown_string);
    };
    proto._get_plain_text_from_html = (html_string: string) => get_plain_text_from_html(html_string);
    proto._button_aria_label_with_context = (button_label: string, context_plain: string) =>
        button_aria_label_with_context(button_label, context_plain);
    proto._create_audit_toggle_button = function (this: ChecklistHandlerCore, opts: Parameters<typeof create_audit_toggle_button>[1]) {
        return create_audit_toggle_button(module_host.call(this), opts);
    };
    proto._create_update_badge = function (this: ChecklistHandlerCore, type: string) {
        return create_update_badge(module_host.call(this), type);
    };
    proto._get_pc_result_data = (
        check_result_data: Parameters<typeof get_pc_result_data>[0], pc_id: string
    ) => get_pc_result_data(check_result_data, pc_id);
    proto._sync_pass_criterion_deficiency_id_on_title = function (
        this: ChecklistHandlerCore,
        pc_title_h4: HTMLElement, audit_frozen: boolean, pc_status: string, deficiency_id: string | undefined
    ) {
        return sync_pass_criterion_deficiency_id_on_title(
            module_host.call(this), pc_title_h4, audit_frozen, pc_status, deficiency_id
        );
    };
    proto._set_pass_criterion_title_aria_label = function (
        this: ChecklistHandlerCore,
        pc_title_h4: HTMLElement, criterion_title: string, pc_status_text: string,
        audit_frozen: boolean, pc_status: string, deficiency_id: string | undefined
    ) {
        return set_pass_criterion_title_aria_label(
            module_host.call(this), pc_title_h4, criterion_title, pc_status_text, audit_frozen, pc_status, deficiency_id
        );
    };
    proto._create_pass_criterion_title_h4 = function (
        this: ChecklistHandlerCore, opts: Parameters<typeof create_pass_criterion_title_h4>[1]
    ) {
        return create_pass_criterion_title_h4(module_host.call(this), opts);
    };
    proto.build_initial_dom = function (this: ChecklistHandlerCore) {
        build_initial_dom(module_host.call(this));
    };

    proto._get_pc_failure_template = function (this: ChecklistHandlerCore, check_id: string, pc_id: string) {
        return get_pc_failure_template(module_host.call(this), check_id, pc_id);
    };
    proto._observation_cache_key = (check_id: string, pc_id: string) => observation_cache_key(check_id, pc_id);
    proto._cache_observation_text = function (this: ChecklistHandlerCore, check_id: string, pc_id: string, text: string) {
        cache_observation_text(module_host.call(this), check_id, pc_id, text);
    };
    proto._get_cached_observation_text = function (this: ChecklistHandlerCore, check_id: string, pc_id: string) {
        return get_cached_observation_text(module_host.call(this), check_id, pc_id);
    };
    proto._persist_observation_dom_value = function (
        this: ChecklistHandlerCore, check_id: string, pc_id: string, text: string
    ) {
        persist_observation_dom_value(module_host.call(this), check_id, pc_id, text);
    };
    proto._flush_all_observation_textareas_to_memory = function (this: ChecklistHandlerCore) {
        flush_all_observation_textareas_to_memory(module_host.call(this));
    };
    proto._resolve_observation_target_for_textarea = function (
        this: ChecklistHandlerCore,
        check_id: string, pc_id: string, pc_data: unknown, overall_manual_status: string,
        observation_textarea: HTMLTextAreaElement | null = null
    ) {
        return resolve_observation_target_for_textarea(
            module_host.call(this), check_id, pc_id,
            pc_data as { status?: string; observationDetail?: string }, overall_manual_status, observation_textarea
        );
    };
    proto._should_apply_observation_textarea_sync = function (
        this: ChecklistHandlerCore,
        observation_textarea: HTMLTextAreaElement, target_value: string, should_sync_obs: boolean,
        overall_manual_status: string, pc_status: string, check_id: string, pc_id: string
    ) {
        return should_apply_observation_textarea_sync(
            module_host.call(this), observation_textarea, target_value, should_sync_obs,
            overall_manual_status, pc_status, check_id, pc_id
        );
    };
    proto._sync_observation_textarea_from_target = function (
        this: ChecklistHandlerCore,
        observation_textarea: HTMLTextAreaElement, target_value: string, check_id: string, pc_id: string
    ) {
        sync_observation_textarea_from_target(module_host.call(this), observation_textarea, target_value, check_id, pc_id);
    };
    proto._set_pc_observation_detail = (
        check_results: Record<string, unknown> | null | undefined,
        check_id: string, pc_id: string, text: string
    ) => set_pc_observation_detail(check_results, check_id, pc_id, text);
    proto._schedule_heal_pc_after_focus_left = function (
        this: ChecklistHandlerCore, check_id: string, pc_id: string, pc_item_li: HTMLElement
    ) {
        schedule_heal_pc_after_focus_left(module_host.call(this), check_id, pc_id, pc_item_li);
    };

    proto.update_dom = function (this: ChecklistHandlerCore) {
        update_dom(module_host.call(this));
    };
    proto._update_dom_pc_only = function (this: ChecklistHandlerCore, check_id: string, pc_id: string) {
        update_dom_pc_only(module_host.call(this), check_id, pc_id);
    };
    proto._update_dom_check_and_pass_criteria = function (this: ChecklistHandlerCore, check_id: string) {
        update_dom_check_and_pass_criteria(module_host.call(this), check_id);
    };
    proto._update_dom_full = function (this: ChecklistHandlerCore) {
        update_dom_full(module_host.call(this));
    };
    proto._update_dom_stuck_button = function (
        this: ChecklistHandlerCore, t: (key: string, params?: Record<string, unknown>) => string
    ) {
        update_dom_stuck_button(module_host.call(this), t);
    };
    proto._update_dom_single_check_wrapper = function (
        this: ChecklistHandlerCore,
        check_wrapper: HTMLElement, pc_id_filter: string | null,
        env: Parameters<typeof update_dom_single_check_wrapper>[3] = null
    ) {
        update_dom_single_check_wrapper(module_host.call(this), check_wrapper, pc_id_filter, env);
    };
}
