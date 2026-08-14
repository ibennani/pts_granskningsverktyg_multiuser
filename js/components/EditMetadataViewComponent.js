import { MetadataFormComponent } from './MetadataFormComponent.js';
import { get_current_user_name } from '../utils/helpers.js';
import { load_metadata_auditor_options } from '../logic/metadata_auditor_name_field.js';
import { load_metadata_case_handler_options } from '../logic/metadata_case_handler_field.js';
import { sync_to_server_now } from '../logic/server_sync.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import {
    count_timestamps_after_end_date,
    total_clamp_count
} from '../logic/audit_clamp_activity_to_end_date.js';
import { get_rules, get_rule } from '../api/client.js';
import { version_greater_than } from '../utils/version_utils.js';
import { migrate_rulefile_to_new_structure } from '../logic/rulefile_migration_logic.js';
import {
    build_published_monitoring_rule_options,
    find_monitoring_option_by_key,
    resolve_metadata_form_monitoring_key
} from '../logic/published_monitoring_rule_options.js';
import { load_published_rule_content } from '../logic/new_audit_rule_loader.js';
import {
    build_empty_new_audit_metadata_form_data,
    new_audit_metadata_differs_from_reference_form
} from '../logic/new_audit_empty_metadata.js';
import { should_skip_draft_restore_for_view } from '../logic/draft_restore_policy.js';
import { DraftManager } from '../draft_manager.js';

export class EditMetadataViewComponent {
    constructor() {
        this.root = null;
        this.deps = null;
        this.router = null;
        this.getState = null;
        this.dispatch = null;
        this.StoreActionTypes = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
        this.metadata_form_container_element = null;
        this.metadata_form_component_instance = MetadataFormComponent;
        this.RETURN_FOCUS_SESSION_KEY = 'gv_return_focus_audit_info_h2_v1';
    }

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
        this.AuditLogic = deps.AuditLogic;
        this.ValidationLogic = deps.ValidationLogic || (typeof window !== 'undefined' ? window.ValidationLogic : null);
        this.monitoring_type_options = [];
        this._monitoring_type_change_in_progress = false;
        this._monitoring_type_confirmed_by_user = false;
        /** Regelfil enbart för formuläret – sparas inte i state förrän metadata sparas. */
        this._form_only_rule_file_content = null;
        this._form_only_rule_set_id = null;
        this._form_pending_monitoring_key = '';
        /** Avbryter inaktuella async render()-anrop (samma mönster som RulefileSectionsViewComponent). */
        this._render_generation = 0;
        
        this.metadata_form_container_element = null;

        this.handle_form_submit = this.handle_form_submit.bind(this);
        this.handle_cancel = this.handle_cancel.bind(this);
        this.handle_cancel_new_audit = this.handle_cancel_new_audit.bind(this);
        this.handle_go_to_list = this.handle_go_to_list.bind(this);
        this.handle_monitoring_type_change = this.handle_monitoring_type_change.bind(this);
    }

    _get_validation_logic() {
        return this.ValidationLogic || (typeof window !== 'undefined' ? window.ValidationLogic : null);
    }

    async _build_monitoring_type_options() {
        if (this.monitoring_type_options.length > 0) {
            return this.monitoring_type_options;
        }
        const t = this.Translation.t;
        try {
            const rules = await get_rules();
            this.monitoring_type_options = build_published_monitoring_rule_options(
                rules,
                version_greater_than,
                t
            );
        } catch {
            this.monitoring_type_options = [];
        }
        return this.monitoring_type_options;
    }

    async _ensure_new_audit_has_rule_file() {
        const options = await this._build_monitoring_type_options();
        if (options.length === 0) {
            this.NotificationComponent?.show_global_message(this.Translation.t('server_no_rules'), 'error');
            this.router('start', { allow_new_audit_exit: '1' });
            return false;
        }
        return true;
    }

    _should_defer_rule_load_until_metadata_save() {
        const state = this.getState();
        return state.auditStatus === 'not_started' && !state.ruleFileContent;
    }

    async _load_form_only_rule_for_monitoring_key(monitoring_key) {
        const key = String(monitoring_key ?? '').trim();
        if (!key) {
            this._form_only_rule_file_content = null;
            this._form_only_rule_set_id = null;
            this._form_pending_monitoring_key = '';
            return null;
        }
        const option = find_monitoring_option_by_key(this.monitoring_type_options, key);
        if (!option) return null;
        if (
            this._form_only_rule_set_id === option.rule_id
            && this._form_only_rule_file_content
        ) {
            this._form_pending_monitoring_key = key;
            return this._form_only_rule_file_content;
        }
        const loaded = await load_published_rule_content(option.rule_id, {
            get_rule,
            migrate: migrate_rulefile_to_new_structure,
            validate: (content) => this._get_validation_logic()?.validate_rule_file_json?.(content) ?? { isValid: false },
            Translation: this.Translation
        });
        if (!loaded.ok) {
            this.NotificationComponent?.show_global_message(loaded.error, 'error');
            return null;
        }
        this._form_only_rule_file_content = loaded.content;
        this._form_only_rule_set_id = loaded.rule_id;
        this._form_pending_monitoring_key = key;
        return loaded.content;
    }

    async _load_rule_for_metadata_submit() {
        const monitoring_key =
            this.metadata_form_component_instance.monitoring_type_field_handles?.get_selected_monitoring_key?.()
            || this._form_pending_monitoring_key
            || '';
        const option = find_monitoring_option_by_key(this.monitoring_type_options, monitoring_key);
        if (!option) {
            this.NotificationComponent?.show_global_message(
                this.Translation.t('audit_load_rule_error'),
                'error'
            );
            return null;
        }
        const loaded = await load_published_rule_content(option.rule_id, {
            get_rule,
            migrate: migrate_rulefile_to_new_structure,
            validate: (content) => this._get_validation_logic()?.validate_rule_file_json?.(content) ?? { isValid: false },
            Translation: this.Translation
        });
        if (!loaded.ok) {
            this.NotificationComponent?.show_global_message(
                loaded.error || this.Translation.t('audit_load_rule_error'),
                'error'
            );
            return null;
        }
        return loaded;
    }

    async handle_monitoring_type_change(monitoring_key) {
        if (this._monitoring_type_change_in_progress) return;
        const monitoring_key_trimmed = String(monitoring_key ?? '').trim();
        if (!monitoring_key_trimmed) return;
        const option = find_monitoring_option_by_key(this.monitoring_type_options, monitoring_key_trimmed);
        if (!option) return;

        this._monitoring_type_change_in_progress = true;
        try {
            if (this._should_defer_rule_load_until_metadata_save()) {
                this.metadata_form_component_instance.autosave_session?.flush({
                    should_trim: true,
                    skip_render: true
                });
                const form_data = this.metadata_form_component_instance.collect_current_form_data(true);
                await this.dispatch({
                    type: this.StoreActionTypes.UPDATE_METADATA,
                    payload: {
                        ...form_data,
                        auditTypeId: '',
                        auditTypeLabel: '',
                        skip_render: true,
                        skip_server_sync: true,
                        preserve_fresh_new_audit_metadata: true
                    }
                });
                const form_rule = await this._load_form_only_rule_for_monitoring_key(monitoring_key_trimmed);
                if (!form_rule) return;
                this.metadata_form_component_instance.rule_file_content_ref = form_rule;
                this.metadata_form_component_instance.refresh_rule_dependent_fields(
                    form_rule,
                    '',
                    true,
                    false
                );
                const monitoring_select =
                    this.metadata_form_component_instance.monitoring_type_field_handles?.select_element;
                if (monitoring_select) {
                    monitoring_select.value = monitoring_key_trimmed;
                }
                return;
            }

            this._monitoring_type_confirmed_by_user = true;
            this.metadata_form_component_instance.autosave_session?.flush({
                should_trim: true,
                skip_render: true
            });
            const form_data = this.metadata_form_component_instance.collect_current_form_data(true);
            await this.dispatch({
                type: this.StoreActionTypes.UPDATE_METADATA,
                payload: {
                    ...form_data,
                    auditTypeId: '',
                    auditTypeLabel: '',
                    skip_render: true
                }
            });

            const loaded = await load_published_rule_content(option.rule_id, {
                get_rule,
                migrate: migrate_rulefile_to_new_structure,
                validate: (content) => this._get_validation_logic()?.validate_rule_file_json?.(content) ?? { isValid: false },
                Translation: this.Translation
            });
            if (!loaded.ok) {
                this.NotificationComponent?.show_global_message(loaded.error, 'error');
                return;
            }

            const current_state = this.getState();
            const rule_action_type = current_state.ruleFileContent
                ? this.StoreActionTypes.UPDATE_NEW_AUDIT_RULEFILE
                : this.StoreActionTypes.INITIALIZE_NEW_AUDIT;

            await this.dispatch({
                type: rule_action_type,
                payload: {
                    ruleFileContent: loaded.content,
                    ruleSetId: loaded.rule_id,
                    skip_render: true
                }
            });

            const next_state = this.getState();
            this.metadata_form_component_instance.refresh_rule_dependent_fields(
                next_state.ruleFileContent,
                next_state.auditMetadata?.auditTypeId ?? '',
                true
            );
            const monitoring_select =
                this.metadata_form_component_instance.monitoring_type_field_handles?.select_element;
            if (monitoring_select) {
                monitoring_select.value = monitoring_key_trimmed;
            }
        } finally {
            this._monitoring_type_change_in_progress = false;
        }
    }

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
    }

    async _ensure_global_rule_for_new_audit() {
        const state = this.getState();
        if (state.auditStatus !== 'not_started' || state.ruleFileContent) {
            return true;
        }
        const loaded = await this._load_rule_for_metadata_submit();
        if (!loaded) return false;
        try {
            await this.dispatch({
                type: this.StoreActionTypes.INITIALIZE_NEW_AUDIT,
                payload: {
                    ruleFileContent: loaded.content,
                    ruleSetId: loaded.rule_id,
                    skip_render: true
                }
            });
        } catch (error) {
            this.NotificationComponent?.show_global_message(
                error?.message || this.Translation.t('audit_load_rule_error'),
                'error'
            );
            return false;
        }
        this._form_only_rule_file_content = null;
        this._form_only_rule_set_id = null;
        this._form_pending_monitoring_key = '';
        return true;
    }

    async _submit_metadata(form_data) {
        const state_before = this.getState();
        if (state_before.auditStatus === 'not_started' && !state_before.ruleFileContent) {
            const rule_ready = await this._ensure_global_rule_for_new_audit();
            if (!rule_ready) return;
        }

        await this.dispatch({
            type: this.StoreActionTypes.UPDATE_METADATA,
            payload: {
                ...form_data,
                ...(state_before.auditStatus === 'not_started'
                    ? { clear_fresh_new_audit_metadata: true }
                    : {})
            }
        });
        if (window.DraftManager?.commitCurrentDraft) {
            window.DraftManager.commitCurrentDraft();
        }

        const current_status = this.getState().auditStatus;

        if (current_status === 'not_started') {
            this.router('sample_management');
        } else {
            try {
                await sync_to_server_now(this.getState, this.dispatch);
            } catch (err) {
                // Fel visas redan av run_sync via NotificationComponent
            }
            this.NotificationComponent.show_global_message(this.Translation.t('metadata_updated_successfully'), 'success');
            this._request_focus_on_audit_info_h2();
            this.router('audit_overview');
        }
    }

    _show_end_date_clamp_modal(form_data, counts, on_proceed) {
        const ModalComponent = app_runtime_refs.modal_component;
        if (!ModalComponent?.show || !this.Helpers?.create_element) {
            if (typeof on_proceed === 'function') on_proceed();
            return;
        }
        const t = this.Translation.t;
        const message_text = t('metadata_end_date_clamp_modal_message', {
            click_count: counts.click_count,
            requirement_count: counts.requirement_count,
            frozen_count: counts.frozen_count
        });

        ModalComponent.show(
            {
                h1_text: t('metadata_end_date_clamp_modal_title'),
                message_text
            },
            (container, modal_instance) => {
                const buttons_wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const stay_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    text_content: t('metadata_end_date_clamp_modal_stay_button')
                });
                stay_btn.addEventListener('click', () => modal_instance.close());
                const confirm_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    html_content: this.Helpers.build_save_button_html_content(
                        t('metadata_end_date_clamp_modal_confirm_button')
                    )
                });
                confirm_btn.addEventListener('click', () => {
                    modal_instance.close(null, { skipHistoryPop: true });
                    if (typeof on_proceed === 'function') on_proceed();
                });
                buttons_wrapper.appendChild(stay_btn);
                buttons_wrapper.appendChild(confirm_btn);
                container.appendChild(buttons_wrapper);
            }
        );
    }

    async handle_form_submit(form_data) {
        if (form_data?.endTime) {
            const counts = count_timestamps_after_end_date(this.getState(), form_data.endTime);
            if (total_clamp_count(counts) > 0) {
                this._show_end_date_clamp_modal(form_data, counts, () => this._submit_metadata(form_data));
                return;
            }
        }
        await this._submit_metadata(form_data);
    }

    handle_cancel() {
        this._request_focus_on_audit_info_h2();
        this.router('audit_overview');
    }

    handle_cancel_new_audit() {
        this.router('start', { allow_new_audit_exit: '1' });
    }

    _is_metadata_empty_or_only_auditor(form_data) {
        if (!form_data) return true;
        const has = (v) => (v !== null && v !== undefined && String(v).trim() !== '');
        const optional_filled = [
            form_data.caseNumber,
            form_data.actorLink,
            form_data.caseHandler,
            form_data.internalComment
        ].some(has);
        return !optional_filled;
    }

    _has_required_metadata(form_data) {
        if (!form_data) return false;
        const has = (v) => (v !== null && v !== undefined && String(v).trim() !== '');
        return has(form_data.actorName) && has(form_data.auditorName);
    }

    _show_required_fields_modal(form_data, source, on_proceed) {
        const ModalComponent = app_runtime_refs.modal_component;
        if (!ModalComponent?.show || !this.Helpers?.create_element) {
            if (typeof on_proceed === 'function') on_proceed();
            return;
        }
        const t = this.Translation.t;
        const has = (v) => (v !== null && v !== undefined && String(v).trim() !== '');
        const missing_actor = !has(form_data?.actorName);
        const missing_auditor = !has(form_data?.auditorName);
        const from_list = source === 'go_to_list';
        const suffix = from_list ? '_from_list' : '';
        let message_key = `metadata_required_fields_modal_message${suffix}`;
        if (missing_actor && missing_auditor) {
            message_key = `metadata_required_fields_modal_message${suffix}`;
        } else if (missing_actor) {
            message_key = `metadata_required_fields_modal_message_actor${suffix}`;
        } else {
            message_key = `metadata_required_fields_modal_message_auditor${suffix}`;
        }
        const actor_label = t('actor_name');
        const auditor_label = t('auditor_name');
        let message_html = t(message_key);
        message_html = message_html.replace(actor_label, `<strong>${this.Helpers.escape_html(actor_label)}</strong>`);
        message_html = message_html.replace(auditor_label, `<strong>${this.Helpers.escape_html(auditor_label)}</strong>`);

        ModalComponent.show(
            {
                h1_text: t('metadata_required_fields_modal_title'),
                message_text: ''
            },
            (container, modal_instance) => {
                const message_el = container.querySelector('.modal-message');
                if (message_el) message_el.innerHTML = message_html;
                const buttons_wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const stay_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('metadata_empty_warning_stay_button')
                });
                stay_btn.addEventListener('click', () => modal_instance.close());
                const list_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    text_content: t('metadata_empty_warning_continue_to_list_button')
                });
                list_btn.addEventListener('click', () => {
                    modal_instance.close(null, { skipHistoryPop: true });
                    if (typeof on_proceed === 'function') on_proceed();
                });
                buttons_wrapper.appendChild(stay_btn);
                buttons_wrapper.appendChild(list_btn);
                container.appendChild(buttons_wrapper);
            }
        );
    }

    _do_go_to_list() {
        this.router('start', { allow_new_audit_exit: '1' });
    }

    async _save_and_go_to_list(form_data) {
        const state_before = this.getState();
        if (state_before.auditStatus === 'not_started' && !state_before.ruleFileContent) {
            const rule_ready = await this._ensure_global_rule_for_new_audit();
            if (!rule_ready) return;
        }
        await this.dispatch({
            type: this.StoreActionTypes.UPDATE_METADATA,
            payload: {
                ...form_data,
                clear_fresh_new_audit_metadata: true
            }
        });
        if (window.DraftManager?.commitCurrentDraft) {
            window.DraftManager.commitCurrentDraft();
        }
        // Synka till servern så att granskningen skapas och visas i listan.
        try {
            await sync_to_server_now(this.getState, this.dispatch);
        } catch (err) {
            // Fel visas redan av run_sync via NotificationComponent
        }
        this._do_go_to_list();
    }

    _show_empty_metadata_modal(form_data, action, on_proceed) {
        const ModalComponent = app_runtime_refs.modal_component;
        if (!ModalComponent?.show || !this.Helpers?.create_element) {
            if (typeof on_proceed === 'function') on_proceed();
            return;
        }
        const t = this.Translation.t;
        const continue_label = action === 'go_to_list'
            ? t('metadata_empty_warning_continue_to_list_button')
            : t('metadata_empty_warning_continue_button');
        const message_key = action === 'go_to_list'
            ? 'metadata_empty_warning_modal_message_go_to_list'
            : 'metadata_empty_warning_modal_message';
        ModalComponent.show(
            {
                h1_text: t('metadata_empty_warning_modal_title'),
                message_text: t(message_key)
            },
            (container, modal_instance) => {
                const buttons_wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const stay_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('metadata_empty_warning_stay_button')
                });
                stay_btn.addEventListener('click', () => modal_instance.close());
                const continue_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    text_content: continue_label
                });
                continue_btn.addEventListener('click', () => {
                    modal_instance.close(null, { skipHistoryPop: true });
                    if (typeof on_proceed === 'function') on_proceed();
                });
                buttons_wrapper.appendChild(stay_btn);
                buttons_wrapper.appendChild(continue_btn);
                container.appendChild(buttons_wrapper);
            }
        );
    }

    async handle_go_to_list(form_data) {
        const is_new_audit = this.getState().auditStatus === 'not_started';
        if (is_new_audit && !this._has_required_metadata(form_data)) {
            this._show_required_fields_modal(form_data, 'go_to_list', () => this._do_go_to_list());
            return;
        }
        if (is_new_audit && this._is_metadata_empty_or_only_auditor(form_data)) {
            this._show_empty_metadata_modal(form_data, 'go_to_list', () => this._do_go_to_list());
            return;
        }
        if (is_new_audit && this._has_required_metadata(form_data)) {
            await this._save_and_go_to_list(form_data);
            return;
        }
        this._do_go_to_list();
    }

    async render() {
        if (!this.root) return;
        const render_generation = ++this._render_generation;
        this.root.innerHTML = '';
        
        const t = this.Translation.t;
        const current_state = this.getState();
        const is_new_audit = current_state.auditStatus === 'not_started';

        if (is_new_audit && current_state.freshNewAuditMetadata === true) {
            if (
                should_skip_draft_restore_for_view('metadata', current_state)
                && DraftManager?.clearCurrentDraft
            ) {
                DraftManager.clearCurrentDraft();
            }
            this._monitoring_type_confirmed_by_user = false;
            this._form_only_rule_file_content = null;
            this._form_only_rule_set_id = null;
            this._form_pending_monitoring_key = '';
        }

        if (!is_new_audit) {
            this.router('audit_actions', { section: 'information' });
            return;
        }

        const has_rule = await this._ensure_new_audit_has_rule_file();
        if (!has_rule || render_generation !== this._render_generation) return;

        await this._build_monitoring_type_options();
        if (render_generation !== this._render_generation) return;
        let state_after_rule = this.getState();

        // För nya granskningar ska vi aldrig automatiskt kasta användaren tillbaka till översikten
        // om något är inkonsekvent – metadata-vyn är själva startpunkten.
        // För pågående/avslutade granskningar utan regelfil-innehåll skickar vi fortfarande tillbaka till start.
        if (!state_after_rule.ruleFileContent && !is_new_audit) {
            this.router('start');
            return;
        }

        const plate_element = this.Helpers.create_element('div', { class_name: 'content-plate metadata-form-plate' });

        const title = is_new_audit ? t('audit_metadata_title') : t('edit_audit_metadata_title');
        const intro_text = is_new_audit ? t('metadata_form_instruction') : t('edit_metadata_form_instruction');
        
        plate_element.appendChild(this.Helpers.create_element('h1', { text_content: title }));
        plate_element.appendChild(this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: intro_text }));
        
        this.metadata_form_container_element = this.Helpers.create_element('div', { id: 'metadata-form-container-in-view' });
        
        // Initialize sub-component with injected deps
        const self = this;
        this.metadata_form_component_instance.init({
            root: this.metadata_form_container_element,
            deps: this.deps,
            options: {
                onSubmit(form_data) {
                    if (is_new_audit && !self._has_required_metadata(form_data)) {
                        self._show_required_fields_modal(form_data, 'submit', () => self._do_go_to_list());
                        return;
                    }
                    if (is_new_audit && self._is_metadata_empty_or_only_auditor(form_data)) {
                        self._show_empty_metadata_modal(form_data, 'submit', () => self.handle_form_submit(form_data));
                        return;
                    }
                    self.handle_form_submit(form_data);
                },
                onCancel: is_new_audit ? this.handle_cancel_new_audit : this.handle_cancel,
                onGoToList: is_new_audit ? this.handle_go_to_list : null
            }
        });

        const metadata = await (async () => {
            const use_empty_form = is_new_audit && state_after_rule.freshNewAuditMetadata === true;
            const from = state_after_rule.auditMetadata || {};
            const str = (v) => (v !== null && v !== undefined && String(v).trim() !== '' ? String(v).trim() : '');
            const auditor_name = get_current_user_name() || '';
            if (use_empty_form) {
                const empty = build_empty_new_audit_metadata_form_data(auditor_name);
                if (new_audit_metadata_differs_from_reference_form(from, empty)) {
                    await this.dispatch({
                        type: this.StoreActionTypes.UPDATE_METADATA,
                        payload: {
                            ...empty,
                            skip_render: true,
                            skip_server_sync: true,
                            preserve_fresh_new_audit_metadata: true
                        }
                    });
                }
                return empty;
            }
            const cleaned = {
                caseNumber: str(from.caseNumber),
                actorName: str(from.actorName),
                actorLink: str(from.actorLink),
                auditorName: str(from.auditorName) || get_current_user_name() || '',
                caseHandler: str(from.caseHandler),
                internalComment: (from.internalComment !== null && from.internalComment !== undefined ? String(from.internalComment) : '').trim(),
                auditTypeId: str(from.auditTypeId),
                auditTypeLabel: str(from.auditTypeLabel)
            };
            if (is_new_audit) {
                const keys = [
                    'caseNumber',
                    'actorName',
                    'actorLink',
                    'auditorName',
                    'caseHandler',
                    'internalComment',
                    'auditTypeId',
                    'auditTypeLabel'
                ];
                const state_matches = keys.every(k => (from[k] === cleaned[k] || (str(from[k]) === cleaned[k])));
                const allowed_keys = new Set([
                    ...keys,
                    'appendix1SummaryText',
                    'appendix1SectionOverrides',
                    'appendix1PrincipleIntroOverrides',
                    'lastInProgressActivityAt'
                ]);
                const no_extra_keys = Object.keys(from).every(k => allowed_keys.has(k));
                if (!state_matches || !no_extra_keys) {
                    await this.dispatch({
                        type: this.StoreActionTypes.UPDATE_METADATA,
                        payload: {
                            ...cleaned,
                            skip_render: true
                        }
                    });
                }
            }
            return cleaned;
        })();

        state_after_rule = this.getState();

        const start_time_iso = (() => {
            if (is_new_audit) return null;
            const state_for_times = this.AuditLogic?.recalculateAuditTimes
                ? this.AuditLogic.recalculateAuditTimes({ ...current_state })
                : null;
            return current_state.startTime
                || current_state.auditMetadata?.startTime
                || state_for_times?.startTime
                || null;
        })();
        const lang_code = this.Translation.get_current_language_code();
        const start_date_input_value = start_time_iso && this.Helpers?.format_iso_for_locale_date_input
            ? this.Helpers.format_iso_for_locale_date_input(start_time_iso, lang_code)
            : '';
        const is_locked = current_state.auditStatus === 'locked';
        const end_time_iso = (() => {
            if (!is_locked) return null;
            const state_for_times = this.AuditLogic?.recalculateAuditTimes
                ? this.AuditLogic.recalculateAuditTimes({ ...current_state })
                : null;
            return current_state.endTime
                || current_state.auditMetadata?.endTime
                || state_for_times?.endTime
                || null;
        })();
        const end_date_input_value = end_time_iso && this.Helpers?.format_iso_for_locale_date_input
            ? this.Helpers.format_iso_for_locale_date_input(end_time_iso, lang_code)
            : '';
        const defer_rule_until_save = is_new_audit && !state_after_rule.ruleFileContent;
        const form_rule_file_content = defer_rule_until_save
            ? this._form_only_rule_file_content
            : state_after_rule.ruleFileContent;
        const rule_already_loaded = Boolean(state_after_rule.ruleFileContent);
        const monitoring_type_confirmed = defer_rule_until_save
            ? Boolean(this._form_pending_monitoring_key && form_rule_file_content)
            : rule_already_loaded || this._monitoring_type_confirmed_by_user;
        const selected_monitoring_key = defer_rule_until_save
            ? (this._form_pending_monitoring_key || '')
            : resolve_metadata_form_monitoring_key(
                monitoring_type_confirmed,
                state_after_rule.ruleSetId,
                this.monitoring_type_options
            );
        const auditor_name_options = await load_metadata_auditor_options();
        const case_handler_options = await load_metadata_case_handler_options(
            metadata.caseHandler || ''
        );
        if (render_generation !== this._render_generation) return;
        const form_options = {
            initialData: {
                ...metadata,
                responsibleUserId: state_after_rule.responsibleUserId || '',
                startDateInputValue: start_date_input_value,
                endDateInputValue: end_date_input_value
            },
            showStartDate: !is_new_audit,
            showEndDate: is_locked,
            effectiveStartIso: start_time_iso,
            ruleFileContent: form_rule_file_content,
            auditStatus: state_after_rule.auditStatus,
            showMonitoringTypeSelection: is_new_audit && this.monitoring_type_options.length > 0,
            monitoringTypeOptions: this.monitoring_type_options,
            selectedMonitoringKey: selected_monitoring_key,
            monitoringTypeConfirmed: monitoring_type_confirmed,
            monitoringIncludeEmptyPlaceholder: defer_rule_until_save,
            monitoringDefaultToFirstOption: false,
            auditTypeDefaultToFirstOption: false,
            onMonitoringTypeChange: is_new_audit ? this.handle_monitoring_type_change : null,
            auditorNameOptions: auditor_name_options,
            caseHandlerOptions: case_handler_options,
            submitButtonText: is_new_audit ? t('continue_to_samples') : t('save_changes_button'),
            cancelButtonText: t('return_without_saving_button_text'),
            goToListButtonText: is_new_audit ? t('go_to_audit_list_button') : null
        };
        
        this.metadata_form_component_instance.render(form_options);
        
        plate_element.appendChild(this.metadata_form_container_element);
        this.root.appendChild(plate_element);
    }

    destroy() {
        if (this.metadata_form_component_instance && this.metadata_form_component_instance.destroy) {
            this.metadata_form_component_instance.destroy();
        }
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
        this.AuditLogic = null;
        this.ValidationLogic = null;
        this.monitoring_type_options = [];
        this._monitoring_type_confirmed_by_user = false;
        this._form_only_rule_file_content = null;
        this._form_only_rule_set_id = null;
        this._form_pending_monitoring_key = '';
        this._render_generation += 1;
    }
}
