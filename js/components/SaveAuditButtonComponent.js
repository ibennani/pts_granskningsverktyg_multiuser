export class SaveAuditButtonComponent {
    constructor() {
        this.CSS_PATH = 'css/components/save_audit_button_component.css';
        this.root = null;
        this.deps = null;
        this.Helpers = null;
        this.Translation = null;
        this.getState = null;
        this.SaveAuditLogic = null;
        this.NotificationComponent = null;

        this.handle_save_click = this.handle_save_click.bind(this);
    }

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;
        this.getState = deps.getState;
        this.SaveAuditLogic = deps.SaveAuditLogic;
        this.NotificationComponent = deps.NotificationComponent;

        if (this.Helpers && this.Helpers.load_css) {
            try {
                const link_tag = document.querySelector(`link[href="${this.CSS_PATH}"]`);
                if (!link_tag) await this.Helpers.load_css(this.CSS_PATH);
            } catch (error) {
                console.warn("Failed to load CSS for SaveAuditButtonComponent:", error);
            }
        }
    }

    handle_save_click() {
        if (!this.getState || !this.SaveAuditLogic || !this.Translation || !this.NotificationComponent) {
            console.error("[SaveAuditButtonComponent] Dependencies not initialized for handle_save_click.");
            if (this.NotificationComponent && this.Translation) {
                 this.NotificationComponent.show_global_message(this.Translation.t('error_saving_audit'), 'error');
            }
            return;
        }

        const t = this.Translation.t;
        const current_audit_data = this.getState();
        
        if (!current_audit_data) {
            this.NotificationComponent.show_global_message(t('no_audit_data_to_save'), 'error');
            return;
        }
        
        if (typeof this.SaveAuditLogic.save_audit_to_json_file === 'function') {
             const show_msg = (msg, type) => this.NotificationComponent?.show_global_message?.(msg, type);
             this.SaveAuditLogic.save_audit_to_json_file(current_audit_data, t, show_msg);
        } else {
             console.error("[SaveAuditButtonComponent] SaveAuditLogic.save_audit_to_json_file is not a function");
        }
    }

    render() {
        if (!this.root || !this.deps || !this.Helpers || !this.Translation) {
            console.error("[SaveAuditButtonComponent] Container or core render dependencies missing.");
            return;
        }
        
        const t = this.Translation.t;
        
        this.root.innerHTML = '';

        const button_element = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            html_content: `<span class="button-text">${t('save_audit_to_file')}</span>` +
                          (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('save', ['currentColor'], 18) : '')
        });
        button_element.addEventListener('click', this.handle_save_click);
        this.root.appendChild(button_element);
    }

    destroy() {
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
        this.Helpers = null;
        this.Translation = null;
        this.getState = null;
        this.SaveAuditLogic = null;
        this.NotificationComponent = null;
    }
}
