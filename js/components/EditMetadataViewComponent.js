// js/components/EditMetadataViewComponent.js
import { MetadataFormComponent } from './MetadataFormComponent.js';

export const EditMetadataViewComponent = (function () {
    'use-strict';

    let app_container_ref;
    let router_ref;
    
    // Dependencies from main.js
    let local_getState;
    let local_dispatch;
    let local_StoreActionTypes;
    let Translation_t;
    let Helpers_create_element;
    let NotificationComponent_show_global_message;
    let NotificationComponent_get_global_message_element_reference;

    // Sub-component and its container
    let metadata_form_component_instance;
    let metadata_form_container_element;

    function assign_globals_once() {
        if (Translation_t) return;
        Translation_t = window.Translation?.t;
        Helpers_create_element = window.Helpers?.create_element;
        NotificationComponent_show_global_message = window.NotificationComponent?.show_global_message;
        NotificationComponent_get_global_message_element_reference = window.NotificationComponent?.get_global_message_element_reference;
    }

    async function init(_app_container, _router_cb, _params, _getState, _dispatch, _StoreActionTypes) {
        assign_globals_once();
        app_container_ref = _app_container;
        router_ref = _router_cb;
        local_getState = _getState;
        local_dispatch = _dispatch;
        local_StoreActionTypes = _StoreActionTypes;

        metadata_form_container_element = Helpers_create_element('div', { id: 'metadata-form-container-in-view' });

        metadata_form_component_instance = MetadataFormComponent;
        await metadata_form_component_instance.init(metadata_form_container_element, {
            onSubmit: handle_form_submit,
            onCancel: handle_cancel,
            onAutosave: handle_autosave
        });
    }

    function handle_autosave(form_data) {
        // Spara metadata automatiskt utan att navigera
        local_dispatch({
            type: local_StoreActionTypes.UPDATE_METADATA,
            payload: form_data
        });
    }

    function handle_form_submit(form_data) {
        local_dispatch({
            type: local_StoreActionTypes.UPDATE_METADATA,
            payload: form_data
        });
        
        const current_status = local_getState().auditStatus;
        
        if (current_status === 'not_started') {
            NotificationComponent_show_global_message(Translation_t('metadata_form_intro'), 'info'); // Behåll info för nästa vy
            router_ref('sample_management');
        } else {
            NotificationComponent_show_global_message(Translation_t('metadata_updated_successfully'), 'success');
            router_ref('audit_overview');
        }
    }

    function handle_cancel() {
        // Cancel är bara tillgängligt i "edit mode", så vi skickar alltid tillbaka till översikten
        router_ref('audit_overview');
    }

    function render() {
        app_container_ref.innerHTML = '';
        const t = Translation_t;
        const current_state = local_getState();
        const is_new_audit = current_state.auditStatus === 'not_started';

        // Skyddsnät: Om ingen granskning finns, skicka till start.
        if (!current_state.ruleFileContent) {
            router_ref('upload');
            return;
        }

        const plate_element = Helpers_create_element('div', { class_name: 'content-plate metadata-form-plate' });
        
        const global_message_element = NotificationComponent_get_global_message_element_reference();
        if (global_message_element) {
            plate_element.appendChild(global_message_element);
        }
        
        if (is_new_audit) {
            NotificationComponent_show_global_message(t('metadata_form_intro'), "info");
        }

        const title = is_new_audit ? t('audit_metadata_title') : t('edit_audit_metadata_title');
        const intro_text = is_new_audit ? t('metadata_form_instruction') : t('edit_metadata_form_instruction');
        
        plate_element.appendChild(Helpers_create_element('h1', { text_content: title }));
        plate_element.appendChild(Helpers_create_element('p', { class_name: 'view-intro-text', text_content: intro_text }));
        
        // Sätt dynamiska alternativ baserat på granskningsstatus
        const form_options = {
            initialData: current_state.auditMetadata,
            submitButtonText: is_new_audit ? t('continue_to_samples') : t('save_changes_button'),
            cancelButtonText: is_new_audit ? null : t('return_without_saving_button_text')
        };
        
        metadata_form_component_instance.render(form_options);
        
        plate_element.appendChild(metadata_form_container_element);
        app_container_ref.appendChild(plate_element);
    }

    function destroy() {
        if (metadata_form_component_instance?.destroy) {
            metadata_form_component_instance.destroy();
        }
        app_container_ref.innerHTML = '';
    }

    return {
        init,
        render,
        destroy
    };
})();