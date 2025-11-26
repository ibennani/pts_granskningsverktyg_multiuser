export const SaveAuditButtonComponent = function () {
    'use-strict';

    const CSS_PATH = 'css/components/save_audit_button_component.css';
    let root = null;
    let deps = null;

    async function init({ root: _root, deps: _deps }) {
        root = _root;
        deps = _deps;

        if (deps.Helpers && deps.Helpers.load_css) {
            try {
                const link_tag = document.querySelector(`link[href="${CSS_PATH}"]`);
                if (!link_tag) await deps.Helpers.load_css(CSS_PATH);
            } catch (error) {
                console.warn("Failed to load CSS for SaveAuditButtonComponent:", error);
            }
        }
    }

    function handle_save_click() {
        const { getState, SaveAuditLogic, Translation, NotificationComponent } = deps;
        const t = Translation.t;

        if (!getState || !SaveAuditLogic || !t || !NotificationComponent) {
            console.error("[SaveAuditButtonComponent] Dependencies not initialized for handle_save_click.");
            if (NotificationComponent && t) {
                 NotificationComponent.show_global_message(t('error_saving_audit'), 'error');
            }
            return;
        }

        const current_audit_data = getState();
        if (!current_audit_data) {
            NotificationComponent.show_global_message(t('no_audit_data_to_save'), 'error');
            return;
        }
        
        // SaveAuditLogic.save_audit_to_json_file(current_audit_data, t, show_notification_function_ref);
        // We need to check the signature of save_audit_to_json_file. 
        // Based on previous file, it was passed as dependency `save_audit_function_ref`.
        // Previous call: save_audit_function_ref(current_audit_data, t_function_ref, show_notification_function_ref);
        
        if (typeof SaveAuditLogic.save_audit_to_json_file === 'function') {
             SaveAuditLogic.save_audit_to_json_file(current_audit_data, t, NotificationComponent.show_global_message);
        } else {
             console.error("[SaveAuditButtonComponent] SaveAuditLogic.save_audit_to_json_file is not a function");
        }
    }

    function render() {
        if (!root || !deps || !deps.Helpers || !deps.Translation) {
            console.error("[SaveAuditButtonComponent] Container or core render dependencies missing.");
            return;
        }
        
        const { Helpers, Translation } = deps;
        const t = Translation.t;
        
        root.innerHTML = '';

        const button_element = Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            html_content: `<span class="button-text">${t('save_audit_to_file')}</span>` +
                          (Helpers.get_icon_svg ? Helpers.get_icon_svg('save', ['currentColor'], 18) : '')
        });
        button_element.addEventListener('click', handle_save_click);
        root.appendChild(button_element);
    }

    function destroy() {
        if (root) {
            root.innerHTML = '';
        }
        root = null;
        deps = null;
    }

    return {
        init,
        render,
        destroy
    };
};
