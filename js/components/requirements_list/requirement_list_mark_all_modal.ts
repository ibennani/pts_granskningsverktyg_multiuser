/**
 * Modal för att markera ett krav som godkänt i alla relevanta stickprov.
 * @module js/components/requirements_list/requirement_list_mark_all_modal
 */

import { app_runtime_refs } from '../../utils/app_runtime_refs.js';
import {
    get_effective_requirement_audit_status,
    find_requirement_definition,
    effective_status_is_fully_unreviewed_for_bulk_pass
} from '../../audit_logic.js';
import { sync_to_server_now } from '../../logic/server_sync.js';
import { has_pending_server_sync, refresh_connectivity_banner } from '../../logic/connectivity_service.js';
import { has_unsynced_local_audit_changes } from '../../logic/audit_sync_tracking.js';

/**
 * @param {string} requirement_id
 * @param {HTMLElement} trigger_button
 * @param {object} ctx
 * @param {() => object} ctx.getState
 * @param {object} ctx.AuditLogic
 * @param {object} ctx.Helpers
 * @param {object} ctx.Translation
 * @param {function} ctx.dispatch
 * @param {object} ctx.StoreActionTypes
 * @param {object} [ctx.NotificationComponent]
 * @param {() => void|Promise<void>} ctx.refresh_after_bulk_pass
 */
export function handle_mark_requirement_passed_in_all_samples(requirement_id: any, trigger_button: any, ctx: any) {
    const t = ctx.Translation.t;
    const ModalComponent = app_runtime_refs.modal_component as { show?: (opts: any, render: (container: any, modal: any) => void) => void } | null;
    if (!ModalComponent?.show || !ctx.Helpers?.create_element) return;

    const state = ctx.getState();
    const rule_file = state?.ruleFileContent;
    const samples = state?.samples || [];
    const requirements = rule_file?.requirements;
    const req_def = requirements ? find_requirement_definition(requirements, requirement_id) : null;
    const requirement_title = req_def?.title || requirement_id;

    const affected_samples: any[] = [];
    if (ctx.AuditLogic?.get_relevant_requirements_for_sample) {
        samples.forEach((sample: any) => {
            const relevant_reqs = ctx.AuditLogic.get_relevant_requirements_for_sample(rule_file, sample);
            const req = relevant_reqs.find((r: any) => (r.key || r.id) === requirement_id);
            if (req) {
                const status = get_effective_requirement_audit_status(
                    requirements,
                    sample.requirementResults,
                    req,
                    null
                );
                if (effective_status_is_fully_unreviewed_for_bulk_pass(status)) {
                    affected_samples.push(sample);
                }
            }
        });
    }
    const sample_count = affected_samples.length;

    ModalComponent.show(
        {
            h1_text: t('mark_requirement_passed_in_all_samples_confirm_title', { sample_count }),
            message_text: ''
        },
        (container: any, modal: any) => {
            const msg_wrapper = ctx.Helpers.create_element('div', { class_name: 'modal-message-block' });
            const p1 = ctx.Helpers.create_element('p', {
                text_content: t('mark_requirement_passed_in_all_samples_confirm_p1', { requirement_title, sample_count })
            });
            const p2 = ctx.Helpers.create_element('p', {
                text_content: t('mark_requirement_passed_in_all_samples_confirm_p2')
            });
            const p3 = ctx.Helpers.create_element('p', {
                text_content: t('mark_requirement_passed_in_all_samples_confirm_p3')
            });
            const p4 = ctx.Helpers.create_element('p', {
                text_content: t('mark_requirement_passed_in_all_samples_confirm_p4')
            });

            const samples_list_wrapper = ctx.Helpers.create_element('div', { class_name: 'modal-affected-samples-list' });
            const samples_list_label = ctx.Helpers.create_element('p', {
                class_name: 'modal-affected-samples-label',
                text_content: t('mark_requirement_passed_in_all_samples_affected_list')
            });
            const samples_ul = ctx.Helpers.create_element('ul', { class_name: 'modal-affected-samples-ul' });
            affected_samples.forEach((sample: any) => {
                const sample_name = sample?.description || t('undefined_description');
                const li = ctx.Helpers.create_element('li', { text_content: sample_name });
                samples_ul.appendChild(li);
            });
            samples_list_wrapper.appendChild(samples_list_label);
            samples_list_wrapper.appendChild(samples_ul);

            msg_wrapper.append(p1, samples_list_wrapper, p2, p3, p4);
            const existing_msg = container.querySelector('.modal-message');
            if (existing_msg) existing_msg.replaceWith(msg_wrapper);

            const actions_wrapper = ctx.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
            const yes_btn = ctx.Helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                text_content: t('mark_all_unreviewed_passed_confirm_yes')
            });
            yes_btn.addEventListener('click', () => {
                void (async () => {
                    modal.close(trigger_button);
                    ctx.dispatch({
                        type: ctx.StoreActionTypes.MARK_REQUIREMENT_AS_PASSED_IN_ALL_SAMPLES,
                        payload: { requirementId: requirement_id, skip_render: true }
                    });
                    await sync_to_server_now(ctx.getState, ctx.dispatch);
                    const state_after_sync = ctx.getState();
                    if (
                        !has_pending_server_sync() &&
                        !has_unsynced_local_audit_changes(state_after_sync)
                    ) {
                        ctx.NotificationComponent?.show_global_message?.(
                            t('mark_requirement_passed_in_all_samples_toast'),
                            'success'
                        );
                    } else {
                        refresh_connectivity_banner();
                    }
                    await ctx.refresh_after_bulk_pass?.();
                })();
            });
            const no_btn = ctx.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                text_content: t('mark_all_unreviewed_passed_confirm_no')
            });
            no_btn.addEventListener('click', () => modal.close(trigger_button));
            actions_wrapper.append(yes_btn, no_btn);
            container.appendChild(actions_wrapper);
        }
    );
}
