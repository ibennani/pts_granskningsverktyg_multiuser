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
    build_audit_actions_manage_content,
    build_audit_actions_downloads_content,
} from './audit_actions_view_sections.js';
import {
    refresh_audit_actions_rulefile_subscription,
} from './audit_actions_view_status_section.js';
import {
    audit_actions_status_change_should_fade_content,
    run_audit_actions_content_transition,
} from './audit_actions_view_content_transition.js';
import {
    audit_status_change_needs_confirmation,
    get_allowed_audit_status_targets,
    get_audit_status_change_success_message_key,
    reset_audit_status_select,
} from './audit_actions_view_status_select.js';
import {
    normalize_audit_actions_section,
    render_audit_actions_hub,
    render_audit_actions_section_header,
} from './audit_actions_render.js';
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
        this._audit_actions_status_transition_active = false;

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

        this.handle_mark_all_unreviewed_as_passed = this.handle_mark_all_unreviewed_as_passed.bind(this);
        this.handle_download_audit = this.handle_download_audit.bind(this);
        this.handle_status_select_change = this.handle_status_select_change.bind(this);

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

    _focus_status_select() {
        if (!this.root) return;
        const select = this.root.querySelector('#audit-action-status-select');
        if (!select || typeof select.focus !== 'function') return;
        try {
            select.focus({ preventScroll: true });
        } catch {
            select.focus();
        }
    }

    _apply_audit_status_change(event, { status, success_message_key }) {
        const t = this.Translation.t;
        const control = event?.currentTarget;
        if (control) {
            control.classList.add('audit-actions__btn--animating');
            control.setAttribute('aria-busy', 'true');
        }
        void (async () => {
            try {
                const previous_status = this.getState()?.auditStatus;
                const should_fade_content = audit_actions_status_change_should_fade_content(previous_status, status);
                if (should_fade_content) {
                    this._audit_actions_status_transition_active = true;
                }
                if (!this.dispatch || !this.StoreActionTypes) return;
                if (should_fade_content) {
                    await run_audit_actions_content_transition(this.root, async () => {
                        await this.dispatch({
                            type: this.StoreActionTypes.SET_AUDIT_STATUS,
                            payload: { status }
                        });
                        this._render_immediate({ enter_hidden: true });
                    });
                } else {
                    await this.dispatch({
                        type: this.StoreActionTypes.SET_AUDIT_STATUS,
                        payload: { status }
                    });
                    this._render_immediate();
                }
                if (control) control.removeAttribute('aria-busy');
                await new Promise((resolve) => {
                    requestAnimationFrame(() => resolve(undefined));
                });
                reset_audit_status_select(this.root, status);
                this._focus_status_select();
                this.NotificationComponent?.show_global_message?.(t(success_message_key), 'success');
            } catch {
                reset_audit_status_select(this.root, this.getState()?.auditStatus);
                this.NotificationComponent?.show_global_message?.(t('error_internal'), 'error');
            } finally {
                this._audit_actions_status_transition_active = false;
                if (control) {
                    setTimeout(() => control.classList.remove('audit-actions__btn--animating'), 500);
                }
            }
        })();
    }

    _show_status_change_confirm_modal(event, target_status, title_key, message_key) {
        const t = this.Translation.t;
        const trigger = event?.currentTarget || null;
        const ModalComponent = app_runtime_refs.modal_component;
        if (!ModalComponent?.show || !this.Helpers?.create_element) {
            reset_audit_status_select(this.root, this.getState()?.auditStatus);
            return;
        }

        const previous_status = this.getState()?.auditStatus;
        ModalComponent.show(
            { h1_text: t(title_key), message_text: '' },
            (container, modal) => {
                const msg_wrapper = this.Helpers.create_element('div', { class_name: 'modal-message-block' });
                msg_wrapper.appendChild(this.Helpers.create_element('p', {
                    text_content: t(message_key),
                }));
                const existing_msg = container.querySelector('.modal-message');
                if (existing_msg) existing_msg.replaceWith(msg_wrapper);

                const actions_wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const yes_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('audit_actions_status_change_confirm_yes'),
                });
                yes_btn.addEventListener('click', () => {
                    modal.close(trigger);
                    this._apply_audit_status_change(event, {
                        status: target_status,
                        success_message_key: get_audit_status_change_success_message_key(
                            previous_status,
                            target_status
                        ),
                    });
                });
                const no_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    text_content: t('audit_actions_status_change_confirm_no'),
                });
                no_btn.addEventListener('click', () => {
                    modal.close(trigger);
                    reset_audit_status_select(this.root, previous_status);
                });
                actions_wrapper.append(yes_btn, no_btn);
                container.appendChild(actions_wrapper);
            }
        );
    }

    handle_status_select_change(event, target_status) {
        const current_status = this.getState()?.auditStatus;
        if (!target_status || target_status === current_status) {
            reset_audit_status_select(this.root, current_status);
            return;
        }

        const allowed_targets = get_allowed_audit_status_targets(String(current_status ?? ''));
        if (!allowed_targets.includes(target_status)) {
            reset_audit_status_select(this.root, current_status);
            this.NotificationComponent?.show_global_message?.(
                this.Translation.t('audit_actions_status_change_not_allowed'),
                'error'
            );
            return;
        }

        if (audit_status_change_needs_confirmation(target_status)) {
            const title_key = target_status === 'locked'
                ? 'audit_actions_status_change_confirm_locked_title'
                : 'audit_actions_status_change_confirm_archived_title';
            const message_key = target_status === 'locked'
                ? 'audit_actions_status_change_confirm_locked_message'
                : 'audit_actions_status_change_confirm_archived_message';
            this._show_status_change_confirm_modal(event, target_status, title_key, message_key);
            return;
        }

        this._apply_audit_status_change(event, {
            status: target_status,
            success_message_key: get_audit_status_change_success_message_key(current_status, target_status),
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
        if (this._audit_actions_status_transition_active) {
            return;
        }
        this._render_immediate();
    }

    _render_immediate({ enter_hidden = false } = {}) {
        if (!this.root) return;
        const t = this.Translation.t;
        const state = this.getState();

        if (!state?.ruleFileContent) {
            this.root.innerHTML = '';
            const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });
            plate.appendChild(this.Helpers.create_element('h1', { text_content: t('audit_actions_title') }));
            plate.appendChild(this.Helpers.create_element('p', { text_content: t('error_no_active_audit') }));
            this.root.appendChild(plate);
            return;
        }

        const section = normalize_audit_actions_section(this.deps?.params?.section);
        const render_deps = {
            Helpers: this.Helpers,
            Translation: this.Translation,
            router: this.router,
        };

        this.root.innerHTML = '';
        const plate = this.Helpers.create_element('div', {
            class_name: 'content-plate audit-actions-plate',
        });

        refresh_audit_actions_rulefile_subscription(this, state);

        let content_wrapper;
        if (section === 'manage') {
            render_audit_actions_section_header(render_deps, plate, {
                title_key: 'audit_actions_manage_title',
                intro_key: 'audit_actions_manage_intro',
            });
            content_wrapper = build_audit_actions_manage_content(this, state, t);
        } else if (section === 'downloads') {
            render_audit_actions_section_header(render_deps, plate, {
                title_key: 'audit_actions_downloads_title',
                intro_key: 'audit_actions_downloads_intro',
            });
            content_wrapper = build_audit_actions_downloads_content(this, state, t);
        } else {
            render_audit_actions_hub(render_deps, plate);
            this.root.appendChild(plate);
            return;
        }

        if (enter_hidden) {
            content_wrapper.style.opacity = '0';
            content_wrapper.style.transition = 'opacity 0.25s ease';
        }
        plate.appendChild(content_wrapper);
        this.root.appendChild(plate);
    }

    destroy() {
        this._close_rules_push_subscription();
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
        this.newerRuleAvailable = null;
        this._newerRuleCheckInProgress = false;
        this._audit_actions_status_transition_active = false;
    }
}
