/**
 * @fileoverview Vy för hantering av stickprov: lista, tillägg, start av granskning och bulk "ingen anmärkning" för helt ogranskade krav per stickprov (endast viss inloggning och när samma person är angiven granskare i metadata).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- vydeps matchar befintlig init-konvention
type SampleManagementDeps = any;

import { SampleListComponent } from './SampleListComponent.js';
import { show_confirm_delete_modal } from '../logic/confirm_delete_modal_logic.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import { effective_status_is_fully_unreviewed_for_bulk_pass } from '../audit_logic.js';
import { user_may_use_sample_mark_bulk_pass_not_audited } from '../logic/sample_bulk_pass_not_audited_gate.js';
import './sample_management_view_component.css';

export class SampleManagementViewComponent {
    root: HTMLElement | null = null;

    deps: SampleManagementDeps | null = null;

    router: ((view: string, params?: Record<string, unknown>) => void) | null = null;

    getState: (() => Record<string, unknown>) | null = null;

    dispatch: ((action: { type: string; payload?: unknown }) => void) | null = null;

    StoreActionTypes: Record<string, string> | null = null;

    Translation: { t: (key: string, params?: Record<string, unknown>) => string } | null = null;

    Helpers: SampleManagementDeps['Helpers'] | null = null;

    NotificationComponent: SampleManagementDeps['NotificationComponent'] | null = null;

    readonly CSS_PATH = './sample_management_view_component.css';

    sample_list_component_instance = SampleListComponent;

    sample_list_container_element: HTMLElement | null = null;

    plate_element_ref: HTMLElement | null = null;

    previously_focused_element: HTMLElement | null = null;

    constructor() {
        this.handle_edit_sample_request_from_list = this.handle_edit_sample_request_from_list.bind(this);
        this.handle_delete_sample_request_from_list = this.handle_delete_sample_request_from_list.bind(this);
        this.handle_start_audit = this.handle_start_audit.bind(this);
        this.handle_mark_bulk_pass_fully_unreviewed_in_sample =
            this.handle_mark_bulk_pass_fully_unreviewed_in_sample.bind(this);
    }

    init({ root, deps }: { root: HTMLElement; deps: SampleManagementDeps }) {
        this.root = root;
        this.deps = deps;

        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;

        void this.init_sub_components();
        if (this.Helpers?.load_css) {
            void this.Helpers.load_css(this.CSS_PATH).catch((e: unknown) => console.warn(e));
        }
    }

    async init_sub_components() {
        if (!this.Helpers) return;
        this.sample_list_container_element = this.Helpers.create_element('div', { id: 'sample-list-area-smv' });

        await this.sample_list_component_instance.init({
            root: this.sample_list_container_element,
            deps: {
                ...this.deps,
                on_edit: this.handle_edit_sample_request_from_list,
                on_delete: this.handle_delete_sample_request_from_list,
                on_mark_sample_bulk_pass_fully_unreviewed: this.handle_mark_bulk_pass_fully_unreviewed_in_sample
            }
        });
    }

    handle_edit_sample_request_from_list(sample_id: string) {
        this.router?.('sample_form', { editSampleId: sample_id });
    }

    handle_delete_sample_request_from_list(sample_id: string, delete_button: HTMLElement) {
        const t = this.Translation?.t;
        if (!t || !this.getState || !this.Helpers || !this.NotificationComponent || !this.dispatch || !this.StoreActionTypes) {
            return;
        }
        const current_state = this.getState() as { samples: Array<{ id: string; description?: string }> };
        if (current_state.samples.length <= 1) {
            this.NotificationComponent.show_global_message(t('error_cannot_delete_last_sample'), 'warning');
            return;
        }

        const sample_to_delete = current_state.samples.find((s) => s.id === sample_id);
        if (!sample_to_delete) return;
        const sample_name = this.Helpers.escape_html(sample_to_delete.description || '');
        const warning_text = t('confirm_delete_sample', { sampleName: sample_name });
        const button_el = delete_button?.tagName === 'BUTTON' ? delete_button : (document.activeElement as HTMLElement);

        show_confirm_delete_modal({
            warning_text,
            delete_button: button_el,
            on_confirm: () => {
                this.dispatch?.({ type: this.StoreActionTypes!.DELETE_SAMPLE, payload: { sampleId: sample_id } });
            }
        });
    }

    count_fully_unreviewed_requirements_for_sample(sample_id: string): number {
        const state = this.getState?.() as {
            ruleFileContent?: { requirements?: unknown };
            samples?: Array<{ id: string; requirementResults?: Record<string, unknown> }>;
        } | null;
        const AuditLogic = this.deps?.AuditLogic;
        if (!state?.ruleFileContent?.requirements || !AuditLogic?.get_relevant_requirements_for_sample) return 0;
        const sample = state.samples?.find((s) => s.id === sample_id);
        if (!sample) return 0;
        let n = 0;
        const relevant = AuditLogic.get_relevant_requirements_for_sample(state.ruleFileContent, sample);
        relevant.forEach((req_def: { key?: string; id?: string }) => {
            const st = AuditLogic.get_effective_requirement_audit_status(
                state.ruleFileContent!.requirements,
                sample.requirementResults,
                req_def,
                null
            );
            if (effective_status_is_fully_unreviewed_for_bulk_pass(st)) n += 1;
        });
        return n;
    }

    handle_mark_bulk_pass_fully_unreviewed_in_sample(sample_id: string, trigger_button: HTMLElement | null) {
        const st = this.getState?.() as { auditMetadata?: { auditorName?: string } } | null;
        if (!user_may_use_sample_mark_bulk_pass_not_audited(undefined, () => st?.auditMetadata?.auditorName)) return;
        const t = this.Translation?.t;
        const ModalComponent = app_runtime_refs.modal_component as {
            show?: (opts: { h1_text: string; message_text: string }, fn: (c: HTMLElement, m: { close: (el: HTMLElement | null) => void }) => void) => void;
        } | null;
        if (!t || !ModalComponent?.show || !this.Helpers?.create_element || !this.dispatch || !this.StoreActionTypes) return;

        const req_count = this.count_fully_unreviewed_requirements_for_sample(sample_id);
        if (req_count === 0) return;

        const state = this.getState?.() as { samples?: Array<{ id: string; description?: string }> };
        const sample = state?.samples?.find((s) => s.id === sample_id);
        const sample_description = sample?.description || t('undefined_description');

        ModalComponent.show(
            {
                h1_text: t('sample_mark_bulk_pass_not_audited_confirm_title'),
                message_text: ''
            },
            (container, modal) => {
                const msg_wrapper = this.Helpers!.create_element('div', { class_name: 'modal-message-block' });
                const p1 = this.Helpers!.create_element('p', {
                    text_content: t('sample_mark_bulk_pass_not_audited_confirm_p1', {
                        req_count,
                        sample_description
                    })
                });
                const p2 = this.Helpers!.create_element('p', {
                    text_content: t('sample_mark_bulk_pass_not_audited_confirm_p2')
                });
                const p3 = this.Helpers!.create_element('p', {
                    text_content: t('sample_mark_bulk_pass_not_audited_confirm_p3')
                });
                const p4 = this.Helpers!.create_element('p', {
                    text_content: t('sample_mark_bulk_pass_not_audited_confirm_p4')
                });
                msg_wrapper.append(p1, p2, p3, p4);
                const existing_msg = container.querySelector('.modal-message');
                if (existing_msg) existing_msg.replaceWith(msg_wrapper);

                const actions_wrapper = this.Helpers!.create_element('div', { class_name: 'modal-confirm-actions' });
                const yes_btn = this.Helpers!.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('mark_all_unreviewed_passed_confirm_yes')
                });
                yes_btn.addEventListener('click', () => {
                    modal.close(trigger_button);
                    this.dispatch?.({
                        type: this.StoreActionTypes!.MARK_ALL_UNREVIEWED_AS_PASSED_IN_SAMPLE,
                        payload: { sampleId: sample_id }
                    });
                    this.NotificationComponent?.show_global_message?.(t('sample_mark_bulk_pass_not_audited_toast'), 'success');
                    this.render();
                });
                const no_btn = this.Helpers!.create_element('button', {
                    class_name: ['button', 'button-default'],
                    text_content: t('mark_all_unreviewed_passed_confirm_no')
                });
                no_btn.addEventListener('click', () => modal.close(trigger_button));
                actions_wrapper.append(yes_btn, no_btn);
                container.appendChild(actions_wrapper);
            }
        );
    }

    handle_start_audit() {
        if (!this.dispatch || !this.StoreActionTypes) return;
        this.dispatch({ type: this.StoreActionTypes.SET_AUDIT_STATUS, payload: { status: 'in_progress' } });
        this.router?.('audit_overview');
    }

    render() {
        if (!this.root || !this.Translation || !this.getState || !this.Helpers) return;
        const t = this.Translation.t;
        const current_state = this.getState() as { samples?: unknown[]; auditStatus?: string };

        if (!this.plate_element_ref || !this.root.contains(this.plate_element_ref)) {
            this.root.innerHTML = '';
            const new_plate = this.Helpers.create_element('div', { class_name: 'content-plate sample-management-view-plate' });
            this.plate_element_ref = new_plate;
            this.root.appendChild(new_plate);
        }

        const plate = this.plate_element_ref;
        if (!plate) return;

        plate.innerHTML = '';

        plate.appendChild(
            this.Helpers.create_element('h1', {
                text_content: t('sample_management_title_with_count', { count: current_state.samples?.length || 0 })
            })
        );
        plate.appendChild(
            this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: t('add_samples_intro_message') })
        );

        const top_actions_div = this.Helpers.create_element('div', { class_name: 'sample-management-actions' });
        const add_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            html_content: `<span>${t('add_new_sample')}</span>${this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('add') : ''}`
        });

        add_button.addEventListener('click', () => {
            this.router?.('sample_form');
        });
        top_actions_div.appendChild(add_button);
        plate.appendChild(top_actions_div);

        this.sample_list_component_instance.render();
        plate.appendChild(this.sample_list_container_element!);

        if (current_state.auditStatus === 'not_started') {
            const bottom_actions_div = this.Helpers.create_element('div', {
                class_name: ['form-actions', 'space-between-groups'],
                style: 'margin-top: 1rem; width: 100%;'
            });

            const left_group_bottom = this.Helpers.create_element('div', { class_name: 'action-group-left' });
            const back_to_metadata_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                html_content: `<span>${t('back_to_metadata')}</span>${this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('arrow_back') : ''}`
            });
            back_to_metadata_btn.addEventListener('click', () => this.router?.('metadata'));
            left_group_bottom.appendChild(back_to_metadata_btn);

            const back_to_audit_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                html_content: `<span>${t('back_to_audit')}</span>${this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('arrow_back') : ''}`
            });
            back_to_audit_btn.addEventListener('click', () => this.router?.('start'));
            left_group_bottom.appendChild(back_to_audit_btn);
            bottom_actions_div.appendChild(left_group_bottom);

            if ((current_state.samples?.length || 0) > 0) {
                const right_group_bottom = this.Helpers.create_element('div', { class_name: 'action-group-right' });
                const start_audit_button = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-success'],
                    html_content: `<span>${t('start_audit')}</span>${this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('check_circle') : ''}`
                });
                start_audit_button.addEventListener('click', this.handle_start_audit);
                right_group_bottom.appendChild(start_audit_button);
                bottom_actions_div.appendChild(right_group_bottom);
            }
            plate.appendChild(bottom_actions_div);
        }
    }

    destroy() {
        if (this.sample_list_component_instance?.destroy) {
            this.sample_list_component_instance.destroy();
        }
        this.root = null;
        this.plate_element_ref = null;
        this.previously_focused_element = null;
        this.deps = null;
        this.router = null;
        this.getState = null;
        this.dispatch = null;
        this.StoreActionTypes = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
    }
}
