import { MetadataFormComponent } from './MetadataFormComponent.js';

export const EditMetadataViewComponent = {
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
        
        this.metadata_form_container_element = null;
        this.metadata_form_component_instance = MetadataFormComponent;

        this.handle_form_submit = this.handle_form_submit.bind(this);
        this.handle_cancel = this.handle_cancel.bind(this);
        this.handle_autosave = this.handle_autosave.bind(this);

        this.RETURN_FOCUS_SESSION_KEY = 'gv_return_focus_audit_info_h2_v1';
    },

    _request_focus_on_audit_info_h2() {
        // Instruktion: när användaren återgår från formuläret ska fokus hamna på
        // "Granskningsinformation" (h2) i föregående vy.
        try {
            if (window.sessionStorage) {
                window.sessionStorage.setItem(this.RETURN_FOCUS_SESSION_KEY, JSON.stringify({ focus: 'audit_info_h2' }));
            }
        } catch (e) {
            // Ignorera om sessionStorage inte är tillgängligt.
        }

        // Hindra generella "fokusera <h1>" i main.js från att skriva över.
        window.customFocusApplied = true;
    },

    handle_autosave(form_data) {
        this.dispatch({
            type: this.StoreActionTypes.UPDATE_METADATA,
            payload: form_data
        });
    },

    handle_form_submit(form_data) {
        this.dispatch({
            type: this.StoreActionTypes.UPDATE_METADATA,
            payload: form_data
        });
        
        const current_status = this.getState().auditStatus;
        
        if (current_status === 'not_started') {
            this.NotificationComponent.show_global_message(this.Translation.t('metadata_form_intro'), 'info');
            this.router('sample_management');
        } else {
            this.NotificationComponent.show_global_message(this.Translation.t('metadata_updated_successfully'), 'success');
            this._request_focus_on_audit_info_h2();
            this.router('audit_overview');
        }
    },

    handle_cancel() {
        this._request_focus_on_audit_info_h2();
        this.router('audit_overview');
    },

    async render() {
        if (!this.root) return;
        this.root.innerHTML = '';
        
        const t = this.Translation.t;
        const current_state = this.getState();
        const is_new_audit = current_state.auditStatus === 'not_started';

        if (!current_state.ruleFileContent) {
            this.router('upload');
            return;
        }

        const plate_element = this.Helpers.create_element('div', { class_name: 'content-plate metadata-form-plate' });
        
        const global_message_element = this.NotificationComponent.get_global_message_element_reference();
        if (global_message_element) {
            plate_element.appendChild(global_message_element);
        }
        
        if (is_new_audit) {
            this.NotificationComponent.show_global_message(t('metadata_form_intro'), "info");
        }

        const title = is_new_audit ? t('audit_metadata_title') : t('edit_audit_metadata_title');
        const intro_text = is_new_audit ? t('metadata_form_instruction') : t('edit_metadata_form_instruction');
        
        plate_element.appendChild(this.Helpers.create_element('h1', { text_content: title }));
        plate_element.appendChild(this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: intro_text }));
        
        this.metadata_form_container_element = this.Helpers.create_element('div', { id: 'metadata-form-container-in-view' });
        
        // Initialize sub-component with injected deps
        this.metadata_form_component_instance.init({
            root: this.metadata_form_container_element,
            deps: this.deps,
            options: {
                onSubmit: this.handle_form_submit,
                onCancel: this.handle_cancel,
                onAutosave: this.handle_autosave
            }
        });

        const form_options = {
            initialData: current_state.auditMetadata,
            submitButtonText: is_new_audit ? t('continue_to_samples') : t('save_changes_button'),
            cancelButtonText: is_new_audit ? null : t('return_without_saving_button_text')
        };
        
        this.metadata_form_component_instance.render(form_options);
        
        plate_element.appendChild(this.metadata_form_container_element);
        this.root.appendChild(plate_element);
    },

    destroy() {
        if (this.metadata_form_component_instance && this.metadata_form_component_instance.destroy) {
            this.metadata_form_component_instance.destroy();
        }
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
    }
};
