/**
 * @fileoverview Initial DOM-byggnad för ChecklistHandler.
 */

import { should_show_pass_criteria_list } from './checklist_observation_visibility.js';
import { PANEL_OPEN_CLASS } from './criteria_panel.js';
import {
    button_aria_label_with_context,
    create_audit_toggle_button,
    create_pass_criterion_title_h4,
    create_update_badge,
    get_plain_text_from_html,
    safe_parse_markdown_inline,
    type ChecklistDomBuildHost
} from './checklist_dom_build_helpers.js';
import { append_pc_observation_section } from './checklist_dom_build_observation.js';

export type { ChecklistDomBuildHost } from './checklist_dom_build_helpers.js';
export {
    button_aria_label_with_context,
    create_audit_toggle_button,
    create_pass_criterion_title_h4,
    create_update_badge,
    get_pc_result_data,
    get_plain_text_from_html,
    safe_parse_markdown_inline,
    set_pass_criterion_title_aria_label,
    sync_pass_criterion_deficiency_id_on_title
} from './checklist_dom_build_helpers.js';

export function build_initial_dom(host: ChecklistDomBuildHost & { _audit_frozen_for_ui(): boolean }): void {
    const t = host.Translation.t;
    const details = host.requirement_update_details;
    host._flush_all_observation_textareas_to_memory();
    if (!host.container_ref) return;
    host.container_ref.innerHTML = '';

    if (!host.requirement_definition_ref?.checks?.length) {
        host.container_ref.appendChild(host.Helpers.create_element('p', {
            class_name: 'text-muted',
            text_content: t('no_checks_for_this_requirement')
        }));
        host.is_dom_built = true;
        return;
    }

    const checks_region = host.Helpers.create_element('section', {
        class_name: 'checks-container',
        attributes: { role: 'region', 'aria-label': t('checks_landmark_label') }
    });
    const checks_header_row = host.Helpers.create_element('div', { class_name: 'checks-header-row' });
    checks_header_row.appendChild(host.Helpers.create_element('h2', { text_content: t('checks_title') }));
    const checks_header_actions = host.Helpers.create_element('div', { class_name: 'checks-header-actions' });
    checks_header_row.appendChild(checks_header_actions);
    checks_region.appendChild(checks_header_row);

    host.requirement_definition_ref.checks.forEach((check_definition, check_index) => {
        const check_id = String(check_definition?.id ?? check_definition?.key);
        const check_result_data = (host.requirement_result_ref?.checkResults?.[check_id]
            ?? host.requirement_result_ref?.checkResults?.[String(check_id)]) as {
            passCriteria?: Record<string, unknown>;
            overallStatus?: string;
        } | undefined;
        const check_wrapper = host.Helpers.create_element('div', {
            class_name: 'check-item',
            attributes: { 'data-check-id': check_id }
        });

        const condition_h3 = host.Helpers.create_element('h3', { class_name: 'check-condition-title' });
        condition_h3.textContent = `${t('check_item_title')} ${check_index + 1}`;
        if (check_id && details?.addedChecks?.includes(check_id)) {
            condition_h3.appendChild(document.createTextNode(' '));
            condition_h3.appendChild(create_update_badge(host, 'new'));
        }
        check_wrapper.appendChild(condition_h3);

        check_wrapper.appendChild(host.Helpers.create_element('div', {
            class_name: ['check-condition-text', 'markdown-content'],
            html_content: safe_parse_markdown_inline(host, check_definition.condition || '')
        }));

        const condition_plain = get_plain_text_from_html(
            safe_parse_markdown_inline(host, check_definition.condition || '')
        );
        const actions_div = host.Helpers.create_element('div', { class_name: 'condition-actions' });
        actions_div.append(
            create_audit_toggle_button(host, {
                button_classes: ['button', 'button-success', 'button-small'],
                action: 'set-check-complies',
                aria_label: button_aria_label_with_context(t('check_complies'), condition_plain),
                label_text: t('check_complies'),
                icon_status: 'passed'
            }),
            create_audit_toggle_button(host, {
                button_classes: ['button', 'button-danger', 'button-small'],
                action: 'set-check-not-complies',
                aria_label: button_aria_label_with_context(t('check_does_not_comply'), condition_plain),
                label_text: t('check_does_not_comply'),
                icon_status: 'failed'
            })
        );
        check_wrapper.appendChild(actions_div);
        check_wrapper.appendChild(host.Helpers.create_element('p', {
            class_name: 'check-status-display',
            attributes: { 'aria-hidden': 'true' }
        }));

        const overall_for_pc_list = check_result_data?.overallStatus || 'not_audited';
        const pc_panel = host.Helpers.create_element('div', { class_name: 'criteria-panel pass-criteria-panel' });
        const pc_inner = host.Helpers.create_element('div', { class_name: 'criteria-panel__inner' });
        const pc_list = host.Helpers.create_element('ul', { class_name: 'pass-criteria-list' });
        const pass_criteria_list = Array.isArray(check_definition.passCriteria)
            ? check_definition.passCriteria
            : [];
        const should_show_pc_list = should_show_pass_criteria_list(
            overall_for_pc_list,
            pass_criteria_list.length
        );
        pc_panel.hidden = !should_show_pc_list;
        pc_panel.classList.toggle(PANEL_OPEN_CLASS, should_show_pc_list);
        pc_inner.appendChild(pc_list);
        pc_panel.appendChild(pc_inner);

        pass_criteria_list.forEach((pc_def, pc_index) => {
            const pc_id = String(pc_def?.id ?? pc_def?.key);
            const pc_item_li = host.Helpers.create_element('li', {
                class_name: 'pass-criterion-item',
                attributes: { 'data-pc-id': pc_id }
            });
            const numbering = `${check_index + 1}.${pc_index + 1}`;
            pc_item_li.appendChild(create_pass_criterion_title_h4(host, {
                numbering, check_id, pc_id, check_result_data, details
            }));
            pc_item_li.appendChild(host.Helpers.create_element('div', {
                class_name: ['pass-criterion-requirement', 'markdown-content'],
                html_content: safe_parse_markdown_inline(host, pc_def.requirement || '')
            }));
            const requirement_plain = get_plain_text_from_html(
                safe_parse_markdown_inline(host, pc_def.requirement || '')
            );
            pc_item_li.appendChild(host.Helpers.create_element('div', {
                class_name: 'pass-criterion-status',
                attributes: { 'aria-live': 'polite', 'aria-atomic': 'true' }
            }));
            const pc_actions_div = host.Helpers.create_element('div', { class_name: 'pass-criterion-actions' });
            pc_actions_div.append(
                create_audit_toggle_button(host, {
                    button_classes: ['button', 'button-success', 'button-small'],
                    action: 'set-pc-passed',
                    aria_label: button_aria_label_with_context(t('pass_criterion_approved'), requirement_plain),
                    label_text: t('pass_criterion_approved'),
                    icon_status: 'passed'
                }),
                create_audit_toggle_button(host, {
                    button_classes: ['button', 'button-danger', 'button-small'],
                    action: 'set-pc-failed',
                    aria_label: button_aria_label_with_context(t('pass_criterion_failed'), requirement_plain),
                    label_text: t('pass_criterion_failed'),
                    icon_status: 'failed'
                })
            );
            pc_item_li.appendChild(pc_actions_div);
            append_pc_observation_section(
                host, pc_item_li, check_id, pc_id, numbering,
                check_index, pc_index, check_result_data, overall_for_pc_list,
                checks_header_actions, t, requirement_plain
            );
            pc_list.appendChild(pc_item_li);
        });

        check_wrapper.appendChild(pc_panel);
        const compliance_panel = host.Helpers.create_element('div', { class_name: 'criteria-panel compliance-info-panel' });
        const compliance_inner = host.Helpers.create_element('div', { class_name: 'criteria-panel__inner' });
        compliance_inner.appendChild(host.Helpers.create_element('p', {
            class_name: 'text-muted compliance-info-text',
            style: 'font-style: italic;'
        }));
        compliance_panel.appendChild(compliance_inner);
        compliance_panel.hidden = true;
        check_wrapper.appendChild(compliance_panel);
        checks_region.appendChild(check_wrapper);
    });

    host.container_ref.appendChild(checks_region);
    host.is_dom_built = true;
}
