// js/components/AdminViewComponent.js
import { migrate_rulefile_to_new_structure } from '../logic/rulefile_migration_logic.js';
import {
    check_api_available,
    get_rules,
    get_rule,
    get_audits,
    load_audit_with_rule_file,
    import_rule,
    import_audit,
    delete_rule,
    delete_audit
} from '../api/client.js';

export const AdminViewComponent = {
    CSS_PATH: './css/components/admin_view_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this._api_checked = false;
        this._api_load_started = false;
        this.api_available = false;
        this.rules = [];
        this.audits = [];
        this.router = deps.router;
        this.NotificationComponent?.clear_global_message?.();
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.ValidationLogic = deps.ValidationLogic || window.ValidationLogic;

        this.upload_file_input = null;

        this.handle_upload_click = this.handle_upload_click.bind(this);
        this.handle_file_select = this.handle_file_select.bind(this);
        this.handle_go_to_start = this.handle_go_to_start.bind(this);
        this.handle_delete_rule = this.handle_delete_rule.bind(this);
        this.handle_delete_audit = this.handle_delete_audit.bind(this);
        this.handle_edit_rule = this.handle_edit_rule.bind(this);
        this.handle_open_audit = this.handle_open_audit.bind(this);

        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH, 'AdminViewComponent', {
                timeout: 5000,
                maxRetries: 2
            }).catch(() => {
                console.warn('[AdminViewComponent] Continuing without CSS due to loading failure');
            });
        }
        this._poll_timer = null;
        this.POLL_INTERVAL_MS = 3000;
        this._start_list_polling = () => {
            this._stop_list_polling();
            const poll = async () => {
                if (!this.root || !this.api_available) return;
                try {
                    const [fresh_audits, fresh_rules] = await Promise.all([get_audits(), get_rules()]);
                    const fp_audits = (arr) => JSON.stringify(arr.map(a => ({ id: a.id, status: a.status, updated_at: a.updated_at })));
                    const fp_rules = (arr) => JSON.stringify(arr.map(r => ({ id: r.id, updated_at: r.updated_at })));
                    const audits_changed = fp_audits(fresh_audits) !== fp_audits(this.audits);
                    const rules_changed = fp_rules(fresh_rules) !== fp_rules(this.rules);
                    if (audits_changed || rules_changed) {
                        this.audits = fresh_audits;
                        this.rules = fresh_rules;
                        if (this.root) this.render();
                    }
                } catch {
                    /* tyst vid poll-fel */
                }
                this._poll_timer = setTimeout(poll, this.POLL_INTERVAL_MS);
            };
            this._poll_timer = setTimeout(poll, this.POLL_INTERVAL_MS);
        };
        this._stop_list_polling = () => {
            if (this._poll_timer) {
                clearTimeout(this._poll_timer);
                this._poll_timer = null;
            }
        };
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

    handle_upload_click() {
        if (this.upload_file_input) {
            this.upload_file_input.click();
        }
    },

    handle_file_select(event) {
        const t = this.get_t_func();
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json_content = JSON.parse(e.target.result);

                const audit_validation = this.ValidationLogic?.validate_saved_audit_file?.(json_content);
                if (audit_validation?.isValid) {
                    const file_content_object = { ...json_content };
                    if (file_content_object.ruleFileContent) {
                        file_content_object.ruleFileContent = migrate_rulefile_to_new_structure(
                            file_content_object.ruleFileContent,
                            { Translation: this.Translation }
                        );
                    }
                    try {
                        await import_audit(file_content_object);
                    } catch (err) {
                        if (err.status === 409) {
                            this._show_audit_duplicate_modal(
                                file_content_object?.auditMetadata,
                                () => { if (event.target) event.target.value = ''; }
                            );
                            return;
                        }
                        throw err;
                    }
                    this.NotificationComponent?.show_global_message(
                        t('admin_audit_uploaded_success'),
                        'success'
                    );
                    await this.ensure_api_data();
                    this.render();
                    if (event.target) event.target.value = '';
                    return;
                }

                const migrated_content = migrate_rulefile_to_new_structure(json_content, {
                    Translation: this.Translation
                });
                const rule_validation = this.ValidationLogic?.validate_rule_file_json?.(migrated_content);
                if (rule_validation?.isValid) {
                    const name = migrated_content?.metadata?.title?.trim() || 'Importerad regelfil';
                    await import_rule(name, migrated_content);
                    this.NotificationComponent?.show_global_message(
                        t('admin_rule_uploaded_success'),
                        'success'
                    );
                    await this.ensure_api_data();
                    this.render();
                    if (event.target) event.target.value = '';
                    return;
                }

                this.NotificationComponent?.show_global_message(
                    t('admin_upload_invalid_file'),
                    'error'
                );
            } catch (error) {
                this.NotificationComponent?.show_global_message(
                    t('admin_upload_invalid_file') + (error.message ? ` (${error.message})` : ''),
                    'error'
                );
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
    },

    handle_go_to_start() {
        this.router('start');
    },

    _show_audit_duplicate_modal(metadata, on_close) {
        const t = this.get_t_func();
        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) {
            this.NotificationComponent?.show_global_message(t('admin_audit_already_exists'), 'error');
            if (typeof on_close === 'function') on_close();
            return;
        }
        const case_number = (metadata?.caseNumber ?? '').toString().trim() || '—';
        const actor_name = (metadata?.actorName ?? '').toString().trim() || t('admin_audit_duplicate_unknown_actor');
        const message = t('admin_audit_duplicate_modal_message', { caseNumber: case_number, actorName: actor_name });
        ModalComponent.show(
            {
                h1_text: t('admin_audit_duplicate_modal_title'),
                message_text: message
            },
            (container, modal_instance) => {
                const buttons_wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const ok_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('admin_audit_duplicate_modal_ok')
                });
                ok_btn.addEventListener('click', () => {
                    modal_instance.close();
                    if (typeof on_close === 'function') on_close();
                });
                buttons_wrapper.appendChild(ok_btn);
                container.appendChild(buttons_wrapper);
            }
        );
    },

    async handle_delete_rule(rule_id) {
        const t = this.get_t_func();
        try {
            await delete_rule(rule_id);
            this.NotificationComponent?.show_global_message(
                t('admin_rule_deleted_success'),
                'success'
            );
            await this.ensure_api_data();
            this.render();
        } catch (error) {
            this.NotificationComponent?.show_global_message(
                error.message || t('admin_delete_error'),
                'error'
            );
        }
    },

    async handle_delete_audit(audit_id) {
        const t = this.get_t_func();
        try {
            await delete_audit(audit_id);
            this.NotificationComponent?.show_global_message(
                t('admin_audit_deleted_success'),
                'success'
            );
            await this.ensure_api_data();
            this.render();
        } catch (error) {
            this.NotificationComponent?.show_global_message(
                error.message || t('admin_delete_error'),
                'error'
            );
        }
    },

    async handle_edit_rule(rule_id) {
        const t = this.get_t_func();
        try {
            const rule_row = await get_rule(rule_id);
            let content = rule_row?.content;
            if (typeof content === 'string') {
                try {
                    content = JSON.parse(content);
                } catch {
                    content = null;
                }
            }
            if (!content || typeof content !== 'object') {
                this.NotificationComponent?.show_global_message(
                    t('rule_file_invalid_json'),
                    'error'
                );
                return;
            }
            const migrated_content = migrate_rulefile_to_new_structure(content, {
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
            const migrated_content_string = JSON.stringify(migrated_content, null, 2);
            this.dispatch({
                type: this.StoreActionTypes.INITIALIZE_RULEFILE_EDITING,
                payload: {
                    ruleFileContent: migrated_content,
                    originalRuleFileContentString: migrated_content_string,
                    originalRuleFileFilename: rule_row?.name || `regelfil_${rule_id}.json`
                }
            });
            this.router('edit_rulefile_main');
        } catch (error) {
            this.NotificationComponent?.show_global_message(
                error.message || t('admin_load_rule_error'),
                'error'
            );
        }
    },

    async handle_open_audit(audit_id) {
        const t = this.get_t_func();
        try {
            const full_state = await load_audit_with_rule_file(audit_id);
            if (full_state.ruleFileContent && this.ValidationLogic?.validate_saved_audit_file?.(full_state)?.isValid) {
                this.dispatch({
                    type: this.StoreActionTypes.LOAD_AUDIT_FROM_FILE,
                    payload: full_state
                });
                if (this.NotificationComponent) {
                    this.NotificationComponent.show_global_message(t('saved_audit_loaded_successfully'), 'success');
                }
                this.router('audit_overview');
            } else {
                if (this.NotificationComponent) {
                    this.NotificationComponent.show_global_message(t('error_invalid_saved_audit_file'), 'error');
                }
            }
        } catch (err) {
            if (this.NotificationComponent) {
                this.NotificationComponent.show_global_message(
                    t('server_load_audit_error', { message: err.message }) || err.message,
                    'error'
                );
            }
        }
    },

    render() {
        if (!this.root || !this.Helpers?.create_element) return;

        if (!this._api_checked) {
            if (!this._api_load_started) {
                this._api_load_started = true;
                this.ensure_api_data().then(() => {
                    this._api_checked = true;
                    if (this.root) this.render();
                });
            }
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
        const upload_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary', 'admin-upload-btn'],
            text_content: t('admin_upload'),
            attributes: { type: 'button' }
        });
        upload_btn.addEventListener('click', this.handle_upload_click);
        this.upload_file_input = this.Helpers.create_element('input', {
            class_name: 'admin-hidden-file-input',
            attributes: {
                type: 'file',
                accept: '.json,application/json',
                'aria-label': t('admin_upload')
            }
        });
        this.upload_file_input.addEventListener('change', this.handle_file_select);
        header.appendChild(title);
        header.appendChild(upload_btn);
        header.appendChild(this.upload_file_input);
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
        const rules_list = this.Helpers.create_element('ul', { class_name: 'admin-list' });
        if (this.rules.length === 0) {
            const empty = this.Helpers.create_element('li', {
                class_name: 'admin-list-empty',
                text_content: t('admin_rules_empty')
            });
            rules_list.appendChild(empty);
        } else {
            const sorted_rules = [...this.rules].sort((a, b) => {
                const na = (a.name || `Regelfil ${a.id}`).trim();
                const nb = (b.name || `Regelfil ${b.id}`).trim();
                return na.localeCompare(nb, undefined, { sensitivity: 'base' });
            });
            sorted_rules.forEach((r) => {
                const li = this.Helpers.create_element('li', { class_name: 'admin-list-item' });
                const rule_name = r.name || `Regelfil ${r.id}`;
                const version_display = r.version_display ? ` (${r.version_display})` : '';
                const link_text = rule_name + version_display;
                const label = this.Helpers.create_element('a', {
                    text_content: link_text,
                    class_name: 'admin-item-label admin-rule-link',
                    attributes: {
                        href: '#edit_rulefile_main',
                        'aria-label': t('admin_edit_rule_aria', { name: link_text })
                    }
                });
                label.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handle_edit_rule(r.id);
                });
                const delete_label = t('delete') + ' ' + link_text;
                const delete_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'admin-delete-btn'],
                    text_content: t('delete'),
                    attributes: {
                        type: 'button',
                        'aria-label': delete_label
                    }
                });
                delete_btn.addEventListener('click', () => {
                    const show_modal = window.show_confirm_delete_modal;
                    if (show_modal) {
                        show_modal({
                            h1_text: t('admin_confirm_delete_rule_title'),
                            warning_text: t('admin_confirm_delete_rule_warning', { name: link_text }),
                            delete_button: delete_btn,
                            yes_label: t('admin_confirm_delete_radera'),
                            no_label: t('admin_confirm_delete_behall'),
                            on_confirm: () => this.handle_delete_rule(r.id)
                        });
                    } else {
                        this.handle_delete_rule(r.id);
                    }
                });
                li.appendChild(label);
                li.appendChild(delete_btn);
                rules_list.appendChild(li);
            });
        }
        left_col.appendChild(rules_heading);
        left_col.appendChild(rules_list);

        const right_col = this.Helpers.create_element('section', {
            class_name: 'admin-column',
            attributes: { 'aria-labelledby': 'admin-audits-heading' }
        });
        const audits_heading = this.Helpers.create_element('h2', {
            id: 'admin-audits-heading',
            text_content: t('admin_audits_title')
        });
        const audits_list = this.Helpers.create_element('ul', { class_name: 'admin-list' });
        if (this.audits.length === 0) {
            const empty = this.Helpers.create_element('li', {
                class_name: 'admin-list-empty',
                text_content: t('admin_audits_empty')
            });
            audits_list.appendChild(empty);
        } else {
            const sorted_audits = [...this.audits].sort((a, b) => {
                const ca = (a.metadata?.caseNumber ?? '').toString().trim();
                const cb = (b.metadata?.caseNumber ?? '').toString().trim();
                if (!ca && !cb) return 0;
                if (!ca) return 1;
                if (!cb) return -1;
                return ca.localeCompare(cb, undefined, { numeric: true });
            });
            sorted_audits.forEach((a) => {
                const li = this.Helpers.create_element('li', { class_name: 'admin-list-item admin-audit-item' });
                const actor_name = a.metadata?.actorName || '';
                const display_name = actor_name || `Granskning ${a.id}`;
                const case_number = a.metadata?.caseNumber || '';
                const case_span = this.Helpers.create_element('span', {
                    text_content: case_number ? `${case_number} ` : '',
                    class_name: 'admin-audit-case-number'
                });
                const link = this.Helpers.create_element('a', {
                    text_content: display_name,
                    class_name: 'admin-item-label admin-audit-link',
                    attributes: {
                        href: `#audit_overview?auditId=${a.id}`,
                        'aria-label': t('start_view_open_audit_aria', { name: display_name })
                    }
                });
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handle_open_audit(a.id);
                });
                const audit_link_text = case_number ? `${case_number} ${display_name}` : display_name;
                const delete_label = t('delete') + ' ' + audit_link_text;
                const delete_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'admin-delete-btn'],
                    text_content: t('delete'),
                    attributes: {
                        type: 'button',
                        'aria-label': delete_label
                    }
                });
                delete_btn.addEventListener('click', () => {
                    const show_modal = window.show_confirm_delete_modal;
                    if (show_modal) {
                        show_modal({
                            h1_text: t('admin_confirm_delete_audit_title'),
                            warning_text: t('admin_confirm_delete_audit_warning', { name: audit_link_text }),
                            delete_button: delete_btn,
                            yes_label: t('admin_confirm_delete_radera'),
                            no_label: t('admin_confirm_delete_behall'),
                            on_confirm: () => this.handle_delete_audit(a.id)
                        });
                    } else {
                        this.handle_delete_audit(a.id);
                    }
                });
                li.appendChild(case_span);
                li.appendChild(link);
                li.appendChild(delete_btn);
                audits_list.appendChild(li);
            });
        }
        right_col.appendChild(audits_heading);
        right_col.appendChild(audits_list);

        two_col.appendChild(left_col);
        two_col.appendChild(right_col);
        plate.appendChild(two_col);

        this.root.appendChild(plate);

        if (this._api_checked && this.api_available && typeof this._start_list_polling === 'function') {
            this._start_list_polling();
        }
    },

    destroy() {
        this._stop_list_polling?.();
        this.upload_file_input = null;
        this.root = null;
        this.deps = null;
    }
};
