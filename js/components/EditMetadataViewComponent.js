import { MetadataFormComponent } from './MetadataFormComponent.js';
import { get_current_user_name } from '../utils/helpers.js';
import { sync_to_server_now } from '../logic/server_sync.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import { get_show_empty_metadata_form, clear_show_empty_metadata_form } from '../app/browser_globals.js';
import { DraftManager } from '../draft_manager.ts';

const METADATA_DRAFT_SCOPE = { route_key: 'metadata', params: {} };

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
        
        this.metadata_form_container_element = null;

        this.handle_form_submit = this.handle_form_submit.bind(this);
        this.handle_cancel = this.handle_cancel.bind(this);
        this.handle_cancel_new_audit = this.handle_cancel_new_audit.bind(this);
        this.handle_go_to_list = this.handle_go_to_list.bind(this);

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

    async handle_form_submit(form_data) {
        await this.dispatch({
            type: this.StoreActionTypes.UPDATE_METADATA,
            payload: form_data
        });
        if (window.DraftManager?.commitCurrentDraft) {
            window.DraftManager.commitCurrentDraft();
        }
        
        const current_status = this.getState().auditStatus;

        if (current_status === 'not_started') {
            // För nya granskningar sparar vi endast lokalt och går vidare till stickprov.
            // Själva skapandet av remote-granskningen sker först när granskningen startas.
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

    handle_cancel() {
        this._request_focus_on_audit_info_h2();
        this.router('audit_overview');
    }

    handle_cancel_new_audit() {
        void this._discard_and_go_to_list();
    }

    _clear_metadata_field_draft() {
        if (typeof DraftManager?.clearDraftForScope === 'function') {
            DraftManager.clearDraftForScope(METADATA_DRAFT_SCOPE.route_key, METADATA_DRAFT_SCOPE.params);
        } else if (window.DraftManager?.clearDraftForScope) {
            window.DraftManager.clearDraftForScope(METADATA_DRAFT_SCOPE.route_key, METADATA_DRAFT_SCOPE.params);
        }
    }

    _skip_form_autosave_on_destroy() {
        const form = this.metadata_form_component_instance;
        if (!form) return;
        form.skip_autosave_on_destroy = true;
        form.autosave_session?.cancel_pending();
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

    _build_fresh_new_audit_metadata() {
        return {
            caseNumber: '',
            actorName: '',
            actorLink: '',
            auditorName: get_current_user_name() || '',
            caseHandler: '',
            internalComment: ''
        };
    }

    async _resolve_metadata_for_form(current_state, is_new_audit) {
        const show_empty = is_new_audit && (
            current_state.freshNewAuditMetadata === true ||
            (typeof window !== 'undefined' && get_show_empty_metadata_form())
        );
        if (show_empty) {
            clear_show_empty_metadata_form();
            this._clear_metadata_field_draft();
            const fresh_metadata = this._build_fresh_new_audit_metadata();
            await this.dispatch({
                type: this.StoreActionTypes.UPDATE_METADATA,
                payload: {
                    ...fresh_metadata,
                    skip_render: true,
                    clear_fresh_new_audit_metadata: true
                }
            });
            return fresh_metadata;
        }
        const from = current_state.auditMetadata || {};
        const str = (v) => (v !== null && v !== undefined && String(v).trim() !== '' ? String(v).trim() : '');
        const cleaned = {
            caseNumber: str(from.caseNumber),
            actorName: str(from.actorName),
            actorLink: str(from.actorLink),
            auditorName: str(from.auditorName) || get_current_user_name() || '',
            caseHandler: str(from.caseHandler),
            internalComment: (from.internalComment !== null && from.internalComment !== undefined ? String(from.internalComment) : '').trim()
        };
        if (is_new_audit) {
            const keys = ['caseNumber', 'actorName', 'actorLink', 'auditorName', 'caseHandler', 'internalComment'];
            const state_matches = keys.every(k => (from[k] === cleaned[k] || (str(from[k]) === cleaned[k])));
            const no_extra_keys = Object.keys(from).every(k => keys.includes(k));
            if (!state_matches || !no_extra_keys) {
                await this.dispatch({ type: this.StoreActionTypes.UPDATE_METADATA, payload: cleaned });
            }
        }
        return cleaned;
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

    async _discard_and_go_to_list() {
        this._skip_form_autosave_on_destroy();
        this._clear_metadata_field_draft();
        await this.dispatch({ type: this.StoreActionTypes.DISCARD_PREPARED_AUDIT });
        this.router('start', { allow_new_audit_exit: '1' });
    }

    async _save_and_go_to_list(form_data) {
        await this.dispatch({
            type: this.StoreActionTypes.UPDATE_METADATA,
            payload: form_data
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
        this.router('start', { allow_new_audit_exit: '1' });
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
            this._show_required_fields_modal(form_data, 'go_to_list', () => { void this._discard_and_go_to_list(); });
            return;
        }
        if (is_new_audit && this._is_metadata_empty_or_only_auditor(form_data)) {
            this._show_empty_metadata_modal(form_data, 'go_to_list', () => { void this._discard_and_go_to_list(); });
            return;
        }
        if (is_new_audit && this._has_required_metadata(form_data)) {
            await this._save_and_go_to_list(form_data);
            return;
        }
        await this._discard_and_go_to_list();
    }

    async render() {
        if (!this.root) return;
        this.root.innerHTML = '';
        
        const t = this.Translation.t;
        const current_state = this.getState();
        const is_new_audit = current_state.auditStatus === 'not_started';

        // För nya granskningar ska vi aldrig automatiskt kasta användaren tillbaka till översikten
        // om något är inkonsekvent – metadata-vyn är själva startpunkten.
        // För pågående/avslutade granskningar utan regelfil-innehåll skickar vi fortfarande tillbaka till start.
        if (!current_state.ruleFileContent && !is_new_audit) {
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
                discardOnCancel: is_new_audit,
                onSubmit(form_data) {
                    if (is_new_audit && !self._has_required_metadata(form_data)) {
                        self._show_required_fields_modal(form_data, 'submit', () => { void self._discard_and_go_to_list(); });
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

        const metadata = await this._resolve_metadata_for_form(current_state, is_new_audit);
        const form_options = {
            initialData: metadata,
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
    }
}
