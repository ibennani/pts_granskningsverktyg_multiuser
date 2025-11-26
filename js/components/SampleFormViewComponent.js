import { AddSampleFormComponent } from './AddSampleFormComponent.js';

export const SampleFormViewComponent = {
    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.params = deps.params;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.AuditLogic = deps.AuditLogic; // Ensure this is passed from main.js if needed by AddSampleFormComponent

        this.add_sample_form_container_element = null;
        this.plate_element_ref = null;
        this.add_sample_form_component_instance = AddSampleFormComponent;

        // Initialize child component container
        this.add_sample_form_container_element = this.Helpers.create_element('div', { id: 'add-sample-form-area-in-view' });
        
        // Initialize child component
        await this.add_sample_form_component_instance.init({
            root: this.add_sample_form_container_element,
            deps: {
                on_sample_saved: this.on_form_saved_or_updated.bind(this),
                discard: this.discard_and_return.bind(this),
                router: this.router,
                getState: this.getState,
                dispatch: this.dispatch,
                StoreActionTypes: this.StoreActionTypes,
                Translation: this.Translation,
                Helpers: this.Helpers,
                NotificationComponent: this.NotificationComponent,
                AuditLogic: this.AuditLogic
            }
        });
    },

    on_form_saved_or_updated() {
        const current_state = this.getState();
        const previous_view = (current_state.auditStatus === 'not_started') ? 'sample_management' : 'audit_overview';
        this.router(previous_view);
    },
    
    discard_and_return() {
        const current_state = this.getState();
        const previous_view = (current_state.auditStatus === 'not_started') ? 'sample_management' : 'audit_overview';
        this.router(previous_view);
    },

    render() {
        const t = this.Translation.t;
        const sample_id_to_edit = this.params?.editSampleId || null;
        const current_state = this.getState();
        const audit_status = current_state.auditStatus;

        this.root.innerHTML = '';
        this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate' });
        this.root.appendChild(this.plate_element_ref);

        const global_message_element = this.NotificationComponent.get_global_message_element_reference();
        if (global_message_element) {
            this.plate_element_ref.appendChild(global_message_element);
        }

        const title_text = sample_id_to_edit ? t('edit_sample') : t('add_new_sample');
        this.plate_element_ref.appendChild(this.Helpers.create_element('h1', { text_content: title_text }));
        
        const intro_text_key = (audit_status === 'not_started') ? 'add_samples_intro_message' : 'add_sample_form_new_intro';
        this.plate_element_ref.appendChild(this.Helpers.create_element('p', { 
            class_name: 'view-intro-text', 
            text_content: t(intro_text_key) 
        }));

        // Rendera formulärkomponenten inuti vår nya vy
        this.add_sample_form_component_instance.render(sample_id_to_edit);
        this.plate_element_ref.appendChild(this.add_sample_form_container_element);

        // Lägg till en nedre navigationsrad med "Tillbaka"-knapp
        const bottom_actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: 'margin-top: 2rem; justify-content: flex-start;' });
        
        const return_button_text_key = (audit_status === 'not_started') ? 'back_to_sample_management' : 'back_to_audit_overview';
        
        const return_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            html_content: `<span>${t(return_button_text_key)}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('arrow_back') : '')
        });
        return_button.addEventListener('click', this.discard_and_return.bind(this));
        bottom_actions_div.appendChild(return_button);
        this.plate_element_ref.appendChild(bottom_actions_div);
    },

    destroy() {
        if (this.add_sample_form_component_instance?.destroy) {
            this.add_sample_form_component_instance.destroy();
        }
        this.root.innerHTML = '';
        this.plate_element_ref = null;
        this.root = null;
        this.deps = null;
    }
};
