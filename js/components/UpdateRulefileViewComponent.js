// js/components/UpdateRulefileViewComponent.js

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

        this.current_step = this.VIEW_STEPS.WARNING;
        this.staged_new_rule_file_content = null;
        this.staged_analysis_report = null;
        this.plate_element_ref = null;

        if (this.Helpers?.load_css && this.CSS_PATH) {
            try {
                const link_tag = document.querySelector(`link[href="${this.CSS_PATH}"]`);
                if (!link_tag) {
                    await this.Helpers.load_css(this.CSS_PATH);
                }
            } catch (error) {
                console.warn("CSS for UpdateRulefileViewComponent not found yet, skipping load.", error);
            }
        }
    },

    get_t_internally() {
        return this.Translation?.t || ((key) => `**${key}**`);
    },

    handle_backup_click() {
        const t = this.get_t_internally();
        if (this.SaveAuditLogic?.save_audit_to_json_file) {
            this.SaveAuditLogic.save_audit_to_json_file(this.getState(), t, this.NotificationComponent?.show_global_message);
            this.current_step = this.VIEW_STEPS.UPLOAD;
            this.render();
        } else {
            console.error("SaveAuditLogic not available to perform backup.");
            if (this.NotificationComponent?.show_global_message) {
                this.NotificationComponent.show_global_message(t('error_saving_audit'), 'error');
            }
        }
    },

    handle_new_rule_file_upload(event) {
        const t = this.get_t_internally();
        const file = event.target.files[0];
        if (!file) return;
        
        if (!window.RulefileUpdaterLogic) {
            console.error("CRITICAL: RulefileUpdaterLogic is not available on the window object.");
            this.NotificationComponent?.show_global_message(t('error_internal_reload'), 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const new_rule_content = JSON.parse(e.target.result);
                // Assuming ValidationLogic is available globally as in original code
                const validation = window.ValidationLogic?.validate_rule_file_json(new_rule_content);

                if (validation && !validation.isValid) {
                    this.NotificationComponent?.show_global_message(validation.message, 'error');
                    return;
                }

                const report = window.RulefileUpdaterLogic.analyze_rule_file_changes(this.getState(), new_rule_content);
                this.staged_analysis_report = report;
                this.staged_new_rule_file_content = new_rule_content;

                this.current_step = this.VIEW_STEPS.CONFIRM;
                this.render();

            } catch (error) {
                const t = this.get_t_internally();
                const errorMsg = t('error_rulefile_update_failed');
                console.error(`${errorMsg}:`, error);
                this.NotificationComponent?.show_global_message(
                    t('rule_file_invalid_json_with_detail', { errorMessage: error.message }),
                    'error'
                );
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
    },
    
    handle_confirm_update_click() {
        const t = this.get_t_internally();
        if (!this.staged_new_rule_file_content || !this.staged_analysis_report) {
            const errorMsg = t('error_confirm_failed_temp_data_missing');
            console.error(errorMsg);
            this.NotificationComponent?.show_global_message(t('error_internal'), 'error');
            return;
        }

        const final_reconciled_state = window.RulefileUpdaterLogic.apply_rule_file_update(
            this.getState(),
            this.staged_new_rule_file_content,
            this.staged_analysis_report
        );
        
        this.dispatch({
            type: this.StoreActionTypes.REPLACE_RULEFILE_AND_RECONCILE,
            payload: final_reconciled_state
        });

        this.NotificationComponent?.show_global_message(t('update_rulefile_success'), 'success');
        this.router('audit_overview');
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
        
        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: { 'margin-top': '2rem' } });
        actions_div.append(backup_button);
        this.plate_element_ref.appendChild(actions_div);
    },
    
    render_upload_step() {
        const t = this.get_t_internally();
        
        this.plate_element_ref.appendChild(this.Helpers.create_element('div', {
            class_name: 'backup-confirmation',
            html_content: (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('check_circle') : '✔') + ` <span>${t('update_rulefile_backup_saved')}</span>`
        }));
        
        this.plate_element_ref.appendChild(this.Helpers.create_element('h2', { style: { 'font-size': '1.2rem', 'margin-top': '1.5rem' }, text_content: t('update_rulefile_step2_title') }));
        this.plate_element_ref.appendChild(this.Helpers.create_element('p', { text_content: t('update_rulefile_step2_text') }));

        const file_input = this.Helpers.create_element('input', { id: 'new-rule-file-input', attributes: { type: 'file', accept: '.json', style: 'display: none;' } });
        file_input.addEventListener('change', (e) => this.handle_new_rule_file_upload(e));

        const upload_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            html_content: `<span>${t('upload_new_rulefile_btn')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('upload_file') : '')
        });
        upload_button.addEventListener('click', () => file_input.click());
        
        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: { 'margin-top': '2rem' } });
        actions_div.appendChild(upload_button);
        
        this.plate_element_ref.appendChild(file_input);
        this.plate_element_ref.appendChild(actions_div);
    },

    render_confirm_step(report) {
        const t = this.get_t_internally();
        const old_reqs = this.getState().ruleFileContent.requirements;

        this.plate_element_ref.appendChild(this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: t('update_rulefile_confirm_intro') }));

        const render_report_section = (title_key, items) => {
            const section = this.Helpers.create_element('div', { class_name: 'report-section' });
            section.appendChild(this.Helpers.create_element('h3', { text_content: `${t(title_key)} (${items.length})` }));
            if (items.length > 0) {
                const ul = this.Helpers.create_element('ul', { class_name: 'report-list' });
                items.forEach(item => {
                    const old_req_def = old_reqs[item.id];
                    const ref_text = old_req_def?.standardReference?.text;
                    
                    let display_text = item.title;
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
        
        this.plate_element_ref.appendChild(render_report_section('update_report_updated_reqs_title', report.updated_requirements));
        this.plate_element_ref.appendChild(render_report_section('update_report_removed_reqs_title', report.removed_requirements));

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
        this.root = null;
        this.deps = null;
    }
};
