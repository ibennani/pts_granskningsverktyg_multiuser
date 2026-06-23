/**
 * @fileoverview Optimistisk UI-uppdatering vid statusknapp-klick i ChecklistHandler.
 */

import {
    effective_pc_status,
    read_check_stored_data,
    read_pc_stored_data,
    should_show_pass_criteria_list
} from './checklist_observation_visibility.js';
import type { StatusChangeInfo } from './checklist_event_handler_types.js';

type OptimisticUiHost = {
    requirement_result_ref: {
        checkResults?: Record<string, unknown>;
    } | null;
    container_ref: HTMLElement | null;
    Translation: { t: (key: string) => string };
    Helpers: {
        create_element: (...args: unknown[]) => HTMLElement;
    } | null;
    _apply_status_button_active_state(
        button_el: Element,
        should_be_active: boolean,
        target: { check_id: string; pc_id: string | null; action: string }
    ): void;
    _set_criteria_panel_visibility(
        check_wrapper: Element,
        panel: Element,
        should_show: boolean,
        opts?: { animate?: boolean }
    ): void;
    _sync_observation_wrapper_visibility(
        observation_wrapper: Element | null,
        overall_manual_status: string,
        pc_data: { status?: string },
        check_id: string,
        pc_id: string,
        opts?: { animate?: boolean }
    ): unknown;
};

export function apply_optimistic_status_button_ui(
    host: OptimisticUiHost,
    change_info: StatusChangeInfo
): void {
    if (!change_info?.type || !host.requirement_result_ref?.checkResults || !host.container_ref) {
        return;
    }
    const check_id = change_info.checkId;
    const check_result_data = read_check_stored_data(host.requirement_result_ref.checkResults, check_id);
    if (!check_result_data) return;

    const check_wrapper = host.container_ref.querySelector(
        `.check-item[data-check-id="${CSS.escape(String(check_id))}"]`
    );
    if (!check_wrapper) return;

    if (change_info.type === 'check_overall_status_change') {
        apply_check_overall_optimistic_ui(host, change_info, check_wrapper, check_id, check_result_data);
        return;
    }

    if (change_info.type !== 'pc_status_change' || !change_info.pcId) return;
    apply_pc_status_optimistic_ui(host, change_info, check_wrapper, check_id, check_result_data);
}

function apply_check_overall_optimistic_ui(
    host: OptimisticUiHost,
    change_info: StatusChangeInfo,
    check_wrapper: Element,
    check_id: string,
    check_result_data: ReturnType<typeof read_check_stored_data>
): void {
    const current = check_result_data?.overallStatus || 'not_audited';
    const next = current === change_info.newStatus ? 'not_audited' : change_info.newStatus;
    const complies_btn = check_wrapper.querySelector('button[data-action="set-check-complies"]');
    const not_complies_btn = check_wrapper.querySelector('button[data-action="set-check-not-complies"]');
    if (complies_btn && not_complies_btn) {
        host._apply_status_button_active_state(complies_btn, next === 'passed', {
            check_id, pc_id: null, action: 'set-check-complies'
        });
        host._apply_status_button_active_state(not_complies_btn, next === 'not_applicable', {
            check_id, pc_id: null, action: 'set-check-not-complies'
        });
    }
    const pc_panel = check_wrapper.querySelector('.pass-criteria-panel');
    if (pc_panel) {
        const count = pc_panel.querySelectorAll('.pass-criterion-item[data-pc-id]').length;
        host._set_criteria_panel_visibility(
            check_wrapper, pc_panel, should_show_pass_criteria_list(next || 'not_audited', count)
        );
    }
    const compliance_panel = check_wrapper.querySelector('.compliance-info-panel');
    const compliance_info_text = compliance_panel?.querySelector('.compliance-info-text');
    if (compliance_panel) {
        if (next === 'not_applicable' && compliance_info_text) {
            compliance_info_text.textContent = host.Translation.t('condition_not_met_criteria_auto_passed');
        }
        host._set_criteria_panel_visibility(check_wrapper, compliance_panel, next === 'not_applicable');
    }
}

function apply_pc_status_optimistic_ui(
    host: OptimisticUiHost,
    change_info: StatusChangeInfo,
    check_wrapper: Element,
    check_id: string,
    check_result_data: ReturnType<typeof read_check_stored_data>
): void {
    if ((check_result_data?.overallStatus || 'not_audited') !== 'passed') return;

    const pc_id = change_info.pcId!;
    const pc_item_li = check_wrapper.querySelector(
        `.pass-criterion-item[data-pc-id="${CSS.escape(String(pc_id))}"]`
    );
    if (!pc_item_li) return;

    const pc_data = read_pc_stored_data(check_result_data, pc_id);
    const current = pc_data.status || 'not_audited';
    const next = current === change_info.newStatus ? 'not_audited' : change_info.newStatus;
    const effective = effective_pc_status('passed', next || 'not_audited');

    const passed_btn = pc_item_li.querySelector('button[data-action="set-pc-passed"]');
    const failed_btn = pc_item_li.querySelector('button[data-action="set-pc-failed"]');
    if (passed_btn && failed_btn) {
        host._apply_status_button_active_state(passed_btn, effective === 'passed', {
            check_id, pc_id, action: 'set-pc-passed'
        });
        host._apply_status_button_active_state(failed_btn, effective === 'failed', {
            check_id, pc_id, action: 'set-pc-failed'
        });
    }

    const pc_status_text_container = pc_item_li.querySelector('.pass-criterion-status');
    if (pc_status_text_container && host.Helpers?.create_element && host.Translation?.t) {
        const t = host.Translation.t;
        const pc_status_text = t(`audit_status_${effective}`);
        pc_status_text_container.innerHTML = '';
        pc_status_text_container.setAttribute('aria-hidden', 'true');
        pc_status_text_container.appendChild(host.Helpers.create_element('strong', { text_content: t('status') }));
        pc_status_text_container.appendChild(document.createTextNode(': '));
        pc_status_text_container.appendChild(host.Helpers.create_element('span', {
            class_name: `status-text status-${effective}`,
            text_content: pc_status_text
        }));
    }

    const observation_wrapper = pc_item_li.querySelector('.pc-observation-detail-wrapper');
    host._sync_observation_wrapper_visibility(
        observation_wrapper, 'passed', { status: next }, check_id, pc_id, { animate: true }
    );
}
