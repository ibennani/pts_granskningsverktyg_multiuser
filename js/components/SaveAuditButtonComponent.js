// js/components/SaveAuditButtonComponent.js
export const SaveAuditButtonComponentFactory = function () { // Ändrad till en factory-funktion
    'use-strict';

    const CSS_PATH = 'css/components/save_audit_button_component.css'; // Valfri
    let container_ref;
    let button_element;

    // Funktioner som skickas in vid init
    let getState_callback;
    let save_audit_function_ref;
    let t_function_ref;
    let show_notification_function_ref;
    let helpers_create_element_ref;
    let helpers_get_icon_svg_ref;
    let helpers_load_css_ref;

    async function init(
        _container,
        _getState_cb,
        _save_audit_func,
        _t_func,
        _show_notification_func,
        _helpers_create_element,
        _helpers_get_icon_svg,
        _helpers_load_css
    ) {
        container_ref = _container;
        getState_callback = _getState_cb;
        save_audit_function_ref = _save_audit_func;
        t_function_ref = _t_func;
        show_notification_function_ref = _show_notification_func;
        helpers_create_element_ref = _helpers_create_element;
        helpers_get_icon_svg_ref = _helpers_get_icon_svg;
        helpers_load_css_ref = _helpers_load_css;

        if (helpers_load_css_ref && CSS_PATH) {
            try {
                const link_tag = document.querySelector(`link[href="${CSS_PATH}"]`);
                if (!link_tag) await helpers_load_css_ref(CSS_PATH);
            } catch (error) {
                console.warn("Failed to load CSS for SaveAuditButtonComponent:", error);
            }
        }
    }

    function handle_save_click() {
        if (!getState_callback || !save_audit_function_ref || !t_function_ref || !show_notification_function_ref) {
            console.error("[SaveAuditButtonComponent] Dependencies not initialized for handle_save_click.");
            if (show_notification_function_ref && t_function_ref) {
                 show_notification_function_ref(t_function_ref('error_saving_audit'), 'error');
            }
            return;
        }

        const current_audit_data = getState_callback();
        if (!current_audit_data) {
            show_notification_function_ref(t_function_ref('no_audit_data_to_save'), 'error');
            return;
        }
        save_audit_function_ref(current_audit_data, t_function_ref, show_notification_function_ref);
    }

    function render() {
        if (!container_ref || !helpers_create_element_ref || !t_function_ref) {
            console.error("[SaveAuditButtonComponent] Container or core render dependencies missing.");
            return;
        }
        container_ref.innerHTML = ''; // Rensa container

        button_element = helpers_create_element_ref('button', {
            class_name: ['button', 'button-primary'], // Primär knapp för huvudåtgärd
            html_content: `<span class="button-text">${t_function_ref('save_audit_to_file')}</span>` +
                          (helpers_get_icon_svg_ref ? helpers_get_icon_svg_ref('save', ['currentColor'], 18) : '')
        });
        button_element.addEventListener('click', handle_save_click);
        container_ref.appendChild(button_element);
    }

    function destroy() {
        if (button_element) {
            button_element.removeEventListener('click', handle_save_click);
            button_element = null;
        }
        container_ref = null;
        // Nollställ callbacks om nödvändigt för minneshantering
        getState_callback = null;
        save_audit_function_ref = null;
        t_function_ref = null;
        show_notification_function_ref = null;
        helpers_create_element_ref = null;
        helpers_get_icon_svg_ref = null;
        helpers_load_css_ref = null;
    }

    // Returnera ett objekt med metoderna, unikt för denna instans
    return {
        init,
        render,
        destroy
    };
};