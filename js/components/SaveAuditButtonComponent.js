import './save_audit_button_component.css';
import { create_file_download_button } from '../utils/file_download_button_ui.js';
import { is_download_file_too_large_error } from '../utils/download_filename_utils.js';

export class SaveAuditButtonComponent {
    constructor() {        this.root = null;
        this.deps = null;
        this.Helpers = null;
        this.Translation = null;
        this.getState = null;
        this.SaveAuditLogic = null;
        this.NotificationComponent = null;
    }

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;
        this.getState = deps.getState;
        this.SaveAuditLogic = deps.SaveAuditLogic;
        this.NotificationComponent = deps.NotificationComponent;

            }

    async _run_save_download() {
        if (!this.getState || !this.SaveAuditLogic || !this.Translation || !this.NotificationComponent) {
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn("[SaveAuditButtonComponent] Dependencies not initialized for handle_save_click.");
            if (this.NotificationComponent && this.Translation) {
                this.NotificationComponent.show_global_message(this.Translation.t('error_saving_audit'), 'error');
            }
            throw new Error('save_audit_deps_missing');
        }

        const t = this.Translation.t;
        const current_audit_data = this.getState();

        if (!current_audit_data) {
            this.NotificationComponent.show_global_message(t('no_audit_data_to_save'), 'error');
            throw new Error('no_audit_data');
        }

        if (typeof this.SaveAuditLogic.save_audit_to_json_file === 'function') {
            const show_msg = (msg, type) => this.NotificationComponent?.show_global_message?.(msg, type);
            try {
                await this.SaveAuditLogic.save_audit_to_json_file(current_audit_data, t, show_msg);
            } catch (err) {
                if (is_download_file_too_large_error(err)) {
                    throw err;
                }
                show_msg(t('error_internal'), 'error');
                throw new Error('save_audit_failed');
            }
        } else {
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn("[SaveAuditButtonComponent] SaveAuditLogic.save_audit_to_json_file is not a function");
            throw new Error('save_audit_fn_missing');
        }
    }

    render() {
        if (!this.root || !this.deps || !this.Helpers || !this.Translation) {
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn("[SaveAuditButtonComponent] Container or core render dependencies missing.");
            return;
        }

        const t = this.Translation.t;

        this.root.innerHTML = '';

        const parts = create_file_download_button({
            Helpers: this.Helpers,
            label: t('save_audit_to_file'),
            t,
            variant: 'button-primary',
            icon_name: 'save',
            icon_size: 18,
            omit_small: true,
            extra_class_names: [],
            on_download: () => this._run_save_download(),
        });

        this.root.appendChild(parts.wrapper);
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
