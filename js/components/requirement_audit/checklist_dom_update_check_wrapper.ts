/**
 * @fileoverview DOM-uppdatering per kontrollpunkt i ChecklistHandler.
 */

import {
    button_aria_label_with_context,
    get_plain_text_from_html,
    safe_parse_markdown_inline
} from './checklist_dom_build.js';
import { set_criteria_panel_visibility } from './checklist_criteria_panel_ui.js';
import {
    read_check_stored_data,
    should_show_pass_criteria_list
} from './checklist_observation_visibility.js';
import { apply_status_button_active_state } from './checklist_status_button_ui.js';
import { is_check_panel_animation_blocked, is_panel_sync_blocked } from './criteria_panel.js';
import {
    as_build_host,
    resolve_dom_update_env,
    type ChecklistDomUpdateHost,
    type DomUpdateEnv
} from './checklist_dom_update_types.js';
import { update_dom_single_pass_criterion_item } from './checklist_dom_update_pass_criterion.js';

function update_check_wrapper_header(
    host: ChecklistDomUpdateHost,
    check_wrapper: HTMLElement,
    check_id: string,
    calculated_check_status: string,
    overall_manual_status: string,
    audit_frozen: boolean,
    heal_opts: { skip_if_unchanged?: boolean }
): void {
    const t = host.Translation.t;
    check_wrapper.className = `check-item status-${calculated_check_status}`;
    const check_def_top = host.requirement_definition_ref?.checks?.find(
        (c) => (c?.id || c?.key) === check_id
    );
    const condition_plain = check_def_top
        ? get_plain_text_from_html(safe_parse_markdown_inline(as_build_host(host), check_def_top.condition || ''))
        : '';
    const complies_btn = check_wrapper.querySelector('button[data-action="set-check-complies"]') as HTMLElement | null;
    const not_complies_btn = check_wrapper.querySelector('button[data-action="set-check-not-complies"]') as HTMLElement | null;
    if (complies_btn && not_complies_btn) {
        apply_status_button_active_state(host, complies_btn, overall_manual_status === 'passed', {
            check_id, pc_id: null, action: 'set-check-complies'
        }, heal_opts);
        apply_status_button_active_state(host, not_complies_btn, overall_manual_status === 'not_applicable', {
            check_id, pc_id: null, action: 'set-check-not-complies'
        }, heal_opts);
        complies_btn.setAttribute('aria-label', button_aria_label_with_context(t('check_complies'), condition_plain));
        not_complies_btn.setAttribute(
            'aria-label',
            button_aria_label_with_context(t('check_does_not_comply'), condition_plain)
        );
        const parent = complies_btn.parentElement as HTMLElement | null;
        if (parent) parent.style.display = audit_frozen ? 'none' : 'flex';
    }
    const condition_h3 = check_wrapper.querySelector('.check-condition-title') as HTMLElement | null;
    if (condition_h3) {
        const status_text = t(`audit_status_${calculated_check_status}`);
        condition_h3.setAttribute('aria-label', `${condition_h3.textContent?.trim() ?? ''}. ${status_text.toLowerCase()}`);
    }
}

function update_check_status_display(
    host: ChecklistDomUpdateHost,
    check_wrapper: HTMLElement,
    calculated_check_status: string
): void {
    const t = host.Translation.t;
    const status_text_container = check_wrapper.querySelector('.check-status-display') as HTMLElement | null;
    if (!status_text_container) return;
    status_text_container.innerHTML = '';
    status_text_container.setAttribute('aria-hidden', 'true');
    status_text_container.appendChild(
        host.Helpers.create_element('strong', { text_content: t('check_status') })
    );
    status_text_container.appendChild(document.createTextNode(': '));
    status_text_container.appendChild(host.Helpers.create_element('span', {
        class_name: `status-text status-${calculated_check_status}`,
        text_content: t(`audit_status_${calculated_check_status}`)
    }));
}

function update_check_wrapper_panels(
    host: ChecklistDomUpdateHost,
    check_wrapper: HTMLElement,
    check_id: string,
    overall_manual_status: string
): void {
    const t = host.Translation.t;
    const pc_panel = check_wrapper.querySelector('.pass-criteria-panel') as HTMLElement | null;
    const compliance_panel = check_wrapper.querySelector('.compliance-info-panel') as HTMLElement | null;
    const compliance_info_text = compliance_panel?.querySelector('.compliance-info-text') as HTMLElement | null;
    if (pc_panel && !is_check_panel_animation_blocked(check_id) && !is_panel_sync_blocked(pc_panel, check_id)) {
        const pc_count = pc_panel.querySelectorAll('.pass-criterion-item[data-pc-id]').length;
        set_criteria_panel_visibility(
            host, check_wrapper, pc_panel,
            should_show_pass_criteria_list(overall_manual_status, pc_count),
            { animate: false }
        );
    }
    if (overall_manual_status === 'not_applicable' && compliance_info_text) {
        compliance_info_text.textContent = t('condition_not_met_criteria_auto_passed');
    }
    if (compliance_panel && !is_check_panel_animation_blocked(check_id)
        && !is_panel_sync_blocked(compliance_panel, check_id)) {
        set_criteria_panel_visibility(
            host, check_wrapper, compliance_panel,
            overall_manual_status === 'not_applicable',
            { animate: false }
        );
    }
}

export function update_dom_single_check_wrapper(
    host: ChecklistDomUpdateHost,
    check_wrapper: HTMLElement,
    pc_id_filter: string | null,
    env_input: DomUpdateEnv | null = null
): void {
    const env = resolve_dom_update_env(host, env_input);
    const check_id = check_wrapper.dataset.checkId!;
    const check_result_data = read_check_stored_data(host.requirement_result_ref?.checkResults ?? null, check_id);
    const calculated_check_status = check_result_data?.status || 'not_audited';
    const overall_manual_status = check_result_data?.overallStatus || 'not_audited';
    const heal_opts = env.force_status_button_sync ? {} : { skip_if_unchanged: true };
    update_check_wrapper_header(
        host, check_wrapper, check_id, calculated_check_status, overall_manual_status, env.audit_frozen, heal_opts
    );
    update_check_status_display(host, check_wrapper, calculated_check_status);
    update_check_wrapper_panels(host, check_wrapper, check_id, overall_manual_status);
    check_wrapper.querySelectorAll('.pass-criterion-item[data-pc-id]').forEach((pc_item_li) => {
        const pc_id = (pc_item_li as HTMLElement).dataset.pcId;
        if (pc_id_filter && pc_id !== String(pc_id_filter)) return;
        update_dom_single_pass_criterion_item(
            host, check_wrapper, pc_item_li as HTMLElement, check_id,
            check_result_data, overall_manual_status, env
        );
    });
}

export function update_dom_check_and_pass_criteria(
    host: ChecklistDomUpdateHost,
    check_id: string
): void {
    const all_check_wrappers = host.container_ref?.querySelectorAll('.check-item[data-check-id]');
    const check_wrapper = all_check_wrappers
        ? [...all_check_wrappers].find((wrapper) => (wrapper as HTMLElement).dataset.checkId === String(check_id))
        : null;
    if (!check_wrapper) return;
    update_dom_single_check_wrapper(host, check_wrapper as HTMLElement, null);
}

export function update_dom_full(host: ChecklistDomUpdateHost): void {
    const env = resolve_dom_update_env(host);
    host.container_ref?.querySelectorAll('.check-item[data-check-id]').forEach((check_wrapper) => {
        update_dom_single_check_wrapper(host, check_wrapper as HTMLElement, null, env);
    });
    update_dom_stuck_button(host, host.Translation.t);
}

export function update_dom_stuck_button(
    host: ChecklistDomUpdateHost,
    t: (key: string, params?: Record<string, unknown>) => string
): void {
    const stuck_btn = host.container_ref?.querySelector('.stuck-button') as HTMLElement | null;
    if (!stuck_btn) return;
    const has_stuck_content = (host.requirement_result_ref?.stuckProblemDescription || '').trim() !== '';
    const check_id = stuck_btn.getAttribute('data-check-id');
    const pc_id = stuck_btn.getAttribute('data-pc-id');
    const check_def = host.requirement_definition_ref?.checks?.find(
        (c) => (c?.id || c?.key) === check_id
    );
    const pc_def = check_def?.passCriteria?.find((p) => (p?.id || p?.key) === pc_id);
    const numbering = check_def && pc_def
        ? `${(host.requirement_definition_ref?.checks?.indexOf(check_def) ?? 0) + 1}.${(check_def.passCriteria?.indexOf(pc_def) ?? 0) + 1}`
        : '';
    const criterion_title = `${t('pass_criterion_label')} ${numbering}`;
    const requirement_plain = get_plain_text_from_html(
        safe_parse_markdown_inline(as_build_host(host), host.requirement_definition_ref?.title || '')
    );
    const stuck_aria_label = has_stuck_content
        ? `${t('stuck_button')} ${t('stuck_button_has_content')} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`
        : `${t('stuck_button')} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`;
    stuck_btn.setAttribute('aria-label', stuck_aria_label);
    stuck_btn.classList.toggle('stuck-button--has-content', has_stuck_content);
    const text_span = stuck_btn.querySelector('span:first-child') as HTMLElement | null;
    if (text_span && host.Helpers.escape_html) {
        const indicator_html = has_stuck_content
            ? ` <span class="stuck-button-indicator">${host.Helpers.escape_html(t('stuck_button_has_content'))}</span>`
            : '';
        text_span.innerHTML = host.Helpers.escape_html(t('stuck_button')) + indicator_html;
    }
}
