import { SampleListComponent } from './SampleListComponent.js';

export const SampleManagementViewComponent = {
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
        
        this.CSS_PATH = 'css/components/sample_management_view_component.css';
        
        // Internal references
        this.sample_list_component_instance = SampleListComponent;
        this.sample_list_container_element = null;
        this.plate_element_ref = null;
        this.previously_focused_element = null;

        // Bind methods
        this.handle_edit_sample_request_from_list = this.handle_edit_sample_request_from_list.bind(this);
        this.handle_delete_sample_request_from_list = this.handle_delete_sample_request_from_list.bind(this);
        this.handle_start_audit = this.handle_start_audit.bind(this);
        
        // Initialize sub-components and CSS
        this.init_sub_components();
        if (this.Helpers && this.Helpers.load_css) {
            this.Helpers.load_css(this.CSS_PATH).catch(e => console.warn(e));
        }
    },

    async init_sub_components() {
        this.sample_list_container_element = this.Helpers.create_element('div', { id: 'sample-list-area-smv' });

        await this.sample_list_component_instance.init({
            root: this.sample_list_container_element,
            deps: {
                ...this.deps,
                on_edit: this.handle_edit_sample_request_from_list,
                on_delete: this.handle_delete_sample_request_from_list
            }
        });
    },

    handle_edit_sample_request_from_list(sample_id) {
        this.router('sample_form', { editSampleId: sample_id });
    },

    handle_delete_sample_request_from_list(sample_id) {
        const t = this.Translation.t;
        const current_state = this.getState();
        if (current_state.samples.length <= 1) {
            this.NotificationComponent.show_global_message(t('error_cannot_delete_last_sample'), "warning");
            return;
        }

        const sample_to_delete = current_state.samples.find(s => s.id === sample_id);
        const sample_name = this.Helpers.escape_html(sample_to_delete.description);
        this.previously_focused_element = document.activeElement;

        if (confirm(t('confirm_delete_sample', { sampleName: sample_name }))) {
            this.dispatch({ type: this.StoreActionTypes.DELETE_SAMPLE, payload: { sampleId: sample_id } });
            // State update triggers re-render via subscription in main.js
        } else {
            if (this.previously_focused_element) {
                this.previously_focused_element.focus();
            }
        }
    },

    handle_start_audit() {
        this.dispatch({ type: this.StoreActionTypes.SET_AUDIT_STATUS, payload: { status: 'in_progress' } });
        this.router('audit_overview');
    },

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        const current_state = this.getState();

        // If we don't have the plate yet or it's been removed from DOM
        if (!this.plate_element_ref || !this.root.contains(this.plate_element_ref)) {
            this.root.innerHTML = '';
            this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate sample-management-view-plate' });
            this.root.appendChild(this.plate_element_ref);
        }
        
        this.plate_element_ref.innerHTML = ''; 

        if (this.NotificationComponent.get_global_message_element_reference) {
            const global_message_element_ref = this.NotificationComponent.get_global_message_element_reference();
            this.plate_element_ref.appendChild(global_message_element_ref);
        }

        this.plate_element_ref.appendChild(this.Helpers.create_element('h1', {
            text_content: t('sample_management_title_with_count', { count: current_state.samples?.length || 0 })
        }));
        this.plate_element_ref.appendChild(this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: t('add_samples_intro_message') }));
        
        const top_actions_div = this.Helpers.create_element('div', { class_name: 'sample-management-actions' });
        const add_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            html_content: `<span>${t('add_new_sample')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('add') : '')
        });
        
        add_button.addEventListener('click', () => {
            this.router('sample_form');
        });
        top_actions_div.appendChild(add_button);
        this.plate_element_ref.appendChild(top_actions_div);

        // Always render list
        this.sample_list_component_instance.render();
        this.plate_element_ref.appendChild(this.sample_list_container_element);
        
        // Render bottom actions (endast vid första flödet: ny granskning som ännu inte påbörjats)
        if (current_state.auditStatus === 'not_started') {
            const bottom_actions_div = this.Helpers.create_element('div', { class_name: ['form-actions', 'space-between-groups'], style: 'margin-top: 2rem; width: 100%;' });
            
            const left_group_bottom = this.Helpers.create_element('div', { class_name: 'action-group-left' });
            const back_to_metadata_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                html_content: `<span>${t('back_to_metadata')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('arrow_back') : '')
            });
            back_to_metadata_btn.addEventListener('click', () => this.router('metadata'));
            left_group_bottom.appendChild(back_to_metadata_btn);
            bottom_actions_div.appendChild(left_group_bottom);

            if (current_state.samples.length > 0) {
                const right_group_bottom = this.Helpers.create_element('div', { class_name: 'action-group-right' });
                const start_audit_button = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-success'],
                    html_content: `<span>${t('start_audit')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('check_circle') : '')
                });
                start_audit_button.addEventListener('click', this.handle_start_audit);
                right_group_bottom.appendChild(start_audit_button);
                bottom_actions_div.appendChild(right_group_bottom);
            }
            this.plate_element_ref.appendChild(bottom_actions_div);
        }
    },

    destroy() {
        if (this.sample_list_component_instance && this.sample_list_component_instance.destroy) {
            this.sample_list_component_instance.destroy();
        }
        this.root = null;
        this.plate_element_ref = null;
        this.previously_focused_element = null;
        this.deps = null;
    }
};
