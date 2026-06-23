/**
 * @fileoverview Heal-synk för ChecklistHandler DOM mot lagrad data.
 */

import { is_debug_krav_vy } from '../../app/runtime_flags.js';
import {
    audit_observation_ui,
    effective_pc_status,
    read_check_stored_data,
    read_pc_stored_data,
    should_show_pass_criteria_list
} from './checklist_observation_visibility.js';
import {
    resolve_observation_target_for_textarea,
    sync_observation_textarea_from_target,
    sync_observation_wrapper_visibility
} from './checklist_observation_text.js';
import { apply_status_button_active_state } from './checklist_status_button_ui.js';
import { set_criteria_panel_visibility } from './checklist_criteria_panel_ui.js';
import { is_check_panel_animation_blocked, is_panel_sync_blocked } from './criteria_panel.js';
import { has_active_pc_observation_focus } from './checklist_event_handlers.js';
import { log_krav_vy_observation_ui_mismatch } from './krav_vy_knapp_debug_log.js';
import {
    as_event_host,
    as_observation_host,
    resolve_sync_focus_root,
    type ChecklistDomUpdateHost,
    type HealPcEnv,
    type HealPcParams
} from './checklist_dom_update_types.js';

function heal_pc_observation_textarea(
    host: ChecklistDomUpdateHost,
    params: {
        check_id: string;
        pc_id: string;
        pc_data: ReturnType<typeof read_pc_stored_data>;
        overall_manual_status: string;
        observation_textarea: HTMLTextAreaElement | null;
        env: HealPcEnv | null;
    }
): void {
    const { check_id, pc_id, pc_data, overall_manual_status, observation_textarea, env } = params;
    const current_pc_status = effective_pc_status(overall_manual_status, pc_data.status);
    if (!observation_textarea || current_pc_status !== 'failed') return;
    const sync_focus_root = env?.sync_focus_root ?? resolve_sync_focus_root(host);
    const active_el = env?.active_el_for_sync ?? document.activeElement;
    const has_pc_observation_textarea_focus = env?.has_pc_observation_textarea_focus
        ?? has_active_pc_observation_focus(as_event_host(host));
    const is_this_focused = observation_textarea && active_el === observation_textarea;
    const typing_other = !is_this_focused && active_el instanceof HTMLElement
        && sync_focus_root?.contains(active_el)
        && (active_el.tagName === 'TEXTAREA' || active_el.tagName === 'INPUT')
        && !has_pc_observation_textarea_focus;
    const editing_elsewhere = has_pc_observation_textarea_focus && !is_this_focused;
    if (is_this_focused || typing_other || editing_elsewhere) return;
    const target_value = resolve_observation_target_for_textarea(
        as_observation_host(host), check_id, pc_id, pc_data, overall_manual_status, observation_textarea
    );
    sync_observation_textarea_from_target(as_observation_host(host), observation_textarea, target_value, check_id, pc_id);
}

function heal_pc_audit_result(
    host: ChecklistDomUpdateHost,
    params: {
        check_id: string;
        pc_id: string;
        context: string;
        overall_manual_status: string;
        pc_data: ReturnType<typeof read_pc_stored_data>;
        observation_wrapper: HTMLElement | null;
        visibility_result: { deferred_hide: boolean };
    }
): { healed: boolean; deferred_hide: boolean } {
    const {
        check_id, pc_id, context, overall_manual_status, pc_data,
        observation_wrapper, visibility_result
    } = params;
    const failed_btn = observation_wrapper?.closest('.pass-criterion-item')
        ?.querySelector('button[data-action="set-pc-failed"]') as HTMLElement | null;
    const audit = audit_observation_ui({
        overall_manual_status,
        pc_status: pc_data.status,
        wrapper_visible: Boolean(observation_wrapper && !observation_wrapper.hidden),
        failed_button_active: failed_btn ? failed_btn.classList.contains('active') : null
    });
    if (audit.mismatch && is_debug_krav_vy()) {
        log_krav_vy_observation_ui_mismatch({
            context,
            check_id,
            pc_id,
            overall_status: overall_manual_status,
            pc_status_i_data: pc_data.status || 'not_audited',
            skäl: audit.reasons,
            effective_pc_status: audit.effective_pc_status,
            deferred_hide: visibility_result.deferred_hide,
            läkt: false
        });
    }
    return {
        healed: !audit.mismatch || visibility_result.deferred_hide,
        deferred_hide: visibility_result.deferred_hide
    };
}

export function heal_pc_ui_from_data(
    host: ChecklistDomUpdateHost,
    params: HealPcParams
): { healed: boolean; deferred_hide: boolean } {
    const {
        check_id, pc_id, pc_item_li, check_result_data, context,
        sync_textarea_value = true, env = null
    } = params;
    if (!pc_item_li || !check_result_data) {
        return { healed: false, deferred_hide: false };
    }
    const overall_manual_status = check_result_data?.overallStatus || 'not_audited';
    const pc_data = read_pc_stored_data(check_result_data, pc_id);
    const current_pc_status = effective_pc_status(overall_manual_status, pc_data.status);
    const passed_btn = pc_item_li.querySelector('button[data-action="set-pc-passed"]') as HTMLElement | null;
    const failed_btn = pc_item_li.querySelector('button[data-action="set-pc-failed"]') as HTMLElement | null;
    if (passed_btn && failed_btn) {
        apply_status_button_active_state(host, passed_btn, current_pc_status === 'passed', {
            check_id, pc_id, action: 'set-pc-passed'
        });
        apply_status_button_active_state(host, failed_btn, current_pc_status === 'failed', {
            check_id, pc_id, action: 'set-pc-failed'
        });
    }
    const observation_wrapper = pc_item_li.querySelector('.pc-observation-detail-wrapper') as HTMLElement | null;
    const visibility_result = sync_observation_wrapper_visibility(
        host, observation_wrapper, overall_manual_status, pc_data, check_id, pc_id
    );
    if (sync_textarea_value) {
        const observation_textarea = pc_item_li.querySelector(
            'textarea.pc-observation-detail-textarea'
        ) as HTMLTextAreaElement | null;
        heal_pc_observation_textarea(host, {
            check_id, pc_id, pc_data, overall_manual_status, observation_textarea, env
        });
    }
    return heal_pc_audit_result(host, {
        check_id, pc_id, context, overall_manual_status, pc_data,
        observation_wrapper, visibility_result
    });
}

function heal_check_status_buttons(
    host: ChecklistDomUpdateHost,
    check_wrapper: HTMLElement,
    check_id: string,
    overall_manual_status: string
): void {
    const complies_btn = check_wrapper.querySelector('button[data-action="set-check-complies"]') as HTMLElement | null;
    const not_complies_btn = check_wrapper.querySelector('button[data-action="set-check-not-complies"]') as HTMLElement | null;
    if (!complies_btn || !not_complies_btn) return;
    const heal_opts = { skip_if_unchanged: true };
    apply_status_button_active_state(host, complies_btn, overall_manual_status === 'passed', {
        check_id, pc_id: null, action: 'set-check-complies'
    }, heal_opts);
    apply_status_button_active_state(host, not_complies_btn, overall_manual_status === 'not_applicable', {
        check_id, pc_id: null, action: 'set-check-not-complies'
    }, heal_opts);
}

function heal_check_criteria_panel(
    host: ChecklistDomUpdateHost,
    check_wrapper: HTMLElement,
    check_id: string,
    overall_manual_status: string
): void {
    const pc_panel = check_wrapper.querySelector('.pass-criteria-panel') as HTMLElement | null;
    if (!pc_panel || is_check_panel_animation_blocked(check_id) || is_panel_sync_blocked(pc_panel, check_id)) {
        return;
    }
    const pc_count = pc_panel.querySelectorAll('.pass-criterion-item[data-pc-id]').length;
    set_criteria_panel_visibility(
        host, check_wrapper, pc_panel,
        should_show_pass_criteria_list(overall_manual_status, pc_count),
        { animate: false }
    );
}

function heal_single_check_wrapper_from_data(
    host: ChecklistDomUpdateHost,
    check_wrapper: HTMLElement,
    context: string,
    env: HealPcEnv
): void {
    const check_id = check_wrapper.dataset.checkId!;
    const check_result_data = read_check_stored_data(host.requirement_result_ref!.checkResults!, check_id);
    if (!check_result_data) return;
    const overall_manual_status = check_result_data.overallStatus || 'not_audited';
    heal_check_status_buttons(host, check_wrapper, check_id, overall_manual_status);
    heal_check_criteria_panel(host, check_wrapper, check_id, overall_manual_status);
    check_wrapper.querySelectorAll('.pass-criterion-item[data-pc-id]').forEach((pc_item_li) => {
        heal_pc_ui_from_data(host, {
            check_id,
            pc_id: (pc_item_li as HTMLElement).dataset.pcId!,
            pc_item_li: pc_item_li as HTMLElement,
            check_result_data,
            context,
            sync_textarea_value: true,
            env
        });
    });
}

export function heal_all_checklist_ui_from_data(
    host: ChecklistDomUpdateHost,
    context = 'after_update_dom'
): void {
    if (!host.container_ref || !host.requirement_result_ref?.checkResults) return;
    const env: HealPcEnv = {
        sync_focus_root: resolve_sync_focus_root(host),
        active_el_for_sync: document.activeElement,
        has_pc_observation_textarea_focus: has_active_pc_observation_focus(as_event_host(host))
    };
    host.container_ref.querySelectorAll('.check-item[data-check-id]').forEach((check_wrapper) => {
        heal_single_check_wrapper_from_data(host, check_wrapper as HTMLElement, context, env);
    });
}
