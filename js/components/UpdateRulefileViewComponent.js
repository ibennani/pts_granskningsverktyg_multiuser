// js/components/UpdateRulefileViewComponent.js
import { migrate_rulefile_to_new_structure } from '../logic/rulefile_migration_logic.js';
import { get_rule } from '../api/client.js';

export const UpdateRulefileViewComponent = {
    CSS_PATH: 'css/components/update_rulefile_view.css',
    VIEW_STEPS: {
        WARNING: 'WARNING',
        UPLOAD: 'UPLOAD',
        CONFIRM: 'CONFIRM'
    },

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.SaveAuditLogic = deps.SaveAuditLogic;
        this.ValidationLogic = deps.ValidationLogic || window.ValidationLogic;

        const rule_id = deps.params?.ruleId;
        if (!rule_id) {
            this.router('audit_overview');
            return;
        }
        this.rule_id_from_params = rule_id;
        this.new_rule_version_from_params = (deps.params?.version || '').trim() || null;

        this.current_step = this.VIEW_STEPS.WARNING;
        this.staged_new_rule_file_content = null;
        this.staged_analysis_report = null;
        this.plate_element_ref = null;
        this._loading_server_rule = false;
        this._backup_saved = false;
        this._analysis_ready = false;

        if (this.Helpers?.load_css && this.CSS_PATH) {
            try {
                const link_tag = document.querySelector(`link[href="${this.CSS_PATH}"]`);
                if (!link_tag) {
                    await this.Helpers.load_css(this.CSS_PATH);
                }
            } catch (error) {
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn("CSS for UpdateRulefileViewComponent not found yet, skipping load.", error);
            }
        }
    },

    get_t_internally() {
        return this.Translation?.t || ((key) => `**${key}**`);
    },

    handle_backup_click() {
        const t = this.get_t_internally();
        if (this.SaveAuditLogic?.save_audit_to_json_file) {
            const show_msg = (msg, type) => this.NotificationComponent?.show_global_message?.(msg, type);
            this.SaveAuditLogic.save_audit_to_json_file(this.getState(), t, show_msg);
            this._backup_saved = true;
            this.current_step = this.VIEW_STEPS.UPLOAD;
            this.render();
        } else {
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn("SaveAuditLogic not available to perform backup.");
            if (this.NotificationComponent?.show_global_message) {
                this.NotificationComponent.show_global_message(t('error_saving_audit'), 'error');
            }
        }
    },

    handle_skip_backup_click() {
        this._backup_saved = false;
        this._analysis_ready = false;
        this.current_step = this.VIEW_STEPS.UPLOAD;
        this.render();
    },

    async handle_use_rule_from_server_click() {
        const t = this.get_t_internally();
        if (!window.RulefileUpdaterLogic) {
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn("CRITICAL: RulefileUpdaterLogic is not available on the window object.");
            this.NotificationComponent?.show_global_message(t('error_internal_reload'), 'error');
            return;
        }
        this._analysis_ready = false;
        this._loading_server_rule = true;
        this.render();
        try {
            const rule_row = await get_rule(this.rule_id_from_params);
            // Uppdatering av regelfil i en granskning ska alltid använda publicerad version.
            let content = rule_row?.published_content ?? rule_row?.content;
            if (typeof content === 'string') {
                try {
                    content = JSON.parse(content);
                } catch {
                    content = null;
                }
            }
            if (!content || typeof content !== 'object') {
                this.NotificationComponent?.show_global_message(t('rule_file_invalid_json'), 'error');
                return;
            }
            const new_rule_content = migrate_rulefile_to_new_structure(content, {
                Translation: this.Translation
            });
            const validation = this.ValidationLogic?.validate_rule_file_json(new_rule_content, {
                t
            });
            if (validation && !validation.isValid) {
                this.NotificationComponent?.show_global_message(validation.message, 'error');
                return;
            }
            const report = window.RulefileUpdaterLogic.analyze_rule_file_changes(this.getState(), new_rule_content);
            this.staged_analysis_report = report;
            this.staged_new_rule_file_content = new_rule_content;
            this._analysis_ready = true;
            this._loading_server_rule = false;
            this.render();
        } catch (error) {
            this._loading_server_rule = false;
            this._analysis_ready = false;
            this.render();
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[UpdateRulefileViewComponent] handle_use_rule_from_server_click:', error);
            const is_network_error = /failed to fetch|networkerror|network error|load failed/i.test(error?.message || '') ||
                (error?.name && /network|typeerror/i.test(error.name));
            const message = is_network_error
                ? t('error_rulefile_update_network')
                : t('error_rulefile_update_failed') + (error?.message ? `: ${error.message}` : '');
            this.NotificationComponent?.show_global_message(message, 'error');
        }
    },

    handle_go_to_confirm_step_click() {
        if (!this._analysis_ready || !this.staged_analysis_report || !this.staged_new_rule_file_content) return;
        this.current_step = this.VIEW_STEPS.CONFIRM;
        this.render();
    },
    
    handle_confirm_update_click() {
        const t = this.get_t_internally();
        if (!this.staged_new_rule_file_content || !this.staged_analysis_report) {
            const errorMsg = t('error_confirm_failed_temp_data_missing');
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn(errorMsg);
            this.NotificationComponent?.show_global_message(t('error_internal'), 'error');
            return;
        }

        const final_reconciled_state = window.RulefileUpdaterLogic.apply_rule_file_update(
            this.getState(),
            this.staged_new_rule_file_content,
            this.staged_analysis_report
        );

        const needs_review_count = (final_reconciled_state.samples || []).reduce((n, s) => {
            return n + Object.values(s.requirementResults || {}).filter(r => r.needsReview === true).length;
        }, 0);

        this.dispatch({
            type: this.StoreActionTypes.REPLACE_RULEFILE_AND_RECONCILE,
            payload: final_reconciled_state
        });

        if (needs_review_count > 0) {
            this.NotificationComponent?.show_global_message(t('update_rulefile_success_needs_review', { count: needs_review_count }), 'success');
            this.router('confirm_updates');
        } else {
            this.NotificationComponent?.show_global_message(t('update_rulefile_success'), 'success');
            this.router('audit_overview');
        }
    },

    render() {
        if (!this.root) return;
        
        if (!this.plate_element_ref || !this.root.contains(this.plate_element_ref)) {
            this.root.innerHTML = '';
            this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate update-rulefile-view-plate' });
            this.root.appendChild(this.plate_element_ref);
        }
        
        this.plate_element_ref.innerHTML = '';

        if (this.NotificationComponent?.get_global_message_element_reference) {
            const global_message_element_ref = this.NotificationComponent.get_global_message_element_reference();
            if (global_message_element_ref) {
                this.plate_element_ref.appendChild(global_message_element_ref);
            }
        }

        this.plate_element_ref.appendChild(this.Helpers.create_element('h1', { text_content: this.get_t_internally()('update_rulefile_title') }));

        switch (this.current_step) {
            case this.VIEW_STEPS.WARNING:
                this.render_warning_step();
                break;
            case this.VIEW_STEPS.UPLOAD:
                this.render_upload_step();
                break;
            case this.VIEW_STEPS.CONFIRM:
                this.render_confirm_step(this.staged_analysis_report);
                break;
        }
    },

    render_warning_step() {
        const t = this.get_t_internally();
        this.plate_element_ref.appendChild(this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: t('update_rulefile_warning_intro') }));
        
        const warning_list = this.Helpers.create_element('ul', { class_name: 'warning-list' });
        warning_list.innerHTML = `
            <li>${t('update_rulefile_warning_li1')}</li>
            <li>${t('update_rulefile_warning_li2')}</li>
        `;
        this.plate_element_ref.appendChild(warning_list);

        this.plate_element_ref.appendChild(this.Helpers.create_element('h2', { style: { 'font-size': '1.2rem', 'margin-top': '1.5rem' }, text_content: t('update_rulefile_recommendation') }));
        this.plate_element_ref.appendChild(this.Helpers.create_element('p', { text_content: t('update_rulefile_backup_text') }));

        const backup_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            html_content: `<span>${t('save_audit_to_file')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('save') : '')
        });
        backup_button.addEventListener('click', () => this.handle_backup_click());

        const skip_backup_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            text_content: t('update_rulefile_skip_backup')
        });
        skip_backup_button.addEventListener('click', () => this.handle_skip_backup_click());

        const back_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            text_content: t('back_to_audit_overview')
        });
        back_button.addEventListener('click', () => this.router('audit_overview'));

        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: { 'margin-top': '2rem' } });
        actions_div.append(backup_button, skip_backup_button, back_button);
        this.plate_element_ref.appendChild(actions_div);
    },
    
    render_upload_step() {
        const t = this.get_t_internally();
        const current_version = (this.getState()?.ruleFileContent?.metadata?.version || '').trim() || t('update_rulefile_version_unknown');
        const new_version = (this.new_rule_version_from_params || '').trim() || t('update_rulefile_version_unknown');

        if (this._backup_saved === true && !this._loading_server_rule) {
            this.plate_element_ref.appendChild(this.Helpers.create_element('div', {
                class_name: 'backup-confirmation',
                html_content: (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('check_circle') : '✔') + ` <span>${t('update_rulefile_backup_saved')}</span>`
            }));
        }

        this.plate_element_ref.appendChild(this.Helpers.create_element('h2', { style: { 'font-size': '1.2rem', 'margin-top': '1.5rem' }, text_content: t('update_rulefile_step2_title') }));
        this.plate_element_ref.appendChild(this.Helpers.create_element('p', { text_content: t('update_rulefile_step2_intro') }));

        const versions_ul = this.Helpers.create_element('ul', { class_name: 'version-list' });
        const current_li = this.Helpers.create_element('li');
        current_li.appendChild(document.createTextNode(t('update_rulefile_version_current_prefix')));
        current_li.appendChild(this.Helpers.create_element('strong', { text_content: current_version }));
        versions_ul.appendChild(current_li);

        const new_li = this.Helpers.create_element('li');
        new_li.appendChild(document.createTextNode(t('update_rulefile_version_new_prefix')));
        new_li.appendChild(this.Helpers.create_element('strong', { text_content: new_version }));
        versions_ul.appendChild(new_li);
        this.plate_element_ref.appendChild(versions_ul);

        if (this._analysis_ready && this.staged_analysis_report) {
            const report = this.staged_analysis_report;
            const counts_ul = this.Helpers.create_element('ul', { class_name: 'change-count-list' });
            counts_ul.appendChild(this.Helpers.create_element('li', { text_content: t('update_rulefile_count_added', { count: (report.added_requirements || []).length }) }));
            counts_ul.appendChild(this.Helpers.create_element('li', { text_content: t('update_rulefile_count_updated', { count: (report.updated_requirements || []).length }) }));
            counts_ul.appendChild(this.Helpers.create_element('li', { text_content: t('update_rulefile_count_removed', { count: (report.removed_requirements || []).length }) }));
            this.plate_element_ref.appendChild(counts_ul);
        }

        this.plate_element_ref.appendChild(this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: t('update_rulefile_step2_confirm_notice') }));

        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: { 'margin-top': '2rem' } });
        if (this._loading_server_rule) {
            const loading_p = this.Helpers.create_element('p', {
                class_name: 'update-rulefile-loading',
                text_content: t('update_rulefile_loading_server'),
                attributes: { 'aria-live': 'polite' }
            });
            actions_div.appendChild(loading_p);
        } else {
            if (this._analysis_ready) {
                const review_report_button = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('update_rulefile_review_report')
                });
                review_report_button.addEventListener('click', () => this.handle_go_to_confirm_step_click());

                const analyze_again_button = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    text_content: t('update_rulefile_analyze_again')
                });
                analyze_again_button.addEventListener('click', () => this.handle_use_rule_from_server_click());

                actions_div.append(review_report_button, analyze_again_button);
            } else {
                const use_server_button = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    html_content: `<span>${t('update_rulefile_use_from_server')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('upload_file') : '')
                });
                use_server_button.addEventListener('click', () => this.handle_use_rule_from_server_click());
                actions_div.appendChild(use_server_button);
            }
        }

        this.plate_element_ref.appendChild(actions_div);
    },

    render_confirm_step(report) {
        const t = this.get_t_internally();
        const old_reqs = this.getState().ruleFileContent.requirements;

        const confirm_intro = this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: t('update_rulefile_confirm_intro') });
        confirm_intro.setAttribute('aria-live', 'polite');
        this.plate_element_ref.appendChild(confirm_intro);

        const new_reqs = this.staged_new_rule_file_content?.requirements || {};
        const render_report_section = (title_key, items, use_old_reqs = true) => {
            const section = this.Helpers.create_element('div', { class_name: 'report-section' });
            section.appendChild(this.Helpers.create_element('h3', { text_content: `${t(title_key)} (${items.length})` }));
            if (items.length > 0) {
                const ul = this.Helpers.create_element('ul', { class_name: 'report-list' });
                items.forEach(item => {
                    const ref_source = use_old_reqs ? old_reqs[item.id] : new_reqs[item.id];
                    const ref_text = ref_source?.standardReference?.text;
                    let display_text = item.title || item.id;
                    if (ref_text) {
                        display_text += ` (${ref_text})`;
                    }
                    ul.appendChild(this.Helpers.create_element('li', { text_content: this.Helpers.escape_html(display_text) }));
                });
                section.appendChild(ul);
            } else {
                section.appendChild(this.Helpers.create_element('p', { class_name: 'text-muted', text_content: t('no_items_in_category') }));
            }
            return section;
        };

        this.plate_element_ref.appendChild(render_report_section('update_report_updated_reqs_title', report.updated_requirements || []));
        this.plate_element_ref.appendChild(render_report_section('update_report_removed_reqs_title', report.removed_requirements || []));
        this.plate_element_ref.appendChild(render_report_section('update_report_added_reqs_title', report.added_requirements || [], false));

        const confirm_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-success'],
            html_content: `<span>${t('update_rulefile_confirm_button')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('check_circle') : '')
        });
        confirm_button.addEventListener('click', () => this.handle_confirm_update_click());

        const cancel_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            text_content: t('update_rulefile_continue_with_old')
        });
        cancel_button.addEventListener('click', () => this.router('audit_overview'));
        
        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: { 'margin-top': '2rem' } });
        
        actions_div.append(confirm_button, cancel_button);
        this.plate_element_ref.appendChild(actions_div);
    },

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.plate_element_ref = null;
        this.current_step = this.VIEW_STEPS.WARNING;
        this.staged_analysis_report = null;
        this.staged_new_rule_file_content = null;
        this._loading_server_rule = false;
        this._backup_saved = false;
        this._analysis_ready = false;
        this.root = null;
        this.deps = null;
    }
};
