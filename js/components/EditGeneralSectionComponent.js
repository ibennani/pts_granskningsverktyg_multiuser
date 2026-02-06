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
        this.form_element_ref = null;
        this.working_metadata = null;
        this.save_form_data_immediately = this.save_form_data_immediately.bind(this);
        
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
                    rows: '4', 
                    ...(required ? { required: 'required' } : {})
                }
            });
            textarea.value = value ?? '';
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
        general_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_general') }));
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
        publisher_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_publisher') }));
        publisher_section.appendChild(this._create_field('rulefile_metadata_field_publisher_name', 'metadata.publisher.name', metadata.publisher?.name || ''));
        publisher_section.appendChild(this._create_field('rulefile_metadata_field_publisher_contact', 'metadata.publisher.contactPoint', metadata.publisher?.contactPoint || ''));

        // Source section
        const source_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        source_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_source') }));
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
            this.router('rulefile_sections', { section: 'general' });
        });

        footerActions.append(footerSaveButton, footerCancelButton);
        form.appendChild(footerActions);

        return { form, workingMetadata };
    },

    _parse_form_data(form, workingMetadata) {
        const formData = new FormData(form);
        const data = {};

        for (const [key, value] of formData.entries()) {
            const keys = key.split('.');
            let current = data;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }
            // Trim strängvärden för att ta bort inledande och avslutande mellanslag
            current[keys[keys.length - 1]] = typeof value === 'string' ? value.trim() : value;
        }

        // Merge with workingMetadata to preserve structure
        if (data.metadata) {
            if (data.metadata.monitoringType) {
                // Behåll befintlig type (nyckeln är en intern identifierare och ska inte ändras)
                workingMetadata.monitoringType = {
                    type: workingMetadata.monitoringType?.type || data.metadata.monitoringType.type || '',
                    text: typeof data.metadata.monitoringType.text === 'string' ? data.metadata.monitoringType.text.trim() : (data.metadata.monitoringType.text || '')
                };
            }
            if (data.metadata.publisher) {
                workingMetadata.publisher = {
                    name: typeof data.metadata.publisher.name === 'string' ? data.metadata.publisher.name.trim() : (data.metadata.publisher.name || ''),
                    contactPoint: typeof data.metadata.publisher.contactPoint === 'string' ? data.metadata.publisher.contactPoint.trim() : (data.metadata.publisher.contactPoint || '')
                };
            }
            if (data.metadata.source) {
                workingMetadata.source = {
                    url: typeof data.metadata.source.url === 'string' ? data.metadata.source.url.trim() : (data.metadata.source.url || ''),
                    title: typeof data.metadata.source.title === 'string' ? data.metadata.source.title.trim() : (data.metadata.source.title || ''),
                    retrievedDate: typeof data.metadata.source.retrievedDate === 'string' ? data.metadata.source.retrievedDate.trim() : (data.metadata.source.retrievedDate || ''),
                    format: typeof data.metadata.source.format === 'string' ? data.metadata.source.format.trim() : (data.metadata.source.format || '')
                };
            }
            // Copy other general fields
            Object.keys(data.metadata).forEach(key => {
                if (!['monitoringType', 'publisher', 'source'].includes(key)) {
                    const value = data.metadata[key];
                    workingMetadata[key] = typeof value === 'string' ? value.trim() : (value || '');
                }
            });
        }

        return workingMetadata;
    },

    save_form_data_immediately() {
        if (!this.form_element_ref || !this.working_metadata) return;
        
        // Spara aktuellt fokus och scroll-position innan autospar
        const activeElement = document.activeElement;
        const focusInfo = activeElement && this.form_element_ref.contains(activeElement) ? {
            elementId: activeElement.id || null,
            elementName: activeElement.name || null,
            selectionStart: activeElement.selectionStart !== undefined ? activeElement.selectionStart : null,
            selectionEnd: activeElement.selectionEnd !== undefined ? activeElement.selectionEnd : null,
            scrollTop: activeElement.scrollTop !== undefined ? activeElement.scrollTop : null,
            scrollLeft: activeElement.scrollLeft !== undefined ? activeElement.scrollLeft : null
        } : null;
        
        const windowScrollY = window.scrollY;
        const windowScrollX = window.scrollX;
        
        // Spara formulärdata tyst utan att påverka sidan
        const updatedMetadata = this._parse_form_data(this.form_element_ref, this.working_metadata);
        
        const state = this.getState();
        const currentRulefile = state?.ruleFileContent || {};
        
        const updatedRulefileContent = {
            ...currentRulefile,
            metadata: {
                ...currentRulefile.metadata,
                ...updatedMetadata
            }
        };

        // Dispatch - detta kommer att trigga listeners som kan re-rendera komponenter
        this.dispatch({
            type: this.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: { ruleFileContent: updatedRulefileContent }
        });
        
        // Återställ fokus och scroll-position efter att listeners har körts
        // Vänta lite längre för att säkerställa att render() har körts
        setTimeout(() => {
            requestAnimationFrame(() => {
                // Återställ window scroll-position
                window.scrollTo({ left: windowScrollX, top: windowScrollY, behavior: 'instant' });
                
                // Återställ fokus om det fanns ett aktivt element
                if (focusInfo && this.form_element_ref) {
                    let elementToFocus = null;
                    
                    // Försök hitta elementet via id först, sedan name
                    if (focusInfo.elementId) {
                        elementToFocus = this.form_element_ref.querySelector(`#${CSS.escape(focusInfo.elementId)}`);
                    }
                    if (!elementToFocus && focusInfo.elementName) {
                        elementToFocus = this.form_element_ref.querySelector(`[name="${CSS.escape(focusInfo.elementName)}"]`);
                    }
                    
                    if (elementToFocus && document.contains(elementToFocus)) {
                        // Återställ element scroll-position om det är ett scrollbart element
                        if (focusInfo.scrollTop !== null && elementToFocus.scrollTop !== undefined) {
                            elementToFocus.scrollTop = focusInfo.scrollTop;
                        }
                        if (focusInfo.scrollLeft !== null && elementToFocus.scrollLeft !== undefined) {
                            elementToFocus.scrollLeft = focusInfo.scrollLeft;
                        }
                        
                        // Återställ fokus
                        try {
                            elementToFocus.focus({ preventScroll: true });
                        } catch (e) {
                            elementToFocus.focus();
                        }
                        
                        // Återställ textmarkering om det är ett textfält
                        if (focusInfo.selectionStart !== null && focusInfo.selectionEnd !== null && elementToFocus.setSelectionRange) {
                            try {
                                elementToFocus.setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd);
                            } catch (e) {
                                // Ignorera om setSelectionRange inte fungerar
                            }
                        }
                    }
                }
            });
        }, 50);
    },

    _handle_submit(form, originalMetadata, workingMetadata) {
        const t = this.Translation.t;
        this.save_form_data_immediately();
        if (window.DraftManager?.commitCurrentDraft) {
            window.DraftManager.commitCurrentDraft();
        }

        this.NotificationComponent.show_global_message?.(t('rulefile_metadata_edit_saved'), 'success');
        
        // Navigera tillbaka till rulefile_sections med section=general (utan edit=true)
        sessionStorage.setItem('focusAfterLoad', '.rulefile-sections-header h2');
        this.router('rulefile_sections', { section: 'general' });
    },

    render() {
        if (!this.root) return;
        const state = this.getState();

        if (!state?.ruleFileContent?.metadata) {
            return;
        }

        this.root.innerHTML = '';

        const { form, workingMetadata } = this._create_form(state.ruleFileContent.metadata);
        this.form_element_ref = form;
        this.working_metadata = workingMetadata;

        this.root.appendChild(form);
    },

    destroy() {
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.form_element_ref = null;
        this.working_metadata = null;
        this.deps = null;
    }
};
