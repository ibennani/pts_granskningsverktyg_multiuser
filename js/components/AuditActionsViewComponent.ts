// @ts-nocheck
import { effective_status_is_fully_unreviewed_for_bulk_pass } from '../audit_logic.js';
import { get_rules, save_audit_backup_on_server } from '../api/client.js';
import { subscribe_rules } from '../logic/list_push_service.js';
import { version_greater_than } from '../utils/version_utils.js';
import { find_newer_rule_for_audit } from '../logic/newer_rule_check.js';
import { audit_status_blocks_rulefile_update_offer } from '../utils/audit_status_helpers.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import { is_download_file_too_large_error } from '../utils/download_filename_utils.js';
import { bind_audit_actions_view_ui } from './audit_actions_view_ui.js';
import { bind_audit_actions_export_handlers } from './audit_actions_view_export_handlers.js';
import {
    build_audit_actions_appendix_guide_section,
    build_audit_actions_export_section,
} from './audit_actions_view_sections.js';
import {
    build_audit_actions_status_section,
    refresh_audit_actions_rulefile_subscription,
} from './audit_actions_view_status_section.js';
import './audit_actions_view_component.css';

export class AuditActionsViewComponent {
    constructor() {
        this.root = null;
        this.deps = null;
        this.newerRuleAvailable = null;
        this._newerRuleCheckInProgress = false;
        this._unsubscribe_rules = null;
        this.router = null;
        this.getState = null;
        this.dispatch = null;
        this.StoreActionTypes = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
        this.ExportLogic = null;
        this.AuditLogic = null;
        this.SaveAuditLogic = null;
    }

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.newerRuleAvailable = null;
        this._newerRuleCheckInProgress = false;
        this._unsubscribe_rules = null;

        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.ExportLogic = deps.ExportLogic;
        this.AuditLogic = deps.AuditLogic;
        this.SaveAuditLogic = deps.SaveAuditLogic || window.SaveAuditLogic;
        this.flush_sync_to_server = deps.flush_sync_to_server || null;

                this.handle_lock_audit = this.handle_lock_audit.bind(this);
        this.handle_mark_all_unreviewed_as_passed = this.handle_mark_all_unreviewed_as_passed.bind(this);
        this.handle_unlock_audit = this.handle_unlock_audit.bind(this);
        this.handle_download_audit = this.handle_download_audit.bind(this);
        this.handle_archive_audit = this.handle_archive_audit.bind(this);
        this.handle_activate_audit = this.handle_activate_audit.bind(this);

        bind_audit_actions_view_ui(this);
        bind_audit_actions_export_handlers(this);
    }

    _populate_update_rulefile_slot(slot_element, state) {
        const newer_rule = this.newerRuleAvailable;
        const should_show = !audit_status_blocks_rulefile_update_offer(state?.auditStatus) && newer_rule?.ruleId && newer_rule?.version;
        const has_content = slot_element.children.length > 0;

        if (should_show) {
            slot_element.classList.remove('audit-actions__update-rulefile-slot--hidden');
            slot_element.innerHTML = '';
            const t = this.Translation.t;
            slot_element.appendChild(this.create_status_action_item({
                label: t('update_rulefile_button_with_version', { version: newer_rule.version }),
                description: t('audit_actions_update_rulefile_description'),
                on_click: () => this.router('update_rulefile', { ruleId: newer_rule.ruleId, version: newer_rule.version }),
                variant: 'button-default',
                icon_name: 'update',
                id_suffix: 'update-rulefile'
            }));
        } else if (has_content) {
            slot_element.classList.add('audit-actions__update-rulefile-slot--hidden');
            setTimeout(() => {
                if (slot_element.classList.contains('audit-actions__update-rulefile-slot--hidden')) {
                    slot_element.innerHTML = '';
                    slot_element.classList.remove('audit-actions__update-rulefile-slot--hidden');
                }
            }, 500);
        }
    }

    _render_update_rulefile_slot() {
        if (!this.root) return;
        const slot = this.root.querySelector('[data-audit-action="update-rulefile-slot"]');
        if (slot) this._populate_update_rulefile_slot(slot, this.getState());
    }

    _ensure_rules_push_subscription() {
        if (this._unsubscribe_rules) return;
        this._unsubscribe_rules = subscribe_rules(() => this._refresh_newer_rule_check());
    }

    _close_rules_push_subscription() {
        if (typeof this._unsubscribe_rules === 'function') {
            this._unsubscribe_rules();
            this._unsubscribe_rules = null;
        }
    }

    _refresh_newer_rule_check() {
        if (this._newerRuleCheckInProgress) return;
        const state = this.getState();
        if (!state?.ruleFileContent || audit_status_blocks_rulefile_update_offer(state.auditStatus)) return;
        this._newerRuleCheckInProgress = true;
        get_rules()
            .then((rules) => {
                const result = find_newer_rule_for_audit(state.ruleFileContent, rules, version_greater_than, state.ruleSetId);
                this.newerRuleAvailable = result;
                this._newerRuleCheckInProgress = false;
                if (this.root) this._render_update_rulefile_slot();
            })
            .catch(() => {
                this._newerRuleCheckInProgress = false;
            });
    }

    async handle_download_audit() {
        const t = this.Translation.t;
        const current_state = this.getState();
        const show_msg = this.NotificationComponent?.show_global_message?.bind(this.NotificationComponent);
        if (current_state?.auditId) {
            save_audit_backup_on_server(current_state.auditId).catch(() => {});
        }
        if (this.SaveAuditLogic?.save_audit_to_json_file) {
            try {
                await this.SaveAuditLogic.save_audit_to_json_file(current_state, t, show_msg);
            } catch (err) {
                if (is_download_file_too_large_error(err)) {
                    throw err;
                }
                if (show_msg) show_msg(t('error_internal'), 'error');
                throw new Error('download_audit_failed');
            }
        } else if (show_msg) {
            show_msg(t('error_internal'), 'error');
            throw new Error('download_audit_failed');
        }
    }

    _primary_status_button_id(audit_status) {
        const id_by_status = {
            in_progress: 'audit-action-btn-lock-audit',
            locked: 'audit-action-btn-unlock-audit',
            archived: 'audit-action-btn-activate-audit'
        };
        return id_by_status[audit_status] || null;
    }

    _focus_primary_status_button(audit_status) {
        const button_id = this._primary_status_button_id(audit_status);
        if (!button_id || !this.root) return;
        const button = this.root.querySelector(`#${CSS.escape(button_id)}`);
        if (!button || typeof button.focus !== 'function') return;
        try {
            button.focus({ preventScroll: true });
        } catch {
            button.focus();
        }
    }

    _apply_audit_status_change(event, { status, success_message_key }) {
        const t = this.Translation.t;
        const btn = event?.currentTarget;
        if (btn) {
            btn.classList.add('audit-actions__btn--animating');
            btn.setAttribute('aria-busy', 'true');
        }
        void (async () => {
            try {
                if (!this.dispatch || !this.StoreActionTypes) return;
                await this.dispatch({
                    type: this.StoreActionTypes.SET_AUDIT_STATUS,
                    payload: { status }
                });
                if (btn) btn.removeAttribute('aria-busy');
                this.render();
                this._focus_primary_status_button(status);
                this.NotificationComponent?.show_global_message?.(t(success_message_key), 'success');
            } catch {
                this.NotificationComponent?.show_global_message?.(t('error_internal'), 'error');
            } finally {
                if (btn) {
                    setTimeout(() => btn.classList.remove('audit-actions__btn--animating'), 500);
                }
            }
        })();
    }

    handle_lock_audit(event) {
        this._apply_audit_status_change(event, {
            status: 'locked',
            success_message_key: 'audit_locked_successfully'
        });
    }

    handle_unlock_audit(event) {
        this._apply_audit_status_change(event, {
            status: 'in_progress',
            success_message_key: 'audit_unlocked_successfully'
        });
    }

    handle_archive_audit(event) {
        this._apply_audit_status_change(event, {
            status: 'archived',
            success_message_key: 'audit_archived_successfully'
        });
    }

    handle_activate_audit(event) {
        this._apply_audit_status_change(event, {
            status: 'locked',
            success_message_key: 'audit_reactivated_successfully'
        });
    }

    count_unreviewed_requirements() {
        const state = this.getState();
        if (!state?.ruleFileContent?.requirements || !state?.samples?.length || !this.AuditLogic) {
            return { req_count: 0, sample_count: 0 };
        }
        let req_count = 0;
        let samples_with_unreviewed = 0;
        (state.samples || []).forEach(sample => {
            let sample_has_unreviewed = false;
            const relevant_reqs = this.AuditLogic.get_relevant_requirements_for_sample(state.ruleFileContent, sample);
            relevant_reqs.forEach(req_def => {
                const status = this.AuditLogic.get_effective_requirement_audit_status(
                    state.ruleFileContent.requirements,
                    sample.requirementResults,
                    req_def,
                    null
                );
                if (effective_status_is_fully_unreviewed_for_bulk_pass(status)) {
                    req_count++;
                    sample_has_unreviewed = true;
                }
            });
            if (sample_has_unreviewed) samples_with_unreviewed++;
        });
        return { req_count, sample_count: samples_with_unreviewed };
    }

    refresh_after_global_bulk_pass() {
        const mark_btn = this.root?.querySelector('#audit-action-btn-mark-all-unreviewed');
        const mark_item = mark_btn?.closest('.audit-actions__status-item');
        const { req_count } = this.count_unreviewed_requirements();
        if (req_count === 0 && mark_item) {
            mark_item.remove();
            return;
        }
        if (req_count > 0 && !mark_item) {
            this.render();
        }
    }

    handle_mark_all_unreviewed_as_passed(event) {
        const t = this.Translation.t;
        const { req_count, sample_count } = this.count_unreviewed_requirements();
        if (req_count === 0) return;

        const trigger_button = event?.currentTarget || null;
        const ModalComponent = app_runtime_refs.modal_component;
        if (!ModalComponent?.show || !this.Helpers?.create_element) return;

        ModalComponent.show(
            {
                h1_text: t('mark_all_unreviewed_passed_confirm_title'),
                message_text: ''
            },
            (container, modal) => {
                const msg_wrapper = this.Helpers.create_element('div', { class_name: 'modal-message-block' });
                const p1 = this.Helpers.create_element('p', {
                    text_content: t('mark_all_unreviewed_passed_confirm_p1', { req_count, sample_count })
                });
                const p2 = this.Helpers.create_element('p', {
                    text_content: t('mark_all_unreviewed_passed_confirm_p2')
                });
                const p3 = this.Helpers.create_element('p', {
                    text_content: t('mark_all_unreviewed_passed_confirm_p3')
                });
                const p4 = this.Helpers.create_element('p', {
                    text_content: t('mark_all_unreviewed_passed_confirm_p4')
                });
                msg_wrapper.append(p1, p2, p3, p4);
                const existing_msg = container.querySelector('.modal-message');
                if (existing_msg) existing_msg.replaceWith(msg_wrapper);

                const actions_wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const yes_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('mark_all_unreviewed_passed_confirm_yes')
                });
                yes_btn.addEventListener('click', () => {
                    modal.close(trigger_button);
                    this.dispatch({ type: this.StoreActionTypes.MARK_ALL_UNREVIEWED_AS_PASSED });
                    this.NotificationComponent.show_global_message(t('mark_all_unreviewed_passed_toast'), 'success');
                    this.refresh_after_global_bulk_pass();
                });
                const no_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    text_content: t('mark_all_unreviewed_passed_confirm_no')
                });
                no_btn.addEventListener('click', () => modal.close(trigger_button));
                actions_wrapper.append(yes_btn, no_btn);
                container.appendChild(actions_wrapper);
            }
        );
    }

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        this.root.innerHTML = '';

        const state = this.getState();
        if (!state?.ruleFileContent) {
            const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });
            plate.appendChild(this.Helpers.create_element('h1', { text_content: t('audit_actions_title') }));
            plate.appendChild(this.Helpers.create_element('p', { text_content: t('error_no_active_audit') }));
            this.root.appendChild(plate);
            return;
        }

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });
        plate.appendChild(this.Helpers.create_element('h1', { text_content: t('audit_actions_title') }));

        refresh_audit_actions_rulefile_subscription(this, state);

        plate.appendChild(build_audit_actions_status_section(this, state, t));
        plate.appendChild(build_audit_actions_appendix_guide_section(this, state, t));
        plate.appendChild(build_audit_actions_export_section(this, state, t));
        this.root.appendChild(plate);
    }

    destroy() {
        this._close_rules_push_subscription();
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
        this.newerRuleAvailable = null;
        this._newerRuleCheckInProgress = false;
    }
}
