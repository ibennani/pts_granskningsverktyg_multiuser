// js/components/AdminViewComponent.js
import { migrate_rulefile_to_new_structure } from '../logic/rulefile_migration_logic.js';
import {
    check_api_available,
    get_rules,
    get_audits,
    import_rule,
    import_audit
} from '../api/client.js';

export const AdminViewComponent = {
    CSS_PATH: './css/components/admin_view_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.ValidationLogic = deps.ValidationLogic || window.ValidationLogic;

        this.rules = [];
        this.audits = [];
        this.api_available = false;
        this.rule_file_input = null;
        this.audit_file_input = null;

        this.handle_upload_rule_click = this.handle_upload_rule_click.bind(this);
        this.handle_upload_audit_click = this.handle_upload_audit_click.bind(this);
        this.handle_rule_file_select = this.handle_rule_file_select.bind(this);
        this.handle_audit_file_select = this.handle_audit_file_select.bind(this);
        this.handle_go_to_upload = this.handle_go_to_upload.bind(this);

        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH, 'AdminViewComponent', {
                timeout: 5000,
                maxRetries: 2
            }).catch(() => {
                console.warn('[AdminViewComponent] Continuing without CSS due to loading failure');
            });
        }
    },

    get_t_func() {
        return (this.Translation && typeof this.Translation.t === 'function')
            ? this.Translation.t
            : (key) => `**${key}**`;
    },

    async ensure_api_data() {
        this.api_available = await check_api_available();
        if (this.api_available) {
            try {
                this.rules = await get_rules();
                this.audits = await get_audits();
            } catch {
                this.rules = [];
                this.audits = [];
            }
        }
    },

    handle_upload_rule_click() {
        if (this.rule_file_input) {
            this.rule_file_input.click();
        }
    },

    handle_upload_audit_click() {
        if (this.audit_file_input) {
            this.audit_file_input.click();
        }
    },

    handle_rule_file_select(event) {
        const t = this.get_t_func();
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json_content = JSON.parse(e.target.result);
                const migrated_content = migrate_rulefile_to_new_structure(json_content, {
                    Translation: this.Translation
                });
                const validation_result = this.ValidationLogic?.validate_rule_file_json?.(migrated_content);

                if (!validation_result?.isValid) {
                    this.NotificationComponent?.show_global_message(
                        validation_result?.message || t('rule_file_invalid_json'),
                        'error'
                    );
                    return;
                }

                const name = file.name?.replace(/\.json$/i, '') || 'Importerad regelfil';
                await import_rule(name, migrated_content);
                this.NotificationComponent?.show_global_message(
                    t('admin_rule_uploaded_success'),
                    'success'
                );
                await this.ensure_api_data();
                this.render();
            } catch (error) {
                this.NotificationComponent?.show_global_message(
                    t('rule_file_invalid_json') + (error.message ? ` (${error.message})` : ''),
                    'error'
                );
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
    },

    handle_audit_file_select(event) {
        const t = this.get_t_func();
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const file_content_object = JSON.parse(e.target.result);
                if (file_content_object.ruleFileContent) {
                    file_content_object.ruleFileContent = migrate_rulefile_to_new_structure(
                        file_content_object.ruleFileContent,
                        { Translation: this.Translation }
                    );
                }
                const validation_result = this.ValidationLogic?.validate_saved_audit_file?.(file_content_object);

                if (!validation_result?.isValid) {
                    this.NotificationComponent?.show_global_message(
                        validation_result?.message || t('error_invalid_saved_audit_file'),
                        'error'
                    );
                    return;
                }

                await import_audit(file_content_object);
                this.NotificationComponent?.show_global_message(
                    t('admin_audit_uploaded_success'),
                    'success'
                );
                await this.ensure_api_data();
                this.render();
            } catch (error) {
                this.NotificationComponent?.show_global_message(
                    t('error_invalid_saved_audit_file') + (error.message ? ` (${error.message})` : ''),
                    'error'
                );
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
    },

    handle_go_to_upload() {
        this.router('upload');
    },

    render() {
        if (!this.root || !this.Helpers?.create_element) return;

        if (!this._api_checked) {
            this._api_checked = true;
            this.ensure_api_data().then(() => {
                if (this.root) this.render();
            });
            this.root.innerHTML = '';
            const t = this.get_t_func();
            const loading = this.Helpers.create_element('p', {
                text_content: t('admin_loading'),
                class_name: 'admin-loading'
            });
            this.root.appendChild(loading);
            return;
        }

        this.root.innerHTML = '';
        const t = this.get_t_func();

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate admin-plate' });

        if (this.NotificationComponent?.get_global_message_element_reference) {
            const msg_el = this.NotificationComponent.get_global_message_element_reference();
            plate.appendChild(msg_el);
        }

        const header = this.Helpers.create_element('div', { class_name: 'admin-header' });
        const title = this.Helpers.create_element('h1', { text_content: t('admin_title') });
        const back_link = this.Helpers.create_element('a', {
            href: '#upload',
            class_name: ['admin-back-link'],
            text_content: t('admin_back_to_start'),
            attributes: { 'aria-label': t('admin_back_to_start') }
        });
        back_link.addEventListener('click', (e) => {
            e.preventDefault();
            this.handle_go_to_upload();
        });
        header.appendChild(title);
        header.appendChild(back_link);
        plate.appendChild(header);

        if (!this.api_available) {
            const no_api = this.Helpers.create_element('p', {
                class_name: 'admin-no-api',
                text_content: t('admin_api_unavailable')
            });
            plate.appendChild(no_api);
            this.root.appendChild(plate);
            return;
        }

        const two_col = this.Helpers.create_element('div', { class_name: 'admin-two-columns' });

        const left_col = this.Helpers.create_element('section', {
            class_name: 'admin-column',
            attributes: { 'aria-labelledby': 'admin-rules-heading' }
        });
        const rules_heading = this.Helpers.create_element('h2', {
            id: 'admin-rules-heading',
            text_content: t('admin_rules_title')
        });
        const upload_rule_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary', 'admin-upload-btn'],
            text_content: t('admin_upload_rule'),
            attributes: { type: 'button' }
        });
        upload_rule_btn.addEventListener('click', this.handle_upload_rule_click);

        this.rule_file_input = this.Helpers.create_element('input', {
            class_name: 'admin-hidden-file-input',
            attributes: {
                type: 'file',
                accept: '.json,application/json',
                'aria-label': t('admin_upload_rule')
            }
        });
        this.rule_file_input.addEventListener('change', this.handle_rule_file_select);

        const rules_list = this.Helpers.create_element('ul', { class_name: 'admin-list' });
        if (this.rules.length === 0) {
            const empty = this.Helpers.create_element('li', {
                class_name: 'admin-list-empty',
                text_content: t('admin_rules_empty')
            });
            rules_list.appendChild(empty);
        } else {
            this.rules.forEach((r) => {
                const li = this.Helpers.create_element('li', { class_name: 'admin-list-item' });
                const label = this.Helpers.create_element('span', {
                    text_content: r.name || `Regelfil ${r.id}`,
                    class_name: 'admin-item-label'
                });
                const meta = this.Helpers.create_element('span', {
                    text_content: r.version ? `v${r.version}` : '',
                    class_name: 'admin-item-meta'
                });
                li.appendChild(label);
                if (r.version) li.appendChild(meta);
                rules_list.appendChild(li);
            });
        }
        left_col.appendChild(rules_heading);
        left_col.appendChild(upload_rule_btn);
        left_col.appendChild(this.rule_file_input);
        left_col.appendChild(rules_list);

        const right_col = this.Helpers.create_element('section', {
            class_name: 'admin-column',
            attributes: { 'aria-labelledby': 'admin-audits-heading' }
        });
        const audits_heading = this.Helpers.create_element('h2', {
            id: 'admin-audits-heading',
            text_content: t('admin_audits_title')
        });
        const upload_audit_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary', 'admin-upload-btn'],
            text_content: t('admin_upload_audit'),
            attributes: { type: 'button' }
        });
        upload_audit_btn.addEventListener('click', this.handle_upload_audit_click);

        this.audit_file_input = this.Helpers.create_element('input', {
            class_name: 'admin-hidden-file-input',
            attributes: {
                type: 'file',
                accept: '.json,application/json',
                'aria-label': t('admin_upload_audit')
            }
        });
        this.audit_file_input.addEventListener('change', this.handle_audit_file_select);

        const audits_list = this.Helpers.create_element('ul', { class_name: 'admin-list' });
        if (this.audits.length === 0) {
            const empty = this.Helpers.create_element('li', {
                class_name: 'admin-list-empty',
                text_content: t('admin_audits_empty')
            });
            audits_list.appendChild(empty);
        } else {
            this.audits.forEach((a) => {
                const li = this.Helpers.create_element('li', { class_name: 'admin-list-item' });
                const display_name = (a.metadata?.actorName || a.metadata?.caseNumber) || a.rule_set_name || `Granskning ${a.id}`;
                const label = this.Helpers.create_element('span', {
                    text_content: display_name,
                    class_name: 'admin-item-label'
                });
                const meta = this.Helpers.create_element('span', {
                    text_content: a.status || '',
                    class_name: 'admin-item-meta'
                });
                li.appendChild(label);
                if (a.status) li.appendChild(meta);
                audits_list.appendChild(li);
            });
        }
        right_col.appendChild(audits_heading);
        right_col.appendChild(upload_audit_btn);
        right_col.appendChild(this.audit_file_input);
        right_col.appendChild(audits_list);

        two_col.appendChild(left_col);
        two_col.appendChild(right_col);
        plate.appendChild(two_col);

        this.root.appendChild(plate);
    },

    destroy() {
        this.rule_file_input = null;
        this.audit_file_input = null;
        this.root = null;
        this.deps = null;
    }
};
