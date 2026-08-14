// js/components/EditPageTypesSectionComponent.js

import { app_session_storage } from '../utils/scoped_browser_storage.js';
import { ensure_metadata_defaults, clone_metadata } from '../logic/rulefile_metadata_model.js';
import { normalize_rulefile_metadata_vocabularies } from '../../shared/rulefile/rulefile_metadata_vocabularies.js';
import {
    apply_dropdown_lists_to_metadata,
    parse_lines_textarea,
} from '../../shared/rulefile/page_types_dropdown_sync.js';
import { flush_rulefile_editing_sync_if_active } from '../logic/server_sync.js';
import {
    create_page_types_dropdown_editor,
    PAGE_TYPES_ATERKOMMANDE_TEXTAREA_NAME,
    PAGE_TYPES_WEBBSIDA_TEXTAREA_NAME,
} from './rulefile_sections/page_types_dropdown_editor_ui.js';
import './edit_rulefile_metadata_view.css';

export class EditPageTypesSectionComponent {
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
        this.AutosaveService = null;
        this.form_element_ref = null;
        this.working_metadata = null;
        this.initial_metadata_snapshot = null;
        this.autosave_session = null;
        this.skip_autosave_on_destroy = false;
    }

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.AutosaveService = deps.AutosaveService;
        this.form_element_ref = null;
        this.working_metadata = null;
        this.initial_metadata_snapshot = null;
        this.autosave_session = null;
        this.skip_autosave_on_destroy = false;
        this.handle_autosave_input = this.handle_autosave_input.bind(this);
    }

    _clone_metadata(metadata) {
        return clone_metadata(metadata);
    }

    _ensure_metadata_defaults(workingMetadata) {
        return ensure_metadata_defaults(workingMetadata);
    }

    _read_textarea_lines(textarea, should_trim) {
        if (!textarea) return [];
        const raw = textarea.value || '';
        if (should_trim && this.Helpers?.trim_textarea_preserve_lines) {
            return this.Helpers.trim_textarea_preserve_lines(raw)
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean);
        }
        return parse_lines_textarea(raw, { trim: should_trim });
    }

    _collect_dropdown_input(should_trim) {
        const form = this.form_element_ref;
        if (!form) {
            return { webbsida_lines: [], aterkommande_lines: null };
        }
        const webbsida_textarea = form.querySelector(`textarea[name="${PAGE_TYPES_WEBBSIDA_TEXTAREA_NAME}"]`);
        const aterkommande_textarea = form.querySelector(`textarea[name="${PAGE_TYPES_ATERKOMMANDE_TEXTAREA_NAME}"]`);
        return {
            webbsida_lines: this._read_textarea_lines(webbsida_textarea, should_trim),
            aterkommande_lines: aterkommande_textarea
                ? this._read_textarea_lines(aterkommande_textarea, should_trim)
                : null,
        };
    }

    _save_form_values_to_metadata(workingMetadata, should_trim = false, require_webbsida_lines = false) {
        if (!this.form_element_ref) return { ok: true };
        const input = this._collect_dropdown_input(should_trim);
        return apply_dropdown_lists_to_metadata(
            workingMetadata,
            input,
            { require_webbsida_lines: require_webbsida_lines }
        );
    }

    _perform_save(should_trim, skip_render) {
        if (!this.form_element_ref) return { ok: true };
        const state = this.getState();
        if (!this.working_metadata) {
            const base_metadata = state?.ruleFileContent?.metadata || {};
            this.working_metadata = this._ensure_metadata_defaults(this._clone_metadata(base_metadata));
        }
        const result = this._save_form_values_to_metadata(
            this.working_metadata,
            should_trim,
            should_trim
        );
        if (!result.ok) {
            return result;
        }
        const current_rulefile = state?.ruleFileContent || {};
        const updated_metadata = normalize_rulefile_metadata_vocabularies(
            { ...this.working_metadata },
            { mode: 'read' }
        );
        this.dispatch({
            type: this.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: {
                ruleFileContent: {
                    ...current_rulefile,
                    metadata: { ...current_rulefile.metadata, ...updated_metadata },
                },
                skip_render: skip_render === true,
            },
        });
        return { ok: true };
    }

    handle_autosave_input() {
        this.autosave_session?.request_autosave();
    }

    _restore_initial_state() {
        if (!this.initial_metadata_snapshot) return;
        const state = this.getState();
        const current_rulefile = state?.ruleFileContent || {};
        this.dispatch({
            type: this.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: {
                ruleFileContent: {
                    ...current_rulefile,
                    metadata: this.initial_metadata_snapshot,
                },
                skip_render: true,
            },
        });
    }

    _show_validation_error(result) {
        if (result.ok) return;
        const t = this.Translation.t;
        const message = t(result.error_key, result.error_context || {});
        this.NotificationComponent.show_global_message?.(message, 'error');
    }

    async _handle_manual_save() {
        const result = this._perform_save(true, true);
        if (!result.ok) {
            this._show_validation_error(result);
            return;
        }
        await flush_rulefile_editing_sync_if_active(this.getState, this.dispatch);
        if (window.DraftManager?.commitCurrentDraft) {
            window.DraftManager.commitCurrentDraft();
        }
        this.NotificationComponent.show_global_message?.(
            this.Translation.t('rulefile_metadata_edit_saved'),
            'success'
        );
        app_session_storage.setItem('focusAfterLoad', '.rulefile-sections-header h1');
        this.router('rulefile_sections', { section: 'page_types' });
    }

    _handle_cancel() {
        this._restore_initial_state();
        this.skip_autosave_on_destroy = true;
        this.autosave_session?.cancel_pending();
        app_session_storage.setItem('focusAfterLoad', '.rulefile-sections-header h1');
        this.router('rulefile_sections', { section: 'page_types' });
    }

    render() {
        if (!this.root) return;
        const state = this.getState();
        if (!state?.ruleFileContent?.metadata) return;

        if (this.form_element_ref && this.root.contains(this.form_element_ref) && this.root.children.length > 0) {
            return;
        }

        this.initial_metadata_snapshot = this._clone_metadata(state.ruleFileContent.metadata);
        this.working_metadata = this._ensure_metadata_defaults(
            this._clone_metadata(state.ruleFileContent.metadata)
        );

        this.root.innerHTML = '';

        const { form } = create_page_types_dropdown_editor({
            metadata: this.working_metadata,
            Helpers: this.Helpers,
            Translation: this.Translation,
            on_input: this.handle_autosave_input,
            on_save: () => this._handle_manual_save(),
            on_cancel: () => this._handle_cancel(),
        });

        this.form_element_ref = form;
        this.autosave_session?.destroy();
        this.autosave_session = this.AutosaveService?.create_session({
            form_element: form,
            focus_root: form,
            debounce_ms: 250,
            on_save: ({ should_trim, skip_render }) => {
                const result = this._perform_save(should_trim, skip_render);
                if (!result.ok && should_trim) {
                    this._show_validation_error(result);
                }
            },
        }) || null;

        this.root.appendChild(form);
    }

    destroy() {
        if (!this.skip_autosave_on_destroy && this.form_element_ref && this.working_metadata) {
            this.autosave_session?.flush({ should_trim: true, skip_render: true });
        }
        void flush_rulefile_editing_sync_if_active(this.getState, this.dispatch);
        this.autosave_session?.destroy();
        this.autosave_session = null;

        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.form_element_ref = null;
        this.working_metadata = null;
        this.initial_metadata_snapshot = null;
        this.deps = null;
    }
}
