// js/components/audit_view/AuditViewComponent.js
import { migrate_rulefile_to_new_structure } from '../../logic/rulefile_migration_logic.js';
import { analyze_rule_file_changes } from '../../logic/rulefile_updater_logic.js';
import { version_greater_than } from '../../utils/version_utils.js';
import {
    check_api_available,
    get_rules,
    get_rule,
    get_audits,
    import_audit,
    delete_rule,
    delete_audit,
    export_rule,
    publish_rule,
    copy_rule,
    publish_production_rule,
    update_rule,
    create_production_rule,
    get_admin_contacts,
    is_current_user_admin
} from '../../api/client.js';
import { subscribe_audits, subscribe_rules } from '../../logic/list_push_service.js';
import { GenericTableComponent } from '../GenericTableComponent.js';
import { AuditListComponent } from '../AuditListComponent.js';
import { create_audit_table_columns } from '../../utils/audit_table_columns.js';
import { create_rule_table_columns } from '../../utils/rule_table_columns.js';
import { open_audit_by_id, download_audit_by_id } from '../../logic/audit_open_logic.js';
import { render_audit_header } from './AuditHeaderSection.js';
import { render_audit_requirement_section } from './AuditRequirementSection.js';
import { render_audit_samples_section } from './AuditSamplesSection.js';
import './audit_view_component.css';

export const AuditViewComponent = {
    CSS_PATH: './audit_view_component.css',

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
        this.audit_filter_query = '';
        this._auditFilterHadFocus = false;
        this._auditFilterSelection = null;
        this._auditFilterInputRef = null;
        this.router = deps.router;
        this.getState = deps.getState;
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
        this.handle_delete_audit_click = this.handle_delete_audit_click.bind(this);
        this.handle_delete_rule_click = this.handle_delete_rule_click.bind(this);
        this.handle_download_audit = this.handle_download_audit.bind(this);
        this.handle_download_rule = this.handle_download_rule.bind(this);
        this.handle_publish_rule = this.handle_publish_rule.bind(this);
        this.handle_copy_rule = this.handle_copy_rule.bind(this);
        this.handle_publish_production_rule = this.handle_publish_production_rule.bind(this);
        this.handle_edit_rule = this.handle_edit_rule.bind(this);
        this.handle_open_audit = this.handle_open_audit.bind(this);
        this.handle_start_new_audit = this.handle_start_new_audit.bind(this);
        this.handle_filter_input = this.handle_filter_input.bind(this);

        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH, 'AuditViewComponent', {
                timeout: 5000,
                maxRetries: 2
            }).catch(() => {
                console.warn('[AuditViewComponent] Continuing without CSS due to loading failure');
            });
        }
        this._unsubscribe_audits = null;
        this._unsubscribe_rules = null;

        this._auditsTable = Object.create(GenericTableComponent);
        await this._auditsTable.init({ deps });
        this._publishedRulesTable = Object.create(GenericTableComponent);
        await this._publishedRulesTable.init({ deps });
        this._draftRulesTable = Object.create(GenericTableComponent);
        await this._draftRulesTable.init({ deps });
        this._auditListComponent = Object.create(AuditListComponent);
        await this._auditListComponent.init({ deps });
        this.draft_rules = [];
    },

    handle_filter_input(event) {
        const target = event && event.target ? event.target : null;
        const value = target ? target.value : '';
        if (this.audit_filter_query === value) return;
        let selectionStart = null;
        let selectionEnd = null;
        if (target && typeof target.selectionStart === 'number' && typeof target.selectionEnd === 'number') {
            selectionStart = target.selectionStart;
            selectionEnd = target.selectionEnd;
        }
        this.audit_filter_query = value;
        this._auditFilterHadFocus = document.activeElement === target;
        this._auditFilterSelection = selectionStart != null && selectionEnd != null
            ? { selectionStart, selectionEnd }
            : null;
        if (this.root) {
            this.render();
        }
    },

    _rule_fingerprint(r) {
        return JSON.stringify({ id: r?.id, updated_at: r?.updated_at, is_published: r?.is_published });
    },

    async _on_audits_changed() {
        if (!this.root || !this.api_available) return;
        try {
            const fresh = await get_audits();
            this.audits = fresh;
            if (this.root) this.render();
        } catch {
            /* tyst vid fel */
        }
    },

    async _on_rules_changed() {
        if (!this.root || !this.api_available) return;
        try {
            const old_published = [...(this.published_rules || [])];
            const old_production = [...(this.production_rules || [])];
            const fresh_rules = await get_rules();
            this.rules = fresh_rules;
            this._split_rules_for_views();
            const new_pub_ids = (this.published_rules || []).map((r) => r.id);
            const new_prod_ids = (this.production_rules || []).map((r) => r.id);
            const old_pub_ids = old_published.map((r) => r.id);
            const old_prod_ids = old_production.map((r) => r.id);
            const pub_same = old_pub_ids.length === new_pub_ids.length && old_pub_ids.every((id, i) => id === new_pub_ids[i]);
            const prod_same = old_prod_ids.length === new_prod_ids.length && old_prod_ids.every((id, i) => id === new_prod_ids[i]);
            if (pub_same && prod_same) {
                const old_pub_map = new Map(old_published.map((r) => [r.id, r]));
                const old_prod_map = new Map(old_production.map((r) => [r.id, r]));
                const changed_pub = (this.published_rules || []).filter((r) => this._rule_fingerprint(r) !== this._rule_fingerprint(old_pub_map.get(r.id)));
                const changed_prod = (this.production_rules || []).filter((r) => this._rule_fingerprint(r) !== this._rule_fingerprint(old_prod_map.get(r.id)));
                changed_pub.forEach((rule) => {
                    this._publishedRulesTable?.updateRow?.(rule.id, rule);
                });
                changed_prod.forEach((rule) => {
                    this._draftRulesTable?.updateRow?.(rule.id, rule);
                });
            } else {
                if (this.root) this.render();
            }
        } catch {
            // Vid t.ex. DOM-avvikelse eller kast i updateRow: fall tillbaka till full render
            if (this.root) this.render();
        }
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
        // Använd list_as_arbetskopia från servern så att uppladdade regler alltid hamnar i Arbetskopior
        // även om is_published skulle skilja sig mellan miljöer (t.ex. cache eller databasskillnader).
        const is_arbetskopia = (r) => r.list_as_arbetskopia === true || (r.list_as_arbetskopia !== false && !r.is_published);
        this.production_rules = all_rules.filter(is_arbetskopia);
        this.published_rules = all_rules.filter((r) => !is_arbetskopia(r));
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

                const raw_content = json_content.content ?? json_content;
                const migrated_content = migrate_rulefile_to_new_structure(raw_content, {
                    Translation: this.Translation
                });
                const rule_validation = this.ValidationLogic?.validate_rule_file_json?.(migrated_content);
                if (rule_validation?.isValid) {
                    await this.ensure_api_data();
                    const file_id =
                        json_content.id ??
                        raw_content?.metadata?.ruleSetId ??
                        migrated_content?.metadata?.ruleSetId ??
                        null;
                    const file_title = (migrated_content?.metadata?.title ?? '').toString().trim();
                    const file_date_modified = migrated_content?.metadata?.dateModified;
                    const uploaded_version = (migrated_content?.metadata?.version ?? '').toString().trim();
                    const matched = this._find_matching_rule(file_id, file_title);
                    if (matched) {
                        let server_updated_at = matched.updated_at;
                        let server_version = (matched.metadata_version ?? '').toString().trim();

                        let production_copy = null;
                        if (matched.production_base_id) {
                            production_copy = matched;
                        } else if (matched.is_published && Array.isArray(this.production_rules) && this.production_rules.length) {
                            production_copy =
                                this.production_rules.find(
                                    (r) => String(r.production_base_id) === String(matched.id)
                                ) || null;
                        }

                        const is_working_copy_row = !matched.is_published;
                        const has_existing_working_copy = is_working_copy_row || !!production_copy;

                        if (has_existing_working_copy) {
                            if (production_copy?.updated_at) {
                                server_updated_at = production_copy.updated_at;
                            }
                            if (production_copy?.metadata_version) {
                                server_version = (production_copy.metadata_version ?? '').toString().trim();
                            }

                            let is_older = false;
                            const has_distinct_versions =
                                uploaded_version && server_version && uploaded_version !== server_version;

                            if (has_distinct_versions) {
                                const uploaded_is_newer = version_greater_than(uploaded_version, server_version);
                                is_older = !uploaded_is_newer;
                            } else {
                                is_older = this._is_uploaded_file_older(file_date_modified, server_updated_at);
                            }

                            const import_options = production_copy?.id
                                ? { target_rule_id: production_copy.id }
                                : { target_rule_id: matched.id };

                            let existing_content = null;
                            const target_rule_id = production_copy?.id ?? matched.id;
                            try {
                                const rule_row = await get_rule(target_rule_id);
                                existing_content = rule_row?.content ?? null;
                            } catch (_) {
                                /* använd null om hämtning misslyckas */
                            }

                            this._show_rulefile_duplicate_modal(
                                is_older,
                                () => {
                                    this._do_import_rule_and_refresh(migrated_content, event, import_options);
                                },
                                () => {
                                    if (event.target) event.target.value = '';
                                },
                                {
                                    server_version,
                                    uploaded_version,
                                    existing_content,
                                    uploaded_content: migrated_content
                                }
                            );
                        } else {
                            await this._do_import_rule_and_refresh(migrated_content, event, {
                                create_production_copy_from_base_id: matched.id
                            });
                        }
                        return;
                    }
                    await this._do_import_rule_and_refresh(migrated_content, event, {
                        create_standalone_production: true
                    });
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

    handle_create_new_rule() {
        const minimal_rulefile = {
            metadata: {
                title: '',
                description: '',
                language: '',
                monitoringType: { text: '' },
                publisher: { name: '', contactPoint: '' },
                source: { url: '', title: '' }
            },
            requirements: {}
        };
        const migrated_content = migrate_rulefile_to_new_structure(minimal_rulefile, {
            Translation: this.Translation
        });
        this.dispatch({
            type: this.StoreActionTypes.INITIALIZE_RULEFILE_EDITING,
            payload: {
                ruleFileContent: migrated_content,
                originalRuleFileContentString: JSON.stringify(migrated_content, null, 2),
                originalRuleFileFilename: '',
                ruleSetId: null,
                ruleFileServerVersion: 0,
                ruleFileIsPublished: false
            }
        });
        this.router('rulefile_metadata_edit', { mode: 'create' });
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
                        modal_instance.close(null, { skipHistoryPop: true });
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

    _find_matching_rule(file_id, file_title) {
        const all_rules = Array.isArray(this.rules) ? this.rules : [];
        let matched = null;
        if (file_id) {
            matched = all_rules.find((r) => String(r.id) === String(file_id));
        }
        if (!matched && file_title) {
            matched = all_rules.find((r) => (r.name || '').trim() === file_title);
        }
        if (!matched) return null;
        const production = all_rules.find(
            (r) => r.production_base_id != null && String(r.production_base_id) === String(matched.id)
        );
        return production || matched;
    },

    _get_rule_display_name(rule_id) {
        const all_rules = Array.isArray(this.rules) ? this.rules : [];
        const r = all_rules.find((row) => String(row.id) === String(rule_id));
        if (!r) return `Regelfil ${rule_id}`;
        const t = this.get_t_func();
        const base = (r.name || `Regelfil ${r.id}`).trim();
        const is_production = !!r.production_base_id;
        if (is_production) return `${base} (${t('rulefile_status_production_label')})`;
        if (r.version_display) return `${base} ${r.version_display} (${t('rulefile_status_published_label')})`;
        return base;
    },

    _get_rule_base_name(rule_id) {
        const all_rules = Array.isArray(this.rules) ? this.rules : [];
        const r = all_rules.find((row) => String(row.id) === String(rule_id));
        if (!r) return `Regelfil ${rule_id}`;
        return (r.name || `Regelfil ${r.id}`).trim();
    },

    _focus_rule_link(rule_id, section) {
        if (!rule_id || !this.root) return;
        const wrapper_id = section === 'draft' ? 'audit-draft-rules-wrapper' : 'audit-published-rules-wrapper';
        const wrapper = this.root.querySelector(`#${wrapper_id}`);
        const link = wrapper?.querySelector(`a.generic-table-audit-link[data-rule-id="${CSS.escape(String(rule_id))}"]`);
        if (link && typeof link.focus === 'function') {
            requestAnimationFrame(() => {
                try {
                    link.focus({ preventScroll: false });
                } catch {
                    link.focus();
                }
            });
        }
    },

    _is_uploaded_file_older(file_date_modified, server_updated_at) {
        if (!file_date_modified || !server_updated_at) return false;
        const file_date = new Date(file_date_modified);
        const server_date = new Date(server_updated_at);
        if (Number.isNaN(file_date.getTime()) || Number.isNaN(server_date.getTime())) return false;
        return file_date.getTime() < server_date.getTime();
    },

    async _do_import_rule_and_refresh(migrated_content, event, options = {}) {
        if (this._importInProgress) return;
        this._importInProgress = true;
        const t = this.get_t_func();
        try {
            const content_to_import = { ...migrated_content };
            if (!content_to_import.metadata) {
                content_to_import.metadata = {};
            }
            if (!content_to_import.metadata.ruleSetId) {
                const uuid = (typeof crypto !== 'undefined' && crypto?.randomUUID ? crypto.randomUUID() : null)
                    || (this.Helpers?.generate_uuid_v4 ? this.Helpers.generate_uuid_v4() : null)
                    || `gen-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
                content_to_import.metadata = { ...content_to_import.metadata, ruleSetId: uuid };
            }
            const name = content_to_import?.metadata?.title?.trim() || 'Importerad regelfil';
            const opts = options || {};

            if (opts.target_rule_id) {
                await update_rule(opts.target_rule_id, { content: content_to_import });
            } else if (opts.create_production_copy_from_base_id) {
                const base_id = opts.create_production_copy_from_base_id;
                const created = await copy_rule(base_id);
                const target_id = created?.id;
                if (!target_id) {
                    throw new Error(t('audit_upload_invalid_file'));
                }
                await update_rule(target_id, { content: content_to_import });
            } else {
                await create_production_rule({
                    name,
                    content: content_to_import
                });
            }

            this.NotificationComponent?.show_global_message(
                t('audit_rule_uploaded_success'),
                'success'
            );
            await this.ensure_api_data();
            this.render();
        } finally {
            this._importInProgress = false;
            if (event?.target) event.target.value = '';
        }
    },

    _show_rulefile_duplicate_modal(is_older, on_upload_anyway, on_close, options = {}) {
        const t = this.get_t_func();
        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) {
            this.NotificationComponent?.show_global_message(t('rulefile_duplicate_modal_title'), 'error');
            if (typeof on_close === 'function') on_close();
            return;
        }
        const message = t('rulefile_duplicate_modal_message');
        const { server_version, uploaded_version, existing_content, uploaded_content } = options || {};
        let diff_report = null;
        if (existing_content && uploaded_content) {
            try {
                diff_report = analyze_rule_file_changes(
                    { ruleFileContent: existing_content },
                    uploaded_content
                );
            } catch (_) {
                diff_report = 'error';
            }
        }
        ModalComponent.show(
            {
                h1_text: t('rulefile_duplicate_modal_title'),
                message_text: message
            },
            (container, modal_instance) => {
                if (server_version || uploaded_version) {
                    const versions_heading = this.Helpers.create_element('h2', {
                        class_name: 'modal-versions-heading',
                        text_content: t('rulefile_duplicate_modal_versions_heading')
                    });
                    container.appendChild(versions_heading);
                    const ul = this.Helpers.create_element('ul', { class_name: 'modal-versions-list' });
                    if (server_version) {
                        const li = this.Helpers.create_element('li');
                        li.appendChild(document.createTextNode(t('rulefile_duplicate_modal_list_current') + ' '));
                        const strong = this.Helpers.create_element('strong', { text_content: server_version });
                        li.appendChild(strong);
                        ul.appendChild(li);
                    }
                    if (uploaded_version) {
                        const li = this.Helpers.create_element('li');
                        li.appendChild(document.createTextNode(t('rulefile_duplicate_modal_list_uploaded') + ' '));
                        const strong = this.Helpers.create_element('strong', { text_content: uploaded_version });
                        li.appendChild(strong);
                        ul.appendChild(li);
                    }
                    container.appendChild(ul);
                }
                if (diff_report !== null) {
                    const diff_heading = this.Helpers.create_element('h2', {
                        class_name: 'modal-diff-heading',
                        text_content: t('rulefile_duplicate_modal_diff_heading')
                    });
                    container.appendChild(diff_heading);
                    if (diff_report === 'error') {
                        const p = this.Helpers.create_element('p', {
                            class_name: 'modal-diff-message',
                            text_content: t('rulefile_duplicate_modal_diff_error')
                        });
                        container.appendChild(p);
                    } else {
                        const has_added = diff_report.added_requirements?.length > 0;
                        const has_removed = diff_report.removed_requirements?.length > 0;
                        const has_updated = diff_report.updated_requirements?.length > 0;
                        if (!has_added && !has_removed && !has_updated) {
                            const p = this.Helpers.create_element('p', {
                                class_name: 'modal-diff-message',
                                text_content: t('rulefile_duplicate_modal_diff_none')
                            });
                            container.appendChild(p);
                        } else {
                            const diff_list = this.Helpers.create_element('ul', { class_name: 'modal-diff-list' });
                            if (has_added) {
                                const li = this.Helpers.create_element('li');
                                const span = this.Helpers.create_element('span', {
                                    text_content: t('rulefile_duplicate_modal_diff_added') + ': '
                                });
                                li.appendChild(span);
                                const sub_ul = this.Helpers.create_element('ul');
                                diff_report.added_requirements.forEach((r) => {
                                    const sub_li = this.Helpers.create_element('li', {
                                        text_content: r.title || r.id || ''
                                    });
                                    sub_ul.appendChild(sub_li);
                                });
                                li.appendChild(sub_ul);
                                diff_list.appendChild(li);
                            }
                            if (has_removed) {
                                const li = this.Helpers.create_element('li');
                                const span = this.Helpers.create_element('span', {
                                    text_content: t('rulefile_duplicate_modal_diff_removed') + ': '
                                });
                                li.appendChild(span);
                                const sub_ul = this.Helpers.create_element('ul');
                                diff_report.removed_requirements.forEach((r) => {
                                    const sub_li = this.Helpers.create_element('li', {
                                        text_content: r.title || r.id || ''
                                    });
                                    sub_ul.appendChild(sub_li);
                                });
                                li.appendChild(sub_ul);
                                diff_list.appendChild(li);
                            }
                            if (has_updated) {
                                const li = this.Helpers.create_element('li');
                                const span = this.Helpers.create_element('span', {
                                    text_content: t('rulefile_duplicate_modal_diff_updated') + ': '
                                });
                                li.appendChild(span);
                                const sub_ul = this.Helpers.create_element('ul');
                                diff_report.updated_requirements.forEach((r) => {
                                    const sub_li = this.Helpers.create_element('li', {
                                        text_content: r.title || r.id || ''
                                    });
                                    sub_ul.appendChild(sub_li);
                                });
                                li.appendChild(sub_ul);
                                diff_list.appendChild(li);
                            }
                            container.appendChild(diff_list);
                        }
                    }
                }
                const what_to_do = this.Helpers.create_element('p', {
                    class_name: 'modal-what-to-do',
                    text_content: t('rulefile_duplicate_modal_what_to_do')
                });
                container.appendChild(what_to_do);
                const buttons_wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const upload_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('rulefile_duplicate_modal_upload_anyway')
                });
                upload_btn.addEventListener('click', async () => {
                    modal_instance.close();
                    if (typeof on_upload_anyway === 'function') await on_upload_anyway();
                });
                const close_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    text_content: t('rulefile_duplicate_modal_close')
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

    _show_publish_rule_confirm_modal(rule_base_name, on_confirm, on_cancel) {
        const t = this.get_t_func();
        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) {
            if (typeof on_cancel === 'function') on_cancel();
            return;
        }
        ModalComponent.show(
            {
                h1_text: t('rulefile_publish_confirm_modal_title'),
                message_text: ''
            },
            (container, modal_instance) => {
                const message_el = container.querySelector('.modal-message');
                if (message_el) {
                    const wrapper = this.Helpers.create_element('div', { class_name: 'modal-message' });
                    const p1 = this.Helpers.create_element('p');
                    p1.appendChild(document.createTextNode(t('rulefile_publish_confirm_modal_para1_before')));
                    const strong = this.Helpers.create_element('strong');
                    strong.textContent = rule_base_name;
                    p1.appendChild(strong);
                    p1.appendChild(document.createTextNode(t('rulefile_publish_confirm_modal_para1_after')));
                    const p2 = this.Helpers.create_element('p', {
                        text_content: t('rulefile_publish_confirm_modal_para2')
                    });
                    wrapper.appendChild(p1);
                    wrapper.appendChild(p2);
                    message_el.replaceWith(wrapper);
                }
                const question_p = this.Helpers.create_element('p', {
                    text_content: t('rulefile_publish_confirm_modal_question')
                });
                container.appendChild(question_p);
                const buttons_wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const confirm_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('rulefile_publish_confirm_modal_confirm_btn')
                });
                confirm_btn.addEventListener('click', async () => {
                    if (typeof on_confirm === 'function') {
                        const result = on_confirm();
                        if (result && typeof result.then === 'function') {
                            await result;
                        }
                    }
                    modal_instance.close();
                });
                const cancel_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    text_content: t('rulefile_publish_confirm_modal_cancel_btn')
                });
                cancel_btn.addEventListener('click', () => {
                    modal_instance.close();
                    if (typeof on_cancel === 'function') on_cancel();
                });
                buttons_wrapper.appendChild(confirm_btn);
                buttons_wrapper.appendChild(cancel_btn);
                container.appendChild(buttons_wrapper);
            }
        );
    },

    _show_publish_with_diff_modal(draft_content, published_content, rule_base_name, on_confirm, on_cancel) {
        const t = this.get_t_func();
        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) {
            if (typeof on_cancel === 'function') on_cancel();
            return;
        }
        let diff_report = null;
        if (published_content && draft_content) {
            try {
                diff_report = analyze_rule_file_changes(
                    { ruleFileContent: published_content },
                    draft_content
                );
            } catch (_) {
                diff_report = 'error';
            }
        }
        ModalComponent.show(
            {
                h1_text: t('rulefile_publish_diff_modal_title'),
                message_text: ''
            },
            (container, modal_instance) => {
                const diff_heading = this.Helpers.create_element('h2', {
                    class_name: 'modal-diff-heading',
                    text_content: t('rulefile_publish_diff_modal_heading')
                });
                container.appendChild(diff_heading);
                if (diff_report === null || diff_report === 'error') {
                    const p = this.Helpers.create_element('p', {
                        class_name: 'modal-diff-message',
                        text_content: diff_report === 'error'
                            ? t('rulefile_duplicate_modal_diff_error')
                            : t('rulefile_duplicate_modal_diff_none')
                    });
                    container.appendChild(p);
                } else {
                    const has_added = diff_report.added_requirements?.length > 0;
                    const has_removed = diff_report.removed_requirements?.length > 0;
                    const has_updated = diff_report.updated_requirements?.length > 0;
                    if (!has_added && !has_removed && !has_updated) {
                        const p = this.Helpers.create_element('p', {
                            class_name: 'modal-diff-message',
                            text_content: t('rulefile_duplicate_modal_diff_none')
                        });
                        container.appendChild(p);
                    } else {
                        const diff_list = this.Helpers.create_element('ul', { class_name: 'modal-diff-list' });
                        if (has_added) {
                            const li = this.Helpers.create_element('li');
                            li.appendChild(this.Helpers.create_element('span', {
                                text_content: t('rulefile_duplicate_modal_diff_added') + ': '
                            }));
                            const sub_ul = this.Helpers.create_element('ul');
                            diff_report.added_requirements.forEach((r) => {
                                sub_ul.appendChild(this.Helpers.create_element('li', {
                                    text_content: r.title || r.id || ''
                                }));
                            });
                            li.appendChild(sub_ul);
                            diff_list.appendChild(li);
                        }
                        if (has_removed) {
                            const li = this.Helpers.create_element('li');
                            li.appendChild(this.Helpers.create_element('span', {
                                text_content: t('rulefile_duplicate_modal_diff_removed') + ': '
                            }));
                            const sub_ul = this.Helpers.create_element('ul');
                            diff_report.removed_requirements.forEach((r) => {
                                sub_ul.appendChild(this.Helpers.create_element('li', {
                                    text_content: r.title || r.id || ''
                                }));
                            });
                            li.appendChild(sub_ul);
                            diff_list.appendChild(li);
                        }
                        if (has_updated) {
                            const li = this.Helpers.create_element('li');
                            li.appendChild(this.Helpers.create_element('span', {
                                text_content: t('rulefile_duplicate_modal_diff_updated') + ': '
                            }));
                            const sub_ul = this.Helpers.create_element('ul');
                            diff_report.updated_requirements.forEach((r) => {
                                sub_ul.appendChild(this.Helpers.create_element('li', {
                                    text_content: r.title || r.id || ''
                                }));
                            });
                            li.appendChild(sub_ul);
                            diff_list.appendChild(li);
                        }
                        container.appendChild(diff_list);
                    }
                }
                const buttons_wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const confirm_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('rulefile_publish_confirm_modal_confirm_btn')
                });
                confirm_btn.addEventListener('click', async () => {
                    modal_instance.close();
                    if (typeof on_confirm === 'function') {
                        const result = on_confirm();
                        if (result && typeof result.then === 'function') await result;
                    }
                });
                const cancel_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    text_content: t('rulefile_publish_confirm_modal_cancel_btn')
                });
                cancel_btn.addEventListener('click', () => {
                    modal_instance.close();
                    if (typeof on_cancel === 'function') on_cancel();
                });
                buttons_wrapper.appendChild(confirm_btn);
                buttons_wrapper.appendChild(cancel_btn);
                container.appendChild(buttons_wrapper);
            }
        );
    },

    _show_publish_standalone_modal(rule_base_name, on_confirm, on_cancel) {
        const t = this.get_t_func();
        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) {
            if (typeof on_cancel === 'function') on_cancel();
            return;
        }
        ModalComponent.show(
            {
                h1_text: t('rulefile_publish_standalone_modal_title'),
                message_text: t('rulefile_publish_standalone_modal_message')
            },
            (container, modal_instance) => {
                const buttons_wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const confirm_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('rulefile_publish_confirm_modal_confirm_btn')
                });
                confirm_btn.addEventListener('click', async () => {
                    modal_instance.close();
                    if (typeof on_confirm === 'function') {
                        const result = on_confirm();
                        if (result && typeof result.then === 'function') await result;
                    }
                });
                const cancel_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    text_content: t('rulefile_publish_confirm_modal_cancel_btn')
                });
                cancel_btn.addEventListener('click', () => {
                    modal_instance.close();
                    if (typeof on_cancel === 'function') on_cancel();
                });
                buttons_wrapper.appendChild(confirm_btn);
                buttons_wrapper.appendChild(cancel_btn);
                container.appendChild(buttons_wrapper);
            }
        );
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
            if (error.status === 409 && error.responseBody?.inUseCount != null) {
                const rule_name = this._get_rule_base_name(rule_id);
                this._show_rule_in_use_modal(rule_name, error.responseBody.inUseCount);
            } else if (error.status === 409 && error.responseBody?.productionCopyCount != null) {
                const rule_name = this._get_rule_base_name(rule_id);
                this._show_rule_has_production_copies_modal(rule_name, error.responseBody.productionCopyCount);
            } else if (error.status === 403) {
                this.NotificationComponent?.show_global_message(
                    t('audit_delete_rule_forbidden_admin'),
                    'error'
                );
            } else {
                this.NotificationComponent?.show_global_message(
                    error.message || t('audit_delete_error'),
                    'error'
                );
            }
        }
    },

    _show_rule_in_use_modal(rule_name, in_use_count) {
        const t = this.get_t_func();
        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) return;
        ModalComponent.show(
            {
                h1_text: t('audit_rule_in_use_modal_title'),
                message_text: ''
            },
            (container, modal_instance) => {
                const p = this.Helpers.create_element('p');
                p.appendChild(document.createTextNode(t('audit_rule_in_use_modal_prefix')));
                const strong_title = this.Helpers.create_element('strong', { text_content: rule_name });
                p.appendChild(strong_title);
                p.appendChild(document.createTextNode(t('audit_rule_in_use_modal_used')));
                const strong_count = this.Helpers.create_element('strong', { text_content: String(in_use_count) });
                p.appendChild(strong_count);
                p.appendChild(document.createTextNode(t('audit_rule_in_use_modal_suffix')));
                container.appendChild(p);
                const btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('audit_rule_in_use_modal_understand'),
                    attributes: { type: 'button' }
                });
                btn.addEventListener('click', () => modal_instance.close());
                const wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                wrapper.appendChild(btn);
                container.appendChild(wrapper);
            }
        );
    },

    _show_rule_has_production_copies_modal(rule_name, production_copy_count) {
        const t = this.get_t_func();
        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) {
            this.NotificationComponent?.show_global_message(
                t('audit_rule_has_copies_modal_title') + ' ' + t('audit_rule_has_copies_modal_suffix', { count: production_copy_count }),
                'error'
            );
            return;
        }
        ModalComponent.show(
            {
                h1_text: t('audit_rule_has_copies_modal_title'),
                message_text: ''
            },
            (container, modal_instance) => {
                const p = this.Helpers.create_element('p');
                p.appendChild(document.createTextNode(t('audit_rule_has_copies_modal_prefix')));
                const strong_title = this.Helpers.create_element('strong', { text_content: rule_name });
                p.appendChild(strong_title);
                p.appendChild(document.createTextNode(t('audit_rule_has_copies_modal_used')));
                const strong_count = this.Helpers.create_element('strong', { text_content: String(production_copy_count) });
                p.appendChild(strong_count);
                p.appendChild(document.createTextNode(t('audit_rule_has_copies_modal_suffix_plain')));
                container.appendChild(p);
                const btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('audit_rule_in_use_modal_understand'),
                    attributes: { type: 'button' }
                });
                btn.addEventListener('click', () => modal_instance.close());
                const wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                wrapper.appendChild(btn);
                container.appendChild(wrapper);
            }
        );
    },

    handle_publish_rule(rule_id) {
        const rule_base_name = this._get_rule_base_name(rule_id);
        this._show_publish_rule_confirm_modal(
            rule_base_name,
            () => this._do_publish_rule(rule_id),
            () => {}
        );
    },

    async _do_publish_rule(rule_id) {
        if (this._publishInProgress) return;
        this._publishInProgress = true;
        const t = this.get_t_func();
        try {
            await publish_rule(rule_id);
            this.NotificationComponent?.show_global_message(
                t('rulefile_publish_success'),
                'success'
            );
            await this.ensure_api_data();
            this.render();
            this._focus_rule_link(rule_id, 'published');
        } catch (error) {
            this.NotificationComponent?.show_global_message(
                error.message || t('rulefile_publish_error'),
                'error'
            );
        } finally {
            this._publishInProgress = false;
        }
    },

    async handle_copy_rule(rule_id) {
        if (this._copyInProgress) return;
        this._copyInProgress = true;
        const t = this.get_t_func();
        const COPY_ANIMATION_MS = 250;
        let button_rect = null;
        const published_wrapper = this.root?.querySelector('#audit-published-rules-wrapper');
        const link_el = published_wrapper?.querySelector(`a.generic-table-audit-link[data-rule-id="${CSS.escape(String(rule_id))}"]`);
        const copy_button = link_el?.closest('tr')?.querySelector('button.generic-table-edit-btn');
        if (copy_button) {
            button_rect = copy_button.getBoundingClientRect();
        }
        try {
            const created = await copy_rule(rule_id);
            await this.ensure_api_data();
            let clone_el = null;
            if (button_rect && copy_button) {
                clone_el = copy_button.cloneNode(true);
                clone_el.classList.add('audit-copy-button-fade-out');
                clone_el.setAttribute('aria-hidden', 'true');
                clone_el.style.cssText = `position:fixed;left:${button_rect.left}px;top:${button_rect.top}px;width:${button_rect.width}px;height:${button_rect.height}px;z-index:9999;margin:0;`;
                document.body.appendChild(clone_el);
            }
            this.render();
            const draft_wrapper = this.root?.querySelector('#audit-draft-rules-wrapper');
            const new_link = draft_wrapper?.querySelector(`a.generic-table-audit-link[data-rule-id="${CSS.escape(String(created?.id || ''))}"]`);
            const new_row = new_link?.closest('tr');
            if (new_row) {
                new_row.classList.add('audit-copy-row-fade-in');
                new_row.style.opacity = '0';
            }
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (clone_el) clone_el.style.opacity = '0';
                    if (new_row) new_row.style.opacity = '1';
                    setTimeout(() => {
                        if (clone_el?.parentNode) clone_el.parentNode.removeChild(clone_el);
                        if (created?.id) {
                            this._focus_rule_link(created.id, 'draft');
                        }
                    }, COPY_ANIMATION_MS);
                });
            });
        } catch (error) {
            this.NotificationComponent?.show_global_message(
                error.message || t('audit_load_rule_error'),
                'error'
            );
        } finally {
            this._copyInProgress = false;
        }
    },

    async handle_publish_production_rule(rule_id) {
        const t = this.get_t_func();
        let rule_row = null;
        try {
            rule_row = await get_rule(rule_id);
        } catch (_) {
            this.NotificationComponent?.show_global_message(
                t('rulefile_publish_error'),
                'error'
            );
            return;
        }
        const draft_content = rule_row?.content ?? null;
        const base_id = rule_row?.production_base_id ?? null;
        const rule_base_name = this._get_rule_base_name(rule_id);

        if (base_id && draft_content) {
            let published_content = null;
            try {
                const base_row = await get_rule(base_id);
                published_content = base_row?.published_content ?? base_row?.content ?? null;
            } catch (_) {
                published_content = null;
            }
            this._show_publish_with_diff_modal(
                draft_content,
                published_content,
                rule_base_name,
                () => this._do_publish_production_rule(rule_id),
                () => {}
            );
        } else {
            this._show_publish_standalone_modal(
                rule_base_name,
                () => this._do_publish_rule(rule_id),
                () => {}
            );
        }
    },

    async _do_publish_production_rule(rule_id) {
        if (this._publishProductionInProgress) return;
        this._publishProductionInProgress = true;
        const t = this.get_t_func();
        try {
            const result = await publish_production_rule(rule_id);
            this.NotificationComponent?.show_global_message(
                t('rulefile_publish_success'),
                'success'
            );
            await this.ensure_api_data();
            this.render();
            const focus_id = result?.base?.id ?? rule_id;
            this._focus_rule_link(focus_id, 'published');
        } catch (error) {
            this.NotificationComponent?.show_global_message(
                error.message || t('rulefile_publish_error'),
                'error'
            );
        } finally {
            this._publishProductionInProgress = false;
        }
    },

    handle_delete_audit_click(audit_id, audit_display_name, delete_button) {
        const t = this.get_t_func();
        if (!is_current_user_admin()) {
            this._show_contact_admin_modal('audit');
            return;
        }
        const show_modal = window.show_confirm_delete_modal;
        if (show_modal && delete_button) {
            show_modal({
                h1_text: t('audit_confirm_delete_audit_title'),
                warning_text: t('audit_confirm_delete_audit_warning', { name: audit_display_name }),
                delete_button,
                yes_label: t('audit_confirm_delete_radera'),
                no_label: t('audit_confirm_delete_behall'),
                on_confirm: () => this.handle_delete_audit(audit_id)
            });
        } else {
            this.handle_delete_audit(audit_id);
        }
    },

    handle_delete_rule_click(rule_id, rule_display_name, delete_button) {
        const t = this.get_t_func();
        if (!is_current_user_admin()) {
            this._show_contact_admin_modal('rule');
            return;
        }
        const show_modal = window.show_confirm_delete_modal;
        if (show_modal && delete_button) {
            show_modal({
                h1_text: t('audit_confirm_delete_rule_title'),
                warning_text: t('audit_confirm_delete_rule_warning', { name: rule_display_name }),
                delete_button,
                yes_label: t('audit_confirm_delete_radera'),
                no_label: t('audit_confirm_delete_behall'),
                on_confirm: () => this.handle_delete_rule(rule_id)
            });
        } else {
            this.handle_delete_rule(rule_id);
        }
    },

    async _show_contact_admin_modal(type) {
        const t = this.get_t_func();
        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) return;
        const title_key = type === 'audit' ? 'delete_contact_admin_title_audit' : 'delete_contact_admin_title_rule';
        const message_key = type === 'audit' ? 'delete_contact_admin_message_audit' : 'delete_contact_admin_message_rule';
        let admins = [];
        let fetched = false;
        try {
            const result = await get_admin_contacts();
            admins = result?.list ?? [];
            fetched = result?.fetched ?? false;
        } catch (_) {
            admins = [];
        }
        const admin_names = Array.isArray(admins)
            ? admins.map((a) => (a?.name || a?.username || '').trim()).filter(Boolean)
            : [];
        const fallback_message = fetched
            ? t('delete_contact_admin_list_empty')
            : t('delete_contact_admin_list_unavailable');
        ModalComponent.show(
            {
                h1_text: t(title_key),
                message_text: t(message_key)
            },
            (container, modal_instance) => {
                if (admin_names.length > 0) {
                    const heading = this.Helpers.create_element('p', {
                        class_name: 'delete-contact-admin-heading',
                        text_content: t('delete_contact_admin_admins_heading')
                    });
                    container.appendChild(heading);
                    const list = this.Helpers.create_element('ul', { class_name: 'delete-contact-admin-list' });
                    admin_names.forEach((name) => {
                        const li = this.Helpers.create_element('li', { text_content: name });
                        list.appendChild(li);
                    });
                    container.appendChild(list);
                } else {
                    const fallback_p = this.Helpers.create_element('p', {
                        class_name: 'delete-contact-admin-fallback',
                        text_content: fallback_message
                    });
                    container.appendChild(fallback_p);
                }
                const ok_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('delete_contact_admin_ok'),
                    attributes: { type: 'button' }
                });
                ok_btn.addEventListener('click', () => modal_instance.close());
                const wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                wrapper.appendChild(ok_btn);
                container.appendChild(wrapper);
            }
        );
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
            const is_arbetskopia = !!rule_row?.production_base_id || rule_row?.published_content == null;
            if (is_arbetskopia) {
                if (!migrated_content?.metadata || typeof migrated_content.metadata !== 'object') {
                    this.NotificationComponent?.show_global_message(
                        t('rule_file_invalid_json'),
                        'error'
                    );
                    return;
                }
                if (!migrated_content.requirements || typeof migrated_content.requirements !== 'object') {
                    migrated_content.requirements = {};
                }
            } else {
                const validation_result = this.ValidationLogic?.validate_rule_file_json?.(migrated_content);
                if (!validation_result?.isValid) {
                    this.NotificationComponent?.show_global_message(
                        validation_result?.message || t('rule_file_invalid_json'),
                        'error'
                    );
                    return;
                }
            }
            const migrated_content_string = JSON.stringify(migrated_content, null, 2);
            this.dispatch({
                type: this.StoreActionTypes.INITIALIZE_RULEFILE_EDITING,
                payload: {
                    ruleFileContent: migrated_content,
                    originalRuleFileContentString: migrated_content_string,
                    originalRuleFileFilename: rule_row?.name || `regelfil_${rule_id}.json`,
                    ruleSetId: rule_id,
                    ruleFileServerVersion: rule_row?.version ?? 0,
                    ruleFileIsPublished: !is_arbetskopia
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
            // Om vi just nu redigerar denna regelfil som arbetskopia:
            // synka innehållet till servern först så att updated_at speglar "senast ändrad".
            const current_state = typeof this.getState === 'function' ? this.getState() : null;
            const is_editing_current_rule =
                current_state?.auditStatus === 'rulefile_editing' &&
                current_state?.ruleSetId === rule_id &&
                current_state?.ruleFileContent;

            if (is_editing_current_rule) {
                try {
                    await update_rule(rule_id, { content: current_state.ruleFileContent });
                } catch (sync_err) {
                    if (show_msg) {
                        const msg =
                            t('server_sync_error', { message: sync_err.message }) ||
                            `Kunde inte spara regelfilen: ${sync_err.message}`;
                        show_msg(msg, 'error');
                    }
                    // Fortsätt ändå och försök exportera nuvarande serverversion.
                }
            }

            const rule = await export_rule(rule_id);
            if (!rule || !rule.content) {
                if (show_msg) show_msg(t('error_internal'), 'error');
                return;
            }
            const json_string = JSON.stringify(rule, null, 2);
            const blob = new Blob([json_string], { type: 'application/json' });
            const safe_name = (rule.name || 'regelfil').replace(/[\s\\/:*?"<>|]/g, '_').trim() || 'regelfil';

            let version_suffix = '';
            let content_obj = rule.content;
            if (typeof content_obj === 'string') {
                try {
                    content_obj = JSON.parse(content_obj);
                } catch {
                    content_obj = null;
                }
            }

            const meta_version = content_obj?.metadata?.version
                ? String(content_obj.metadata.version).trim()
                : '';

            if (rule.is_published && meta_version) {
                // Publicerad: använd befintligt år.månad.rX-system i suffix, med understreck.
                const safe_version = meta_version.replace(/[^0-9A-Za-z]+/g, '_');
                version_suffix = `_${safe_version}`;
            } else if (!rule.is_published) {
                // Arbetskopia: använd serverns updated_at = när innehållet (krav, metadata osv) senast uppdaterades.
                const ts = rule.updated_at;
                const dt = ts ? new Date(ts) : new Date();
                if (!Number.isNaN(dt.getTime())) {
                    const yyyy = dt.getFullYear();
                    const mm = String(dt.getMonth() + 1).padStart(2, '0');
                    const dd = String(dt.getDate()).padStart(2, '0');
                    const hh = String(dt.getHours()).padStart(2, '0');
                    const mi = String(dt.getMinutes()).padStart(2, '0');
                    const label = t('rulefile_status_production_label') || 'Arbetskopia';
                    const safe_label = String(label).replace(/[^0-9A-Za-z]+/g, '_');
                    version_suffix = `_${safe_label}_${yyyy}-${mm}-${dd}_${hh}${mi}`;
                }
            }

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

        if (this.NotificationComponent?.append_global_message_areas_to) {
            this.NotificationComponent.append_global_message_areas_to(plate);
        }

        this._auditFilterInputRef = null;

        const header = render_audit_header(this);
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
        const left_col = render_audit_requirement_section(this);
        const right_col = render_audit_samples_section(this);

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

        if (this.audit_mode === 'audits' && this._auditFilterHadFocus && this._auditFilterInputRef) {
            const input = this._auditFilterInputRef;
            const selection = this._auditFilterSelection;
            setTimeout(() => {
                if (!input || !document.contains(input)) return;
                try {
                    input.focus({ preventScroll: true });
                } catch {
                    input.focus();
                }
                if (selection && typeof input.setSelectionRange === 'function') {
                    try {
                        input.setSelectionRange(selection.selectionStart, selection.selectionEnd);
                    } catch {
                        /* ignorerar */
                    }
                }
            }, 0);
        }
        this._auditFilterHadFocus = false;
        this._auditFilterSelection = null;

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

        if (this._api_checked && this.api_available) {
            if (!this._unsubscribe_audits) {
                this._unsubscribe_audits = subscribe_audits(() => this._on_audits_changed());
            }
            if (!this._unsubscribe_rules) {
                this._unsubscribe_rules = subscribe_rules(() => this._on_rules_changed());
            }
        }
    },

    destroy() {
        if (typeof this._unsubscribe_audits === 'function') {
            this._unsubscribe_audits();
            this._unsubscribe_audits = null;
        }
        if (typeof this._unsubscribe_rules === 'function') {
            this._unsubscribe_rules();
            this._unsubscribe_rules = null;
        }
        this.upload_file_input = null;
        this.upload_audit_file_input = null;
        this._auditsTable?.destroy?.();
        this._publishedRulesTable?.destroy?.();
        this._draftRulesTable?.destroy?.();
        this._auditListComponent?.destroy?.();
        this.root = null;
        this.deps = null;
    }
};
