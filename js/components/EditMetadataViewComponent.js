import { MetadataFormComponent } from './MetadataFormComponent.js';
import { get_current_user_name } from '../utils/helpers.js';
import { sync_to_server_now } from '../logic/server_sync.js';

export const EditMetadataViewComponent = {
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
        this.metadata_form_component_instance = MetadataFormComponent;

        this.handle_form_submit = this.handle_form_submit.bind(this);
        this.handle_cancel = this.handle_cancel.bind(this);
        this.handle_cancel_new_audit = this.handle_cancel_new_audit.bind(this);
        this.handle_go_to_list = this.handle_go_to_list.bind(this);

        this.RETURN_FOCUS_SESSION_KEY = 'gv_return_focus_audit_info_h2_v1';
    },

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
    },

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
            try {
                await sync_to_server_now(this.getState, this.dispatch);
            } catch (err) {
                // Fel visas redan av run_sync via NotificationComponent
            }
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
    },

    handle_cancel() {
        this._request_focus_on_audit_info_h2();
        this.router('audit_overview');
    },

    handle_cancel_new_audit() {
        this.router('start');
    },

    _is_metadata_empty_or_only_auditor(form_data) {
        if (!form_data) return true;
        const has = (v) => (v != null && String(v).trim() !== '');
        const optional_filled = [
            form_data.caseNumber,
            form_data.actorLink,
            form_data.caseHandler,
            form_data.internalComment
        ].some(has);
        return !optional_filled;
    },

    _has_required_metadata(form_data) {
        if (!form_data) return false;
        const has = (v) => (v != null && String(v).trim() !== '');
        return has(form_data.actorName) && has(form_data.auditorName);
    },

    _show_required_fields_modal(form_data, source, on_proceed) {
        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) {
            if (typeof on_proceed === 'function') on_proceed();
            return;
        }
        const t = this.Translation.t;
        const has = (v) => (v != null && String(v).trim() !== '');
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
                    class_name: ['button', 'button-default'],
                    text_content: t('metadata_empty_warning_stay_button')
                });
                stay_btn.addEventListener('click', () => modal_instance.close());
                const list_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('metadata_empty_warning_continue_to_list_button')
                });
                list_btn.addEventListener('click', () => {
                    modal_instance.close();
                    if (typeof on_proceed === 'function') on_proceed();
                });
                buttons_wrapper.appendChild(stay_btn);
                buttons_wrapper.appendChild(list_btn);
                container.appendChild(buttons_wrapper);
            }
        );
    },

    _do_go_to_list() {
        this.router('start');
    },

    async _save_and_go_to_list(form_data) {
        await this.dispatch({
            type: this.StoreActionTypes.UPDATE_METADATA,
            payload: form_data
        });
        if (window.DraftManager?.commitCurrentDraft) {
            window.DraftManager.commitCurrentDraft();
        }
        try {
            await sync_to_server_now(this.getState, this.dispatch);
        } catch (err) {
            // Fel visas redan av run_sync via NotificationComponent
        }
        this._do_go_to_list();
    },

    _show_empty_metadata_modal(form_data, action, on_proceed) {
        const ModalComponent = window.ModalComponent;
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
                    class_name: ['button', 'button-default'],
                    text_content: t('metadata_empty_warning_stay_button')
                });
                stay_btn.addEventListener('click', () => modal_instance.close());
                const continue_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: continue_label
                });
                continue_btn.addEventListener('click', () => {
                    modal_instance.close();
                    if (typeof on_proceed === 'function') on_proceed();
                });
                buttons_wrapper.appendChild(stay_btn);
                buttons_wrapper.appendChild(continue_btn);
                container.appendChild(buttons_wrapper);
            }
        );
    },

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
    },

    async render() {
        if (!this.root) return;
        this.root.innerHTML = '';
        
        const t = this.Translation.t;
        const current_state = this.getState();
        const is_new_audit = current_state.auditStatus === 'not_started';

        if (!current_state.ruleFileContent) {
            this.router('start');
            return;
        }

        const plate_element = this.Helpers.create_element('div', { class_name: 'content-plate metadata-form-plate' });
        
        const global_message_element = this.NotificationComponent.get_global_message_element_reference();
        if (global_message_element) {
            plate_element.appendChild(global_message_element);
        }
        
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

        const metadata = (() => {
            const show_empty = is_new_audit && typeof window !== 'undefined' && window.__GV_SHOW_EMPTY_METADATA_FORM === true;
            if (show_empty) {
                if (typeof window !== 'undefined') {
                    window.__GV_SHOW_EMPTY_METADATA_FORM = false;
                }
                return {
                    caseNumber: '',
                    actorName: '',
                    actorLink: '',
                    auditorName: get_current_user_name() || '',
                    caseHandler: '',
                    internalComment: ''
                };
            }
            const from = current_state.auditMetadata || {};
            const str = (v) => (v != null && String(v).trim() !== '' ? String(v).trim() : '');
            const cleaned = {
                caseNumber: str(from.caseNumber),
                actorName: str(from.actorName),
                actorLink: str(from.actorLink),
                auditorName: str(from.auditorName) || get_current_user_name() || '',
                caseHandler: str(from.caseHandler),
                internalComment: (from.internalComment != null ? String(from.internalComment) : '').trim()
            };
            if (is_new_audit) {
                const keys = ['caseNumber', 'actorName', 'actorLink', 'auditorName', 'caseHandler', 'internalComment'];
                const state_matches = keys.every(k => (from[k] === cleaned[k] || (str(from[k]) === cleaned[k])));
                const no_extra_keys = Object.keys(from).every(k => keys.includes(k));
                if (!state_matches || !no_extra_keys) {
                    this.dispatch({ type: this.StoreActionTypes.UPDATE_METADATA, payload: cleaned });
                }
            }
            return cleaned;
        })();
        const form_options = {
            initialData: metadata,
            submitButtonText: is_new_audit ? t('continue_to_samples') : t('save_changes_button'),
            cancelButtonText: t('return_without_saving_button_text'),
            goToListButtonText: is_new_audit ? t('go_to_audit_list_button') : null
        };
        
        this.metadata_form_component_instance.render(form_options);
        
        plate_element.appendChild(this.metadata_form_container_element);
        this.root.appendChild(plate_element);
    },

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
};
