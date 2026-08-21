// js/components/EditContentTypesSectionComponent.js

import { app_session_storage } from '../utils/scoped_browser_storage.js';
import { ensure_metadata_defaults, clone_metadata } from '../logic/rulefile_metadata_model.js';
import {
    resolve_content_types,
    normalize_rulefile_metadata_vocabularies
} from '../../shared/rulefile/rulefile_metadata_vocabularies.js';
import { flush_rulefile_editing_sync_if_active } from '../logic/server_sync.js';
import { remove_content_type_from_requirements } from '../utils/content_types_helper.js';
import {
    CONTENT_TYPE_NEW_PARAM,
    content_type_list_route_params,
    ensure_draft_content_type_for_create,
    find_content_type_by_child_id,
    resolve_content_type_edit_mode,
} from './rulefile_sections/rulefile_content_type_keys.js';
import { render_content_types_overview } from './rulefile_sections/rulefile_content_types_ui.js';
import { render_content_type_edit_form } from './rulefile_sections/rulefile_content_type_edit_ui.js';
import './edit_rulefile_metadata_view.css';
import './rulefile_sections_view.css';

export const EditContentTypesSectionComponent = {
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
        this.initial_rulefile_snapshot = null;
        this.panel_container = null;
        this.content_type_location = null;
        this.sync_edit_form = null;
        this.refresh_requirements_table = null;
        this.skip_autosave_on_destroy = false;
        this.edit_mode = 'overview';
        this.content_type_id_param = '';
    },

    _clone_metadata(metadata) {
        return clone_metadata(metadata);
    },

    _ensure_metadata_defaults(workingMetadata) {
        return ensure_metadata_defaults(workingMetadata);
    },

    _generate_slug(value) {
        if (!value) return '';
        return value.toString().trim().toLowerCase()
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-{2,}/g, '-')
            .replace(/^-+|-+$/g, '');
    },

    _ensure_unique_slug(slugSet, preferred, fallback) {
        let base = preferred || fallback || 'item';
        if (!base) base = 'item';
        let candidate = base;
        let counter = 1;
        while (!candidate || slugSet.has(candidate)) {
            candidate = `${base}-${counter++}`;
        }
        slugSet.add(candidate);
        return candidate;
    },

    _get_editor_ctx() {
        return {
            Helpers: this.Helpers,
            Translation: this.Translation,
            router: this.router,
        };
    },

    _read_content_type_id_param() {
        return String(this.deps?.params?.contentTypeId ?? '').trim();
    },

    _resolve_edit_mode() {
        this.content_type_id_param = this._read_content_type_id_param();
        this.edit_mode = resolve_content_type_edit_mode(this.content_type_id_param);
    },

    _normalize_content_types_for_persist(content_types, shouldTrim) {
        const trim = (value) => {
            const s = (value ?? '').toString();
            return shouldTrim ? s.trim() : s;
        };

        const cleanedContentTypes = content_types.map(parent => {
            const cleanedParent = {
                id: trim(parent.id),
                text: trim(parent.text),
                description: ''
            };
            const childTypes = Array.isArray(parent.types) ? parent.types : [];
            cleanedParent.types = childTypes
                .map(child => {
                    const cleaned = {
                        id: trim(child?.id),
                        text: trim(child?.text),
                        description: trim(child?.description),
                        detectionPattern: trim(child?.detectionPattern),
                        detectionSelector: trim(child?.detectionSelector)
                    };
                    if (!cleaned.detectionPattern) {
                        delete cleaned.detectionPattern;
                    }
                    if (!cleaned.detectionSelector) {
                        delete cleaned.detectionSelector;
                    }
                    if (child?.defaultSelected === true) {
                        cleaned.defaultSelected = true;
                    }
                    return cleaned;
                })
                .filter(child => child.id || child.text || child.description || child.detectionPattern || child.detectionSelector);
            return cleanedParent;
        }).filter(parent => parent.id || parent.text || (parent.types && parent.types.length > 0));

        const contentTypeSlugSet = new Set(cleanedContentTypes.map(ct => ct.id).filter(Boolean));
        cleanedContentTypes.forEach(parent => {
            if (!parent.id) {
                parent.id = this._ensure_unique_slug(
                    contentTypeSlugSet,
                    this._generate_slug(parent.text),
                    'content-type'
                );
            } else {
                contentTypeSlugSet.add(parent.id);
            }

            const childSlugSet = new Set(parent.types.map(child => child.id).filter(Boolean));
            parent.types.forEach(child => {
                if (!child.id) {
                    const childSlug = this._generate_slug(child.text);
                    const base = parent.id || this._generate_slug(parent.text) || 'content';
                    const preferred = childSlug ? `${base}-${childSlug}` : '';
                    child.id = this._ensure_unique_slug(childSlugSet, preferred, `${base}-child`);
                } else {
                    childSlugSet.add(child.id);
                }
            });
        });

        return cleanedContentTypes;
    },

    _build_rulefile_payload(shouldTrim, skip_render) {
        const state = this.getState();
        const currentRulefile = state?.ruleFileContent || {};
        const content_types = resolve_content_types(this.working_metadata);
        const cleanedContentTypes = this._normalize_content_types_for_persist(content_types, shouldTrim);

        const updatedMetadata = normalize_rulefile_metadata_vocabularies({
            ...currentRulefile.metadata,
            contentTypes: cleanedContentTypes
        }, { mode: 'read' });

        return {
            ruleFileContent: {
                ...currentRulefile,
                metadata: updatedMetadata
            },
            skip_render: skip_render === true
        };
    },

    _dispatch_rulefile(payload) {
        this.dispatch({
            type: this.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload
        });
    },

    _perform_save(shouldTrim, skip_render) {
        if (!this.working_metadata) return;
        if (this.sync_edit_form) {
            this.content_type_location = this.sync_edit_form(shouldTrim);
        }
        this._dispatch_rulefile(this._build_rulefile_payload(shouldTrim, skip_render));
        if (this.refresh_requirements_table) {
            this.refresh_requirements_table();
        }
        if (this.content_type_location && this.edit_mode === 'create') {
            const new_id = String(this.content_type_location.child.id ?? '').trim();
            if (new_id && new_id !== this.content_type_id_param) {
                this.content_type_id_param = new_id;
            }
        }
    },

    handle_autosave_input() {
        this.autosave_session?.request_autosave();
    },

    _update_section_heading(name) {
        if (this.edit_mode !== 'edit') return;
        const heading = document.getElementById('main-content-heading')
            || document.getElementById('rulefile-section-content_types-heading');
        if (!heading) return;
        const t = this.Translation.t;
        const t_plain = this.Translation.interpolate_translation_plain;
        heading.textContent = t_plain('rulefile_content_types_edit_heading', {
            name: name || t('rulefile_metadata_untitled_item')
        });
    },

    _resolve_edit_location() {
        if (this.edit_mode === 'create') {
            return ensure_draft_content_type_for_create(this.working_metadata);
        }
        const found = find_content_type_by_child_id(this.working_metadata, this.content_type_id_param);
        if (!found) {
            this.router('rulefile_sections', content_type_list_route_params());
            return null;
        }
        return found;
    },

    _delete_current_content_type() {
        if (!this.content_type_location) return;
        const { parent_index, child_index, child } = this.content_type_location;
        const child_id = String(child.id ?? '').trim();
        const parents = resolve_content_types(this.working_metadata);
        const parent = parents[parent_index];
        if (parent?.types) {
            parent.types.splice(child_index, 1);
            this.working_metadata.contentTypes = parents;
        }

        const state = this.getState();
        let rulefile = state?.ruleFileContent || {};
        if (child_id) {
            rulefile = remove_content_type_from_requirements(rulefile, child_id);
        }
        const payload = this._build_rulefile_payload(true, true);
        payload.ruleFileContent = {
            ...rulefile,
            metadata: payload.ruleFileContent.metadata
        };
        this._dispatch_rulefile(payload);
        this.skip_autosave_on_destroy = true;
        this.autosave_session?.cancel_pending?.();
        app_session_storage.setItem('focusAfterLoad', '.rulefile-sections-header h1');
        this.router('rulefile_sections', content_type_list_route_params());
    },

    _navigate_back_without_saving() {
        this._restore_initial_state();
        this.skip_autosave_on_destroy = true;
        this.autosave_session?.cancel_pending?.();
        app_session_storage.setItem('focusAfterLoad', '.rulefile-sections-header h1');
        this.router('rulefile_sections', content_type_list_route_params());
    },

    async _save_and_return_to_overview() {
        this.autosave_session?.flush?.({ should_trim: true, skip_render: true });
        this.skip_autosave_on_destroy = true;
        await flush_rulefile_editing_sync_if_active(this.getState, this.dispatch, { bump_version: true });
        this.NotificationComponent.show_global_message?.(
            this.Translation.t('rulefile_metadata_edit_saved'),
            'success'
        );
        app_session_storage.setItem('focusAfterLoad', '.rulefile-sections-header h1');
        this.router('rulefile_sections', content_type_list_route_params());
    },

    _render_overview() {
        if (!this.panel_container || !this.working_metadata) return;
        const rule_file_content = this.getState()?.ruleFileContent || {};
        render_content_types_overview(
            this._get_editor_ctx(),
            this.panel_container,
            this.working_metadata,
            rule_file_content,
            {
                on_change: () => this.handle_autosave_input(),
                get_rule_file_content: () => this.getState()?.ruleFileContent || {},
                on_rule_file_content_change: (updated_rule_file_content) => {
                    const payload = this._build_rulefile_payload(false, true);
                    this._dispatch_rulefile({
                        ...payload,
                        ruleFileContent: {
                            ...updated_rule_file_content,
                            metadata: payload.ruleFileContent.metadata
                        }
                    });
                }
            }
        );
    },

    _render_detail() {
        if (!this.panel_container || !this.working_metadata) return;

        const location = this._resolve_edit_location();
        if (!location) return;
        this.content_type_location = location;

        const rule_file_content = this.getState()?.ruleFileContent || {};
        const is_create = this.edit_mode === 'create';
        this._update_section_heading(location.child.text?.trim() || '');

        const edit_result = render_content_type_edit_form(
            this._get_editor_ctx(),
            this.panel_container,
            this.working_metadata,
            rule_file_content,
            {
                location,
                is_create,
                on_change: () => this.handle_autosave_input(),
                on_delete: () => this._delete_current_content_type(),
                on_back: () => this._navigate_back_without_saving(),
                get_rule_file_content: () => this.getState()?.ruleFileContent || {},
                on_rule_file_content_change: (updated_rule_file_content) => {
                    const payload = this._build_rulefile_payload(false, true);
                    this._dispatch_rulefile({
                        ...payload,
                        ruleFileContent: {
                            ...updated_rule_file_content,
                            metadata: payload.ruleFileContent.metadata
                        }
                    });
                },
                update_heading: (name) => this._update_section_heading(name),
            }
        );

        this.form_element_ref = edit_result.form;
        this.sync_edit_form = edit_result.sync_from_form;
        this.refresh_requirements_table = edit_result.refresh_requirements_table;

        edit_result.form.addEventListener('submit', (event) => {
            event.preventDefault();
            void this._save_and_return_to_overview();
        });

        this.autosave_session?.destroy();
        this.autosave_session = this.AutosaveService?.create_session({
            form_element: edit_result.form,
            focus_root: edit_result.form,
            debounce_ms: 250,
            on_save: ({ should_trim, skip_render }) => {
                this._perform_save(should_trim, skip_render);
            }
        }) || null;
    },

    _render_panel() {
        if (this.edit_mode === 'overview') {
            this._render_overview();
            return;
        }
        this._render_detail();
    },

    _create_overview_shell() {
        const shell = this.Helpers.create_element('div', {
            class_name: 'rulefile-classifications-edit-form content-types-edit-form content-types-overview-shell'
        });
        this.panel_container = this.Helpers.create_element('div', {
            class_name: 'classifications-part-panel'
        });
        shell.appendChild(this.panel_container);
        return shell;
    },

    _restore_initial_state() {
        if (!this.initial_metadata_snapshot) return;
        const state = this.getState();
        const currentRulefile = state?.ruleFileContent || {};
        this.dispatch({
            type: this.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: {
                ruleFileContent: this.initial_rulefile_snapshot || {
                    ...currentRulefile,
                    metadata: this.initial_metadata_snapshot
                },
                skip_render: true
            }
        });
    },

    render() {
        if (!this.root) return;
        const state = this.getState();
        if (!state?.ruleFileContent?.metadata) return;

        this._resolve_edit_mode();
        const same_shell =
            this.form_element_ref &&
            this.root.contains(this.form_element_ref) &&
            this.root.dataset.contentTypeView === this.edit_mode &&
            this.root.dataset.contentTypeId === this.content_type_id_param;

        if (same_shell) return;

        this.initial_metadata_snapshot = this._clone_metadata(state.ruleFileContent.metadata);
        this.initial_rulefile_snapshot = this._clone_metadata(state.ruleFileContent);
        this.root.innerHTML = '';
        this.working_metadata = this._ensure_metadata_defaults(
            this._clone_metadata(state.ruleFileContent.metadata)
        );

        if (this.edit_mode === 'overview') {
            const shell = this._create_overview_shell();
            this.form_element_ref = shell;
            this.root.dataset.contentTypeView = 'overview';
            this.root.dataset.contentTypeId = '';
            this.root.appendChild(shell);
            this.autosave_session?.destroy();
            this.autosave_session = null;
            this._render_panel();
            return;
        }

        this.root.dataset.contentTypeView = this.edit_mode;
        this.root.dataset.contentTypeId = this.content_type_id_param;
        this.panel_container = this.Helpers.create_element('div', {
            class_name: 'classifications-part-panel content-types-detail-panel'
        });
        this.root.appendChild(this.panel_container);
        this._render_panel();
    },

    destroy() {
        if (!this.skip_autosave_on_destroy && this.working_metadata && this.edit_mode !== 'overview') {
            this.autosave_session?.flush?.({ should_trim: true, skip_render: true });
            void flush_rulefile_editing_sync_if_active(this.getState, this.dispatch);
        }
        this.autosave_session?.destroy();
        this.autosave_session = null;

        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.form_element_ref = null;
        this.working_metadata = null;
        this.initial_metadata_snapshot = null;
        this.initial_rulefile_snapshot = null;
        this.panel_container = null;
        this.content_type_location = null;
        this.sync_edit_form = null;
        this.refresh_requirements_table = null;
        this.deps = null;
    }
};
