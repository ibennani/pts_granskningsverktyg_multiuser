export const ConfirmSampleEditViewComponent = {
    init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        
        this.plate_element_ref = null;
    },

    handle_confirm_and_save() {
        const t = this.Translation.t;
        const pending_changes = this.getState().pendingSampleChanges;
        if (!pending_changes) {
            this.NotificationComponent.show_global_message(t('error_no_pending_sample_changes'), 'error');
            this.router('audit_overview'); // Fallback
            return;
        }

        this.dispatch({ 
            type: this.StoreActionTypes.UPDATE_SAMPLE, 
            payload: { 
                sampleId: pending_changes.sampleId, 
                updatedSampleData: pending_changes.updatedSampleData
            } 
        });

        this.dispatch({ type: this.StoreActionTypes.CLEAR_STAGED_SAMPLE_CHANGES });
        
        this.NotificationComponent.show_global_message(t('sample_updated_successfully'), "success");
        
        const current_state = this.getState();
        const return_view = (current_state.auditStatus === 'not_started') ? 'sample_management' : 'audit_overview';
        this.router(return_view);
    },

    handle_discard_and_return() {
        this.dispatch({ type: this.StoreActionTypes.CLEAR_STAGED_SAMPLE_CHANGES });
        
        const current_state = this.getState();
        const return_view = (current_state.auditStatus === 'not_started') ? 'sample_management' : 'audit_overview';
        this.router(return_view);
    },

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        const current_state = this.getState();
        const pending_changes = current_state.pendingSampleChanges;

        this.root.innerHTML = '';
        this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate' });
        this.root.appendChild(this.plate_element_ref);

        const global_message_element = this.NotificationComponent.get_global_message_element_reference();
        if (global_message_element) {
            this.plate_element_ref.appendChild(global_message_element);
        }

        if (!pending_changes) {
            this.plate_element_ref.appendChild(this.Helpers.create_element('h1', { text_content: t('error_internal') }));
            this.plate_element_ref.appendChild(this.Helpers.create_element('p', { text_content: t('error_no_pending_sample_changes') }));
            const back_button = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                text_content: t('back_to_audit_overview')
            });
            back_button.addEventListener('click', () => this.router('audit_overview'));
            this.plate_element_ref.appendChild(back_button);
            return;
        }

        this.plate_element_ref.appendChild(this.Helpers.create_element('h1', { text_content: t('sample_edit_confirm_dialog_title') }));

        const { added_reqs, removed_reqs, data_will_be_lost } = pending_changes.analysis;
        const rule_file = current_state.ruleFileContent;

        const render_req_list = (req_ids) => {
            const ul = this.Helpers.create_element('ul', { class_name: 'report-list' });
            req_ids.forEach(id => {
                const req = rule_file.requirements[id];
                if (req) {
                    const ref_text = req.standardReference?.text ? ` (${req.standardReference.text})` : '';
                    ul.appendChild(this.Helpers.create_element('li', { text_content: `${req.title}${ref_text}` }));
                }
            });
            return ul;
        };

        if (added_reqs.length > 0) {
            const section = this.Helpers.create_element('div', { class_name: 'report-section' });
            section.appendChild(this.Helpers.create_element('h3', { text_content: t('sample_edit_confirm_added_reqs_header') }));
            section.appendChild(render_req_list(added_reqs));
            this.plate_element_ref.appendChild(section);
        }

        if (removed_reqs.length > 0) {
            const section = this.Helpers.create_element('div', { class_name: 'report-section' });
            section.appendChild(this.Helpers.create_element('h3', { text_content: t('sample_edit_confirm_removed_reqs_header') }));
            section.appendChild(render_req_list(removed_reqs));
            this.plate_element_ref.appendChild(section);
        }
        
        if (data_will_be_lost) {
            const warning_div = this.Helpers.create_element('div', { style: 'margin-top: 1rem; padding: 1rem; border: 2px solid var(--danger-color); border-radius: var(--border-radius); background-color: var(--danger-color-light);' });
            warning_div.appendChild(this.Helpers.create_element('h4', { 
                html_content: (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('warning', ['var(--danger-color)']) + ' ' : '') + t('sample_edit_confirm_data_loss_warning_header')
            }));
            warning_div.appendChild(this.Helpers.create_element('p', { text_content: t('sample_edit_confirm_data_loss_warning_text') }));
            this.plate_element_ref.appendChild(warning_div);
        }

        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: 'margin-top: 2rem;' });
        const confirm_btn = this.Helpers.create_element('button', { 
            class_name: ['button', 'button-primary'], 
            text_content: t('sample_edit_confirm_action_button') 
        });
        const discard_btn = this.Helpers.create_element('button', { 
            class_name: ['button', 'button-danger'], 
            text_content: t('sample_edit_discard_action_button') 
        });

        confirm_btn.addEventListener('click', this.handle_confirm_and_save.bind(this));
        discard_btn.addEventListener('click', this.handle_discard_and_return.bind(this));

        actions_div.append(confirm_btn, discard_btn);
        this.plate_element_ref.appendChild(actions_div);
    },

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
        this.plate_element_ref = null;
    }
};
