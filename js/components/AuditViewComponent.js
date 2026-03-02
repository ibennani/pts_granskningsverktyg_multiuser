// js/components/AuditViewComponent.js
import { migrate_rulefile_to_new_structure } from '../logic/rulefile_migration_logic.js';
import { version_greater_than } from '../utils/version_utils.js';
import {
    check_api_available,
    get_rules,
    get_rule,
    get_audits,
    import_rule,
    import_audit,
    delete_rule,
    delete_audit,
    export_rule,
    publish_rule,
    copy_rule,
    publish_production_rule
} from '../api/client.js';
import { GenericTableComponent } from './GenericTableComponent.js';
import { AuditListComponent } from './AuditListComponent.js';
import { create_audit_table_columns } from '../utils/audit_table_columns.js';
import { create_rule_table_columns } from '../utils/rule_table_columns.js';
import { open_audit_by_id, download_audit_by_id } from '../logic/audit_open_logic.js';

export const AuditViewComponent = {
    CSS_PATH: './css/components/audit_view_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this._api_checked = false;
        this._api_load_started = false;
        this.api_available = false;
        this.rules = [];
        this.published_rules = [];
        this.production_rules = [];
        this.audits = [];
        this.router = deps.router;
        this.NotificationComponent?.clear_global_message?.();
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.ValidationLogic = deps.ValidationLogic || window.ValidationLogic;
        this.SaveAuditLogic = deps.SaveAuditLogic || window.SaveAuditLogic;

        const view_name = deps.view_name;
        if (view_name === 'audit_rules') {
            this.audit_mode = 'rules';
        } else if (view_name === 'audit_audits' || view_name === 'start') {
            this.audit_mode = 'audits';
        } else {
            this.audit_mode = 'both';
        }

        this.upload_file_input = null;
        this.upload_audit_file_input = null;

        this.handle_upload_click = this.handle_upload_click.bind(this);
        this.handle_file_select = this.handle_file_select.bind(this);
        this.handle_audit_upload_click = this.handle_audit_upload_click.bind(this);
        this.handle_audit_file_select = this.handle_audit_file_select.bind(this);
        this.handle_go_to_start = this.handle_go_to_start.bind(this);
        this.handle_delete_rule = this.handle_delete_rule.bind(this);
        this.handle_delete_audit = this.handle_delete_audit.bind(this);
        this.handle_download_audit = this.handle_download_audit.bind(this);
        this.handle_download_rule = this.handle_download_rule.bind(this);
        this.handle_publish_rule = this.handle_publish_rule.bind(this);
        this.handle_copy_rule = this.handle_copy_rule.bind(this);
        this.handle_publish_production_rule = this.handle_publish_production_rule.bind(this);
        this.handle_edit_rule = this.handle_edit_rule.bind(this);
        this.handle_open_audit = this.handle_open_audit.bind(this);
        this.handle_start_new_audit = this.handle_start_new_audit.bind(this);

        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH, 'AuditViewComponent', {
                timeout: 5000,
                maxRetries: 2
            }).catch(() => {
                console.warn('[AuditViewComponent] Continuing without CSS due to loading failure');
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
                        this._split_rules_for_views();
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

        this._auditsTable = Object.create(GenericTableComponent);
        await this._auditsTable.init({ deps });
        this._rulesTable = Object.create(GenericTableComponent);
        await this._rulesTable.init({ deps });
        this._auditListComponent = Object.create(AuditListComponent);
        await this._auditListComponent.init({ deps });
        this.draft_rules = [];
    },

    get_t_func() {
        return (this.Translation && typeof this.Translation.t === 'function')
            ? this.Translation.t
            : (key) => `**${key}**`;
    },

    get_status_label(status) {
        const t = this.get_t_func();
        const map = {
            not_started: t('audit_status_not_started'),
            in_progress: t('audit_status_in_progress'),
            locked: t('audit_status_locked'),
            archived: t('audit_status_archived')
        };
        return map[status] || status;
    },

    _split_rules_for_views() {
        const all_rules = Array.isArray(this.rules) ? this.rules : [];
        this.published_rules = all_rules.filter((r) => r.is_published);
        this.production_rules = all_rules.filter((r) => !r.is_published);
    },

    async ensure_api_data() {
        this.api_available = await check_api_available();
        if (this.api_available) {
            try {
                this.rules = await get_rules();
                this.audits = await get_audits();
                this._split_rules_for_views();
            } catch {
                this.rules = [];
                this.published_rules = [];
                this.production_rules = [];
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
                        t('audit_audit_uploaded_success'),
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
                        t('audit_rule_uploaded_success'),
                        'success'
                    );
                    await this.ensure_api_data();
                    this.render();
                    if (event.target) event.target.value = '';
                    return;
                }

                this.NotificationComponent?.show_global_message(
                    t('audit_upload_invalid_file'),
                    'error'
                );
            } catch (error) {
                this.NotificationComponent?.show_global_message(
                    t('audit_upload_invalid_file') + (error.message ? ` (${error.message})` : ''),
                    'error'
                );
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
    },

    handle_audit_upload_click() {
        if (this.upload_audit_file_input) {
            this.upload_audit_file_input.click();
        }
    },

    async handle_audit_file_select(event) {
        const t = this.get_t_func();
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            let file_content_object = null;
            try {
                const json_content = JSON.parse(e.target.result);
                const audit_validation = this.ValidationLogic?.validate_saved_audit_file?.(json_content);
                if (!audit_validation?.isValid) {
                    this.NotificationComponent?.show_global_message(
                        t('audit_upload_invalid_file') + (audit_validation?.message ? ` (${audit_validation.message})` : ''),
                        'error'
                    );
                    if (event.target) event.target.value = '';
                    return;
                }
                file_content_object = { ...json_content };
                if (file_content_object.ruleFileContent) {
                    file_content_object.ruleFileContent = migrate_rulefile_to_new_structure(
                        file_content_object.ruleFileContent,
                        { Translation: this.Translation }
                    );
                }

                const file_id = file_content_object.auditId ?? file_content_object.audit_id ?? null;
                const file_meta = file_content_object.auditMetadata || {};
                const file_case = (file_meta.caseNumber ?? '').toString().trim();
                const file_actor = (file_meta.actorName ?? '').toString().trim();
                const file_updated = Number(file_content_object.updated_at ?? file_content_object.updatedAt ?? 0);

                const existing = this.audits.find((a) => {
                    if (file_id != null && String(a.id) === String(file_id)) return true;
                    const sc = (a.metadata?.caseNumber ?? '').toString().trim();
                    const sa = (a.metadata?.actorName ?? '').toString().trim();
                    return sc === file_case && sa === file_actor;
                });

                if (existing) {
                    const server_updated = Number(existing.updated_at ?? 0);
                    // Visa modal endast om servern har en strikt nyare version. Om filen är nyare eller samma tid → ladda upp direkt.
                    if (server_updated > file_updated) {
                        this._show_audit_server_newer_modal(
                            file_content_object,
                            () => this._do_import_audit_and_refresh(file_content_object, event.target),
                            () => { if (event.target) event.target.value = ''; }
                        );
                        return;
                    }
                }

                await this._do_import_audit_and_refresh(file_content_object, event.target);
            } catch (err) {
                this.NotificationComponent?.show_global_message(
                    t('audit_upload_invalid_file') + (err?.message ? ` (${err.message})` : ''),
                    'error'
                );
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
    },

    async _do_import_audit_and_refresh(file_content_object, input_element) {
        const t = this.get_t_func();
        try {
            await import_audit(file_content_object);
            this.NotificationComponent?.show_global_message(t('audit_audit_uploaded_success'), 'success');
            await this.ensure_api_data();
            this.render();
            if (input_element) input_element.value = '';
        } catch (err) {
            if (err.status === 409) {
                this._show_audit_duplicate_modal(
                    file_content_object?.auditMetadata,
                    () => { if (input_element) input_element.value = ''; }
                );
                return;
            }
            this.NotificationComponent?.show_global_message(
                err?.message || t('audit_upload_invalid_file'),
                'error'
            );
            if (input_element) input_element.value = '';
        }
    },

    _show_audit_server_newer_modal(file_content_object, on_upload_anyway, on_close) {
        const t = this.get_t_func();
        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) {
            if (typeof on_close === 'function') on_close();
            return;
        }
        const meta = file_content_object?.auditMetadata || {};
        const case_number = (meta.caseNumber ?? '').toString().trim() || '—';
        const actor_name = (meta.actorName ?? '').toString().trim() || t('audit_audit_duplicate_unknown_actor');
        const message = t('audit_audit_server_newer_modal_message', { caseNumber: case_number, actorName: actor_name });
        ModalComponent.show(
            {
                h1_text: t('audit_audit_server_newer_modal_title'),
                message_text: message
            },
            (container, modal_instance) => {
                const buttons_wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const upload_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('audit_audit_server_newer_modal_upload_anyway')
                });
                upload_btn.addEventListener('click', () => {
                    modal_instance.close();
                    if (typeof on_upload_anyway === 'function') on_upload_anyway();
                });
                const close_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    text_content: t('audit_audit_server_newer_modal_close')
                });
                close_btn.addEventListener('click', () => {
                    modal_instance.close();
                    if (typeof on_close === 'function') on_close();
                });
                buttons_wrapper.appendChild(upload_btn);
                buttons_wrapper.appendChild(close_btn);
                container.appendChild(buttons_wrapper);
            }
        );
    },

    handle_go_to_start() {
        this.router('start');
    },

    handle_start_new_audit() {
        this._show_rule_picker_for_new_audit();
    },

    async _show_rule_picker_for_new_audit() {
        const t = this.get_t_func();
        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) return;
        await this.ensure_api_data();
        const available_rules = (this.published_rules && this.published_rules.length > 0)
            ? this.published_rules
            : this.rules;
        if (!available_rules || available_rules.length === 0) {
            this.NotificationComponent?.show_global_message(t('server_no_rules'), 'error');
            return;
        }
        const type_to_rule = new Map();
        for (const r of available_rules) {
            const type_key = (r.monitoring_type_text || r.name || `Regelfil ${r.id}`).trim();
            const existing = type_to_rule.get(type_key);
            if (!existing || version_greater_than(r.metadata_version || '', existing.metadata_version || '')) {
                type_to_rule.set(type_key, r);
            }
        }
        const rules_to_show = [...type_to_rule.values()].sort((a, b) => {
            const ta = (a.monitoring_type_text || a.name || `Regelfil ${a.id}`).trim();
            const tb = (b.monitoring_type_text || b.name || `Regelfil ${b.id}`).trim();
            return ta.localeCompare(tb, 'sv');
        });
        ModalComponent.show(
            { h1_text: t('rulefile_metadata_field_monitoring_type_label'), message_text: '' },
            (container, modal_instance) => {
                const ul = this.Helpers.create_element('ul', { class_name: 'audit-rules-picker-list' });
                rules_to_show.forEach((r) => {
                    const btn_text = (r.monitoring_type_text || r.name || `Regelfil ${r.id}`).trim();
                    const li = this.Helpers.create_element('li');
                    const btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-default', 'button-link-style'],
                        text_content: btn_text
                    });
                    btn.addEventListener('click', () => {
                        modal_instance.close();
                        this._load_rule_and_start_new_audit(r.id);
                    });
                    li.appendChild(btn);
                    ul.appendChild(li);
                });
                container.appendChild(ul);
                const close_wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const close_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary', 'audit-modal-close-btn'],
                    text_content: t('select_rule_modal_close')
                });
                close_btn.addEventListener('click', () => modal_instance.close());
                close_wrapper.appendChild(close_btn);
                container.appendChild(close_wrapper);
            }
        );
    },

    async _load_rule_and_start_new_audit(rule_id) {
        const t = this.get_t_func();
        try {
            const rule_row = await get_rule(rule_id);
            // Nya granskningar ska alltid utgå från publicerad version av regelfilen.
            let content = rule_row?.published_content ?? rule_row?.content;
            if (typeof content === 'string') {
                try {
                    content = JSON.parse(content);
                } catch {
                    content = null;
                }
            }
            if (!content || typeof content !== 'object') {
                this.NotificationComponent?.show_global_message(t('rule_file_invalid_json'), 'error');
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
            await this.dispatch({
                type: this.StoreActionTypes.INITIALIZE_NEW_AUDIT,
                payload: { ruleFileContent: migrated_content }
            });
            if (typeof window !== 'undefined') {
                window.__GV_SHOW_EMPTY_METADATA_FORM = true;
            }
            this.router('metadata');
        } catch (error) {
            this.NotificationComponent?.show_global_message(
                error.message || t('audit_load_rule_error'),
                'error'
            );
        }
    },

    _show_audit_duplicate_modal(metadata, on_close) {
        const t = this.get_t_func();
        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) {
            this.NotificationComponent?.show_global_message(t('audit_audit_already_exists'), 'error');
            if (typeof on_close === 'function') on_close();
            return;
        }
        const case_number = (metadata?.caseNumber ?? '').toString().trim() || '—';
        const actor_name = (metadata?.actorName ?? '').toString().trim() || t('audit_audit_duplicate_unknown_actor');
        const message = t('audit_audit_duplicate_modal_message', { caseNumber: case_number, actorName: actor_name });
        ModalComponent.show(
            {
                h1_text: t('audit_audit_duplicate_modal_title'),
                message_text: message
            },
            (container, modal_instance) => {
                const buttons_wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const ok_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('audit_audit_duplicate_modal_ok')
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
                t('audit_rule_deleted_success'),
                'success'
            );
            await this.ensure_api_data();
            this.render();
        } catch (error) {
            this.NotificationComponent?.show_global_message(
                error.message || t('audit_delete_error'),
                'error'
            );
        }
    },

    async handle_publish_rule(rule_id) {
        const t = this.get_t_func();
        try {
            await publish_rule(rule_id);
            this.NotificationComponent?.show_global_message(
                t('rulefile_publish_success'),
                'success'
            );
            await this.ensure_api_data();
            this.render();
        } catch (error) {
            this.NotificationComponent?.show_global_message(
                error.message || t('rulefile_publish_error'),
                'error'
            );
        }
    },

    async handle_copy_rule(rule_id) {
        const t = this.get_t_func();
        try {
            const created = await copy_rule(rule_id);
            await this.ensure_api_data();
            this.render();
            if (created?.id) {
                await this.handle_edit_rule(created.id);
            }
        } catch (error) {
            this.NotificationComponent?.show_global_message(
                error.message || t('audit_load_rule_error'),
                'error'
            );
        }
    },

    async handle_publish_production_rule(rule_id) {
        const t = this.get_t_func();
        try {
            await publish_production_rule(rule_id);
            this.NotificationComponent?.show_global_message(
                t('rulefile_publish_success'),
                'success'
            );
            await this.ensure_api_data();
            this.render();
        } catch (error) {
            this.NotificationComponent?.show_global_message(
                error.message || t('rulefile_publish_error'),
                'error'
            );
        }
    },

    async handle_delete_audit(audit_id) {
        const t = this.get_t_func();
        try {
            await delete_audit(audit_id);
            this.NotificationComponent?.show_global_message(
                t('audit_audit_deleted_success'),
                'success'
            );
            await this.ensure_api_data();
            this.render();
        } catch (error) {
            this.NotificationComponent?.show_global_message(
                error.message || t('audit_delete_error'),
                'error'
            );
        }
    },

    async handle_edit_rule(rule_id) {
        const t = this.get_t_func();
        try {
            const rule_row = await get_rule(rule_id);
            const is_production_copy = !!rule_row?.production_base_id;
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
                    originalRuleFileFilename: rule_row?.name || `regelfil_${rule_id}.json`,
                    ruleSetId: rule_id,
                    ruleFileServerVersion: rule_row?.version ?? 0
                }
            });
            if (is_production_copy) {
                this.router('edit_rulefile_main');
            } else {
                this.router('rulefile_metadata_view');
            }
        } catch (error) {
            this.NotificationComponent?.show_global_message(
                error.message || t('audit_load_rule_error'),
                'error'
            );
        }
    },

    async handle_open_audit(audit_id) {
        const t = this.get_t_func();
        await open_audit_by_id({
            audit_id,
            dispatch: this.dispatch,
            StoreActionTypes: this.StoreActionTypes,
            ValidationLogic: this.ValidationLogic,
            router: this.router,
            NotificationComponent: this.NotificationComponent,
            t
        });
    },

    async handle_download_audit(audit_id) {
        const t = this.get_t_func();
        await download_audit_by_id({
            audit_id,
            ValidationLogic: this.ValidationLogic,
            SaveAuditLogic: this.SaveAuditLogic,
            NotificationComponent: this.NotificationComponent,
            t
        });
    },

    async handle_download_rule(rule_id) {
        const t = this.get_t_func();
        const show_msg = this.NotificationComponent?.show_global_message?.bind(this.NotificationComponent);
        try {
            const rule = await export_rule(rule_id);
            if (!rule || !rule.content) {
                if (show_msg) show_msg(t('error_internal'), 'error');
                return;
            }
            const json_string = JSON.stringify(rule, null, 2);
            const blob = new Blob([json_string], { type: 'application/json' });
            const safe_name = (rule.name || 'regelfil').replace(/[\s\\/:*?"<>|]/g, '_').trim() || 'regelfil';
            const version_suffix = rule.version != null ? `_v${rule.version}` : '';
            const filename = `${safe_name}${version_suffix}.json`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.setAttribute('aria-hidden', 'true');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            if (show_msg) {
                show_msg(t('audit_load_rule_error') + ' ' + (err.message || ''), 'error');
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
                text_content: t('audit_loading'),
                class_name: 'audit-loading'
            });
            this.root.appendChild(loading);
            return;
        }

        this.root.innerHTML = '';
        const t = this.get_t_func();

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate audit-plate' });

        if (this.NotificationComponent?.get_global_message_element_reference) {
            const msg_el = this.NotificationComponent.get_global_message_element_reference();
            plate.appendChild(msg_el);
        }

        const header = this.Helpers.create_element('div', { class_name: 'audit-header' });
        const title_text = this.audit_mode === 'rules' ? t('audit_title_rules') : this.audit_mode === 'audits' ? t('audit_title_audits') : t('audit_title');
        const title = this.Helpers.create_element('h1', { text_content: title_text });
        if (this.audit_mode !== 'audits') {
            const upload_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-primary', 'audit-upload-btn'],
                text_content: t('audit_upload'),
                attributes: { type: 'button' }
            });
            upload_btn.addEventListener('click', this.handle_upload_click);
            this.upload_file_input = this.Helpers.create_element('input', {
                class_name: 'audit-hidden-file-input',
                attributes: {
                    type: 'file',
                    accept: '.json,application/json',
                    'aria-label': t('audit_upload'),
                    tabindex: '-1',
                    'aria-hidden': 'true'
                }
            });
            this.upload_file_input.addEventListener('change', this.handle_file_select);
            header.appendChild(title);
            header.appendChild(upload_btn);
            header.appendChild(this.upload_file_input);
            if (this.audit_mode === 'both') {
                const start_new_audit_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'audit-start-new-audit-btn'],
                    text_content: t('start_new_audit'),
                    attributes: { type: 'button', 'aria-label': t('start_new_audit') }
                });
                start_new_audit_btn.addEventListener('click', this.handle_start_new_audit);
                header.appendChild(start_new_audit_btn);
            }
        } else {
            header.appendChild(title);
        }
        plate.appendChild(header);

        if (!this.api_available) {
            const no_api = this.Helpers.create_element('p', {
                class_name: 'audit-no-api',
                text_content: t('audit_api_unavailable')
            });
            plate.appendChild(no_api);
            this.root.appendChild(plate);
            return;
        }

        const two_col = this.Helpers.create_element('div', { class_name: 'audit-two-columns' });

        const left_col = this.Helpers.create_element('section', {
            class_name: 'start-view-audits-section',
            attributes: { 'aria-labelledby': 'audit-rules-heading' }
        });
        const rules_heading = this.Helpers.create_element('h2', {
            id: 'audit-rules-heading',
            text_content: t('audit_rules_title')
        });
        left_col.appendChild(rules_heading);

        const rules_table_wrapper = this.Helpers.create_element('div');
        this._rulesTableSortState = this._rulesTableSortState ?? { columnIndex: 0, direction: 'asc' };
        const rules_table_deps = {
            t: this.get_t_func(),
            Helpers: this.Helpers,
            Translation: this.Translation,
            production_rules_with_base_ids: (this.production_rules || [])
                .map((r) => r.production_base_id)
                .filter((id) => !!id)
        };
        const rules_table_handlers = {
            onEditRule: (id) => this.handle_edit_rule(id),
            onDownloadRule: (id) => this.handle_download_rule(id),
            onDeleteRule: (id) => this.handle_delete_rule(id),
            onPublishRule: (id) => this.handle_publish_rule(id),
            onCopyRule: (id) => this.handle_copy_rule(id),
            onPublishProductionRule: (id) => this.handle_publish_production_rule(id)
        };
        const rule_columns = create_rule_table_columns(rules_table_deps, rules_table_handlers);
        this._rulesTable?.render({
            root: rules_table_wrapper,
            columns: rule_columns,
            data: this.published_rules || [],
            emptyMessage: t('audit_rules_empty'),
            ariaLabel: t('audit_rules_title'),
            wrapperClassName: 'generic-table-wrapper',
            tableClassName: 'generic-table generic-table--audit-list',
            sortState: this._rulesTableSortState,
            onSort: (columnIndex, direction) => {
                this._rulesTableSortState = { columnIndex, direction };
                this.render();
            },
            t: this.Translation.t.bind(this.Translation)
        });
        left_col.appendChild(rules_table_wrapper);

        const draft_section = this.Helpers.create_element('section', {
            class_name: 'start-view-audits-section start-view-audits-section-following'
        });
        const draft_rules_heading = this.Helpers.create_element('h2', {
            text_content: t('audit_rules_draft_title')
        });
        draft_section.appendChild(draft_rules_heading);

        const draft_rules_table_wrapper = this.Helpers.create_element('div');
        this._draftRulesTableSortState = this._draftRulesTableSortState ?? { columnIndex: 0, direction: 'asc' };
        this._rulesTable?.render({
            root: draft_rules_table_wrapper,
            columns: rule_columns,
            data: this.production_rules || [],
            emptyMessage: t('audit_rules_draft_empty') || '',
            ariaLabel: t('audit_rules_draft_title'),
            wrapperClassName: 'generic-table-wrapper',
            tableClassName: 'generic-table generic-table--audit-list',
            sortState: this._draftRulesTableSortState,
            onSort: (columnIndex, direction) => {
                this._draftRulesTableSortState = { columnIndex, direction };
                this.render();
            },
            t: this.Translation.t.bind(this.Translation)
        });
        draft_section.appendChild(draft_rules_table_wrapper);
        left_col.appendChild(draft_section);

        const right_col = this.Helpers.create_element(
            this.audit_mode === 'audits' ? 'div' : 'section',
            this.audit_mode === 'audits'
                ? {}
                : { class_name: 'audit-column', attributes: { 'aria-labelledby': 'audit-audits-heading' } }
        );

        if (this.audit_mode === 'audits') {
            const sort_audits = (list) => [...list].sort((a, b) => {
                const ca = (a.metadata?.caseNumber ?? '').toString().trim();
                const cb = (b.metadata?.caseNumber ?? '').toString().trim();
                if (!ca && !cb) return 0;
                if (!ca) return 1;
                if (!cb) return -1;
                return ca.localeCompare(cb, undefined, { numeric: true });
            });

            const in_progress = this.audits.filter((a) => a.status === 'in_progress');
            const not_started = this.audits.filter((a) => a.status === 'not_started');
            const completed = this.audits.filter((a) => a.status === 'locked' || a.status === 'archived');

            const section_configs = [
                { heading_key: 'start_view_audits_heading', audits: sort_audits(in_progress) },
                { heading_key: 'start_view_new_audits_heading', audits: sort_audits(not_started) },
                { heading_key: 'start_view_completed_audits_heading', audits: sort_audits(completed) }
            ];

            right_col.classList.add('audit-audits-sections-container');

            section_configs.forEach((config, index) => {
                const section = this.Helpers.create_element('section', {
                    class_name: index === 0 ? 'start-view-audits-section' : 'start-view-audits-section start-view-audits-section-following',
                    attributes: { 'aria-labelledby': `${config.heading_key}-heading` }
                });

                const heading_row = this.Helpers.create_element('div', { class_name: 'start-view-section-heading-row' });
                const section_heading = this.Helpers.create_element('h2', {
                    id: `${config.heading_key}-heading`,
                    text_content: t(config.heading_key)
                });
                heading_row.appendChild(section_heading);

                if (config.heading_key === 'start_view_audits_heading') {
                    const upload_audit_btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-primary', 'audit-upload-audit-btn'],
                        text_content: t('audit_upload_saved_audit'),
                        attributes: {
                            type: 'button',
                            'aria-label': t('audit_upload_saved_audit')
                        }
                    });
                    upload_audit_btn.addEventListener('click', this.handle_audit_upload_click);
                    this.upload_audit_file_input = this.Helpers.create_element('input', {
                        class_name: 'audit-hidden-file-input',
                        attributes: {
                            type: 'file',
                            accept: '.json,application/json',
                            'aria-label': t('audit_upload_saved_audit'),
                            tabindex: '-1',
                            'aria-hidden': 'true'
                        }
                    });
                    this.upload_audit_file_input.addEventListener('change', this.handle_audit_file_select);
                    heading_row.appendChild(upload_audit_btn);
                    heading_row.appendChild(this.upload_audit_file_input);
                }

                // "Starta ny granskning"-knapp i sektionen för nya granskningar
                if (config.heading_key === 'start_view_new_audits_heading') {
                    const start_new_btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-primary', 'audit-start-new-audit-btn'],
                        text_content: t('start_new_audit'),
                        attributes: {
                            type: 'button',
                            'aria-label': t('start_new_audit')
                        }
                    });
                    start_new_btn.addEventListener('click', this.handle_start_new_audit);
                    heading_row.appendChild(start_new_btn);
                }

                section.appendChild(heading_row);

                const table_wrapper = this.Helpers.create_element('div');
                const empty_key =
                    config.heading_key === 'start_view_audits_heading'
                        ? 'start_view_no_audits'
                        : config.heading_key === 'start_view_new_audits_heading'
                            ? 'start_view_no_new_audits'
                            : 'start_view_no_completed_audits';

                const sort_state_key =
                    config.heading_key === 'start_view_audits_heading'
                        ? '_inProgressTableSortState'
                        : config.heading_key === 'start_view_new_audits_heading'
                            ? '_newTableSortState'
                            : '_completedTableSortState';

                this[sort_state_key] = this[sort_state_key] ?? { columnIndex: 0, direction: 'asc' };

                this._auditListComponent.render({
                    root: table_wrapper,
                    audits: config.audits,
                    emptyMessage: t(empty_key),
                    ariaLabel: t(config.heading_key),
                    includeDelete: true,
                    sortState: this[sort_state_key],
                    onSort: (columnIndex, direction) => {
                        this[sort_state_key] = { columnIndex, direction };
                        this.render();
                    },
                    onOpenAudit: (id) => this.handle_open_audit(id),
                    onDownloadAudit: (id) => this.handle_download_audit(id),
                    onDeleteAudit: (id) => this.handle_delete_audit(id),
                    get_status_label: this.get_status_label.bind(this)
                });

                section.appendChild(table_wrapper);
                right_col.appendChild(section);
            });
        } else {
            const audits_heading_row = this.Helpers.create_element('div', {
                class_name: 'audit-column-heading-row'
            });
            const audits_heading = this.Helpers.create_element('h2', {
                id: 'audit-audits-heading',
                text_content: t('audit_audits_title')
            });
            audits_heading_row.appendChild(audits_heading);
            right_col.appendChild(audits_heading_row);

            const audits_list = this.Helpers.create_element('ul', { class_name: 'audit-list' });
            if (this.audits.length === 0) {
                const empty = this.Helpers.create_element('li', {
                    class_name: 'audit-list-empty',
                    text_content: t('audit_audits_empty')
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
                    const li = this.Helpers.create_element('li', { class_name: 'audit-list-item audit-audit-item' });
                    const actor_name = a.metadata?.actorName || '';
                    const display_name = actor_name || `Granskning ${a.id}`;
                    const case_number = a.metadata?.caseNumber || '';
                    const case_span = this.Helpers.create_element('span', {
                        text_content: case_number ? `${case_number} ` : '',
                        class_name: 'audit-audit-case-number'
                    });
                    const link = this.Helpers.create_element('a', {
                        text_content: display_name,
                        class_name: 'audit-item-label audit-audit-link',
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
                    const delete_aria = t('audit_delete_audit_aria', { name: audit_link_text });
                    const download_aria = t('audit_download_audit_aria', { name: audit_link_text });
                    const icon_svg_li = (name, size = 16) => (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg(name, ['currentColor'], size) : '');

                    const download_btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-default', 'button-small', 'audit-download-btn'],
                        html_content: `<span>${t('audit_download_label')}</span>` + icon_svg_li('save'),
                        attributes: { type: 'button', 'aria-label': download_aria }
                    });
                    download_btn.addEventListener('click', () => this.handle_download_audit(a.id));

                    const delete_btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-danger', 'button-small', 'audit-delete-btn'],
                        html_content: `<span>${t('delete')}</span>` + icon_svg_li('delete'),
                        attributes: { type: 'button', 'aria-label': delete_aria }
                    });
                    delete_btn.addEventListener('click', () => {
                        const show_modal = window.show_confirm_delete_modal;
                        if (show_modal) {
                            show_modal({
                                h1_text: t('audit_confirm_delete_audit_title'),
                                warning_text: t('audit_confirm_delete_audit_warning', { name: audit_link_text }),
                                delete_button: delete_btn,
                                yes_label: t('audit_confirm_delete_radera'),
                                no_label: t('audit_confirm_delete_behall'),
                                on_confirm: () => this.handle_delete_audit(a.id)
                            });
                        } else {
                            this.handle_delete_audit(a.id);
                        }
                    });

                    const btn_group = this.Helpers.create_element('div', { class_name: 'audit-audit-item-actions' });
                    btn_group.appendChild(download_btn);
                    btn_group.appendChild(delete_btn);

                    li.appendChild(case_span);
                    li.appendChild(link);
                    li.appendChild(btn_group);
                    audits_list.appendChild(li);
                });
            }
            right_col.appendChild(audits_list);
        }

        if (this.audit_mode === 'rules') {
            plate.appendChild(left_col);
        } else if (this.audit_mode === 'audits') {
            plate.appendChild(right_col);
        } else {
            two_col.appendChild(left_col);
            two_col.appendChild(right_col);
            plate.appendChild(two_col);
        }

        this.root.appendChild(plate);

        if (this.audit_mode === 'audits' && this.deps.params?.startNew === '1') {
            setTimeout(() => {
                if (typeof this.handle_start_new_audit === 'function') {
                    this.handle_start_new_audit();
                }
                try {
                    const base = window.location.pathname + (window.location.search || '');
                    window.history.replaceState(null, '', base + '#audit_audits');
                } catch (e) {
                    /* ignorerar */
                }
            }, 0);
        }

        if (this._api_checked && this.api_available && typeof this._start_list_polling === 'function') {
            this._start_list_polling();
        }
    },

    destroy() {
        this._stop_list_polling?.();
        this.upload_file_input = null;
        this.upload_audit_file_input = null;
        this._auditsTable?.destroy?.();
        this._rulesTable?.destroy?.();
        this._auditListComponent?.destroy?.();
        this.root = null;
        this.deps = null;
    }
};
