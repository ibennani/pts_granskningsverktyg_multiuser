// js/components/EditGeneralSectionComponent.js

export const EditGeneralSectionComponent = {
    CSS_PATH: 'css/components/edit_rulefile_metadata_view.css',

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
        
        if (this.Helpers?.load_css) {
            await this.Helpers.load_css(this.CSS_PATH).catch(err => console.warn('[EditGeneralSectionComponent] Failed to load CSS', err));
        }
    },

    _create_field(label_key, name, value = '', type = 'text', options = {}) {
        const { required = false } = options;
        const container = this.Helpers.create_element('div', { class_name: 'form-group' });
        const labelText = this.Translation.t(label_key);
        const label = this.Helpers.create_element('label', { attributes: { for: name }, text_content: labelText });
        container.appendChild(label);

        if (type === 'textarea') {
            const textarea = this.Helpers.create_element('textarea', {
                class_name: 'form-control',
                attributes: { 
                    id: name, 
                    name, 
                    rows: '3', 
                    ...(required ? { required: 'required' } : {})
                }
            });
            textarea.value = value ?? '';
            textarea.addEventListener('input', this.handle_autosave_input);
            container.appendChild(textarea);
            this.Helpers.init_auto_resize_for_textarea?.(textarea);
        } else {
            const input = this.Helpers.create_element('input', {
                class_name: 'form-control',
                attributes: { 
                    id: name, 
                    name, 
                    type, 
                    ...(required ? { required: 'required' } : {})
                }
            });
            input.value = value ?? '';
            input.addEventListener('input', this.handle_autosave_input);
            container.appendChild(input);
        }

        return container;
    },

    _clone_metadata(metadata) {
        return JSON.parse(JSON.stringify(metadata || {}));
    },

    _ensure_metadata_defaults(workingMetadata) {
        if (!workingMetadata.monitoringType) {
            workingMetadata.monitoringType = { type: '', text: '' };
        } else {
            workingMetadata.monitoringType.type = workingMetadata.monitoringType.type || '';
            workingMetadata.monitoringType.text = workingMetadata.monitoringType.text || '';
        }
        if (!workingMetadata.publisher) {
            workingMetadata.publisher = {};
        }
        if (!workingMetadata.source) {
            workingMetadata.source = {};
        }
        return workingMetadata;
    },

    _create_form(metadata) {
        const workingMetadata = this._ensure_metadata_defaults(this._clone_metadata(metadata));
        const form = this.Helpers.create_element('form', { class_name: 'rulefile-metadata-edit-form' });

        // General section
        const general_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        general_section.appendChild(this.Helpers.create_element('h3', { text_content: this.Translation.t('rulefile_metadata_section_general') }));
        general_section.appendChild(this._create_field('rulefile_metadata_field_title', 'metadata.title', metadata.title || '', 'text', { required: true }));
        general_section.appendChild(this._create_field('rulefile_metadata_field_description', 'metadata.description', metadata.description || '', 'textarea'));
        general_section.appendChild(this._create_field('rulefile_metadata_field_version', 'metadata.version', metadata.version || ''));
        general_section.appendChild(this._create_field('rulefile_metadata_field_language', 'metadata.language', metadata.language || ''));
        // monitoringType.type (nyckeln) visas inte - den är en intern identifierare och ska inte redigeras direkt
        general_section.appendChild(this._create_field('rulefile_metadata_field_monitoring_type_label', 'metadata.monitoringType.text', metadata.monitoringType?.text || ''));
        general_section.appendChild(this._create_field('rulefile_metadata_field_date_created', 'metadata.dateCreated', metadata.dateCreated || '', 'date'));
        general_section.appendChild(this._create_field('rulefile_metadata_field_date_modified', 'metadata.dateModified', metadata.dateModified || '', 'date'));
        general_section.appendChild(this._create_field('rulefile_metadata_field_license', 'metadata.license', metadata.license || ''));

        // Publisher section
        const publisher_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        publisher_section.appendChild(this.Helpers.create_element('h3', { text_content: this.Translation.t('rulefile_metadata_section_publisher') }));
        publisher_section.appendChild(this._create_field('rulefile_metadata_field_publisher_name', 'metadata.publisher.name', metadata.publisher?.name || ''));
        publisher_section.appendChild(this._create_field('rulefile_metadata_field_publisher_contact', 'metadata.publisher.contactPoint', metadata.publisher?.contactPoint || ''));

        // Source section
        const source_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        source_section.appendChild(this.Helpers.create_element('h3', { text_content: this.Translation.t('rulefile_metadata_section_source') }));
        source_section.appendChild(this._create_field('rulefile_metadata_field_source_url', 'metadata.source.url', metadata.source?.url || '', 'url'));
        source_section.appendChild(this._create_field('rulefile_metadata_field_source_title', 'metadata.source.title', metadata.source?.title || ''));
        source_section.appendChild(this._create_field('rulefile_metadata_field_source_retrieved', 'metadata.source.retrievedDate', metadata.source?.retrievedDate || '', 'date'));
        source_section.appendChild(this._create_field('rulefile_metadata_field_source_format', 'metadata.source.format', metadata.source?.format || ''));

        form.append(general_section, publisher_section, source_section);

        form.addEventListener('submit', event => {
            event.preventDefault();
            this._handle_submit(form, metadata, workingMetadata);
        });

        const footerActions = this.Helpers.create_element('div', { class_name: 'metadata-edit-form-footer-actions' });
        const footerSaveButton = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'button' },
            html_content: `<span>${this.Translation.t('rulefile_metadata_save_metadata')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('save') : '')
        });
        footerSaveButton.addEventListener('click', () => form.requestSubmit());

        const footerCancelButton = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: { type: 'button' },
            html_content: `<span>${this.Translation.t('back_without_saving')}</span>`
        });
        footerCancelButton.addEventListener('click', () => {
            this._restore_initial_state();
            this.skip_autosave_on_destroy = true;
            this.autosave_session?.cancel_pending();
            this.router('rulefile_sections', { section: 'general' });
        });

        footerActions.append(footerSaveButton, footerCancelButton);
        form.appendChild(footerActions);

        return { form, workingMetadata };
    },

    _parse_form_data(form, workingMetadata, should_trim = false, trim_text = null) {
        const formData = new FormData(form);
        const data = {};
        const normalize_value = (value) => {
            if (typeof value !== 'string') return value;
            if (!should_trim || typeof trim_text !== 'function') return value;
            return trim_text(value);
        };

        for (const [key, value] of formData.entries()) {
            const keys = key.split('.');
            let current = data;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }
            // Trimma endast mellanslag per rad vid manuell sparning
            current[keys[keys.length - 1]] = normalize_value(value);
        }

        // Merge with workingMetadata to preserve structure
        if (data.metadata) {
            if (data.metadata.monitoringType) {
                // Behåll befintlig type (nyckeln är en intern identifierare och ska inte ändras)
                workingMetadata.monitoringType = {
                    type: workingMetadata.monitoringType?.type || data.metadata.monitoringType.type || '',
                    text: normalize_value(data.metadata.monitoringType.text) || ''
                };
            }
            if (data.metadata.publisher) {
                workingMetadata.publisher = {
                    name: normalize_value(data.metadata.publisher.name) || '',
                    contactPoint: normalize_value(data.metadata.publisher.contactPoint) || ''
                };
            }
            if (data.metadata.source) {
                workingMetadata.source = {
                    url: normalize_value(data.metadata.source.url) || '',
                    title: normalize_value(data.metadata.source.title) || '',
                    retrievedDate: normalize_value(data.metadata.source.retrievedDate) || '',
                    format: normalize_value(data.metadata.source.format) || ''
                };
            }
            // Copy other general fields
            Object.keys(data.metadata).forEach(key => {
                if (!['monitoringType', 'publisher', 'source'].includes(key)) {
                    const value = data.metadata[key];
                    const normalized = normalize_value(value);
                    workingMetadata[key] = typeof normalized === 'string' ? normalized : (normalized || '');
                }
            });
        }

        return workingMetadata;
    },

    handle_autosave_input() {
        this.autosave_session?.request_autosave();
    },

    _handle_submit(form, originalMetadata, workingMetadata) {
        const t = this.Translation.t;
        this.autosave_session?.flush({ should_trim: true, skip_render: true });
        if (window.DraftManager?.commitCurrentDraft) {
            window.DraftManager.commitCurrentDraft();
        }

        this.NotificationComponent.show_global_message?.(t('rulefile_metadata_edit_saved'), 'success');
        
        // Navigera tillbaka till rulefile_sections med section=general (utan edit=true)
        sessionStorage.setItem('focusAfterLoad', '.rulefile-sections-header h2');
        this.router('rulefile_sections', { section: 'general' });
    },

    _restore_initial_state() {
        if (!this.initial_metadata_snapshot) return;
        
        const state = this.getState();
        const currentRulefile = state?.ruleFileContent || {};
        
        const restoredRulefileContent = {
            ...currentRulefile,
            metadata: this.initial_metadata_snapshot
        };

        this.dispatch({
            type: this.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: { ruleFileContent: restoredRulefileContent }
        });
    },

    render() {
        if (!this.root) return;
        const state = this.getState();

        if (!state?.ruleFileContent?.metadata) {
            return;
        }

        // Spara ursprungsläget när vyn laddas
        this.initial_metadata_snapshot = this._clone_metadata(state.ruleFileContent.metadata);

        this.root.innerHTML = '';

        const { form, workingMetadata } = this._create_form(state.ruleFileContent.metadata);
        this.form_element_ref = form;
        this.working_metadata = workingMetadata;

        this.autosave_session?.destroy();
        this.autosave_session = this.AutosaveService?.create_session({
            form_element: form,
            focus_root: form,
            debounce_ms: 250,
            on_save: ({ should_trim, skip_render, trim_text }) => {
                if (!this.form_element_ref || !this.working_metadata) return;
                const updatedMetadata = this._parse_form_data(this.form_element_ref, this.working_metadata, should_trim, trim_text);
                const currentState = this.getState();
                const currentRulefile = currentState?.ruleFileContent || {};
                const updatedRulefileContent = {
                    ...currentRulefile,
                    metadata: {
                        ...currentRulefile.metadata,
                        ...updatedMetadata
                    }
                };
                this.dispatch({
                    type: this.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
                    payload: { ruleFileContent: updatedRulefileContent, skip_render: skip_render === true }
                });
            }
        }) || null;

        this.root.appendChild(form);
    },

    destroy() {
        // Spara autosparat data innan komponenten förstörs (vid navigering bort)
        if (!this.skip_autosave_on_destroy && this.form_element_ref && this.working_metadata) {
            this.autosave_session?.flush({ should_trim: true, skip_render: true });
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
        this.deps = null;
    }
};
