// js/components/EditRulefileMetadataViewComponent.js

export const EditRulefileMetadataViewComponent = {
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
        
        if (this.Helpers?.load_css) {
            await this.Helpers.load_css(this.CSS_PATH).catch(err => console.warn('[EditRulefileMetadataView] Failed to load CSS', err));
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
                attributes: { id: name, name, rows: '4', ...(required ? { required: 'required' } : {}) }
            });
            textarea.value = value ?? '';
            container.appendChild(textarea);
            this.Helpers.init_auto_resize_for_textarea?.(textarea);
        } else {
            const input = this.Helpers.create_element('input', {
                class_name: 'form-control',
                attributes: { id: name, name, type, ...(required ? { required: 'required' } : {}) }
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

        // Support both old format (direct) and new format (vocabularies)
        if (!workingMetadata.vocabularies) {
            // Migrate to new format if needed
            workingMetadata.vocabularies = {};
            if (workingMetadata.pageTypes) {
                workingMetadata.vocabularies.pageTypes = Array.isArray(workingMetadata.pageTypes) ? [...workingMetadata.pageTypes] : [];
            }
            if (workingMetadata.contentTypes) {
                workingMetadata.vocabularies.contentTypes = Array.isArray(workingMetadata.contentTypes) ? [...workingMetadata.contentTypes] : [];
            }
            if (workingMetadata.taxonomies) {
                workingMetadata.vocabularies.taxonomies = Array.isArray(workingMetadata.taxonomies) ? [...workingMetadata.taxonomies] : [];
            }
            // Handle sampleTypes - can be either an object with sampleCategories or an array
            if (workingMetadata.samples?.sampleTypes) {
                if (typeof workingMetadata.samples.sampleTypes === 'object' && !Array.isArray(workingMetadata.samples.sampleTypes)) {
                    // New format: object with sampleCategories and sampleTypes array
                    workingMetadata.vocabularies.sampleTypes = {
                        sampleCategories: Array.isArray(workingMetadata.samples.sampleTypes.sampleCategories) 
                            ? [...workingMetadata.samples.sampleTypes.sampleCategories] 
                            : [],
                        sampleTypes: Array.isArray(workingMetadata.samples.sampleTypes.sampleTypes) 
                            ? [...workingMetadata.samples.sampleTypes.sampleTypes] 
                            : []
                    };
                } else if (Array.isArray(workingMetadata.samples.sampleTypes)) {
                    // Old format: just an array
                    workingMetadata.vocabularies.sampleTypes = {
                        sampleCategories: [],
                        sampleTypes: [...workingMetadata.samples.sampleTypes]
                    };
                } else {
                    workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
                }
            } else {
                workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
            }
        }
        
        // Ensure vocabularies structure exists
        if (!workingMetadata.vocabularies.pageTypes) {
            workingMetadata.vocabularies.pageTypes = Array.isArray(workingMetadata.pageTypes) ? [...workingMetadata.pageTypes] : [];
        }
        if (!workingMetadata.vocabularies.contentTypes) {
            workingMetadata.vocabularies.contentTypes = Array.isArray(workingMetadata.contentTypes) ? [...workingMetadata.contentTypes] : [];
        }
        if (!workingMetadata.vocabularies.taxonomies) {
            workingMetadata.vocabularies.taxonomies = Array.isArray(workingMetadata.taxonomies) ? [...workingMetadata.taxonomies] : [];
        }
        if (!workingMetadata.vocabularies.sampleTypes) {
            workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
        }
        
        // Ensure sampleTypes is an object with both properties
        if (typeof workingMetadata.vocabularies.sampleTypes !== 'object' || Array.isArray(workingMetadata.vocabularies.sampleTypes)) {
            workingMetadata.vocabularies.sampleTypes = {
                sampleCategories: [],
                sampleTypes: Array.isArray(workingMetadata.vocabularies.sampleTypes) ? [...workingMetadata.vocabularies.sampleTypes] : []
            };
        }
        if (!Array.isArray(workingMetadata.vocabularies.sampleTypes.sampleCategories)) {
            workingMetadata.vocabularies.sampleTypes.sampleCategories = [];
        }
        if (!Array.isArray(workingMetadata.vocabularies.sampleTypes.sampleTypes)) {
            workingMetadata.vocabularies.sampleTypes.sampleTypes = [];
        }
        
        // Backward compatibility: also set direct properties
        workingMetadata.pageTypes = workingMetadata.vocabularies.pageTypes;
        workingMetadata.contentTypes = workingMetadata.vocabularies.contentTypes;
        workingMetadata.taxonomies = workingMetadata.vocabularies.taxonomies;
        
        if (!workingMetadata.samples) {
            workingMetadata.samples = { sampleCategories: [], sampleTypes: [] };
        }
        // Set sampleCategories from vocabularies
        workingMetadata.samples.sampleCategories = Array.isArray(workingMetadata.vocabularies.sampleTypes.sampleCategories)
            ? [...workingMetadata.vocabularies.sampleTypes.sampleCategories]
            : [];
        // Set sampleTypes array from vocabularies.sampleTypes.sampleTypes
        workingMetadata.samples.sampleTypes = Array.isArray(workingMetadata.vocabularies.sampleTypes.sampleTypes)
            ? [...workingMetadata.vocabularies.sampleTypes.sampleTypes]
            : [];
        workingMetadata.keywords = Array.isArray(workingMetadata.keywords) ? [...workingMetadata.keywords] : [];
        return workingMetadata;
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

    _create_inline_input(label_key, value, onChange, options = {}) {
        const { type = 'text', textarea = false, rawLabel = null } = options;
        const wrapper = this.Helpers.create_element('div', { class_name: 'inline-field' });
        const inputId = `inline-${Math.random().toString(36).substring(2, 10)}`;
        const labelText = rawLabel ?? this.Translation.t(label_key);
        const label = this.Helpers.create_element('label', { attributes: { for: inputId }, text_content: labelText });
        wrapper.appendChild(label);

        let input;
        if (textarea) {
            input = this.Helpers.create_element('textarea', {
                class_name: 'form-control form-control-compact',
                attributes: { id: inputId, rows: '3' }
            });
            input.value = value ?? '';
            this.Helpers.init_auto_resize_for_textarea?.(input);
            input.addEventListener('input', event => onChange(event.target.value));
        } else {
            input = this.Helpers.create_element('input', {
                class_name: 'form-control form-control-compact',
                attributes: { id: inputId, type }
            });
            input.value = value ?? '';
            input.addEventListener('input', event => onChange(event.target.value));
        }

        wrapper.appendChild(input);
        return wrapper;
    },

    _create_checkbox_input(label_key, checked, onChange) {
        const wrapper = this.Helpers.create_element('div', { class_name: 'form-check-inline' });
        const inputId = `checkbox-${Math.random().toString(36).substring(2, 10)}`;
        const input = this.Helpers.create_element('input', {
            class_name: 'form-check-input',
            attributes: { id: inputId, type: 'checkbox' }
        });
        input.checked = !!checked;
        input.addEventListener('change', event => onChange(event.target.checked));
        const label = this.Helpers.create_element('label', {
            attributes: { for: inputId },
            text_content: this.Translation.t(label_key),
            class_name: 'form-check-label'
        });
        wrapper.append(input, label);
        return wrapper;
    },

    _create_small_button(text_or_key, icon_name, onClick, variant = 'secondary', options = {}) {
        const { plainText = false, ariaLabel = null } = options;
        const resolveText = (value) => plainText ? value : this.Translation.t(value);
        const computeHtml = (value) => {
            const label = resolveText(value);
            const safeLabel = this.Helpers.escape_html ? this.Helpers.escape_html(label) : label;
            return `<span>${safeLabel}</span>` + (icon_name && this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg(icon_name) : '');
        };

        const button = this.Helpers.create_element('button', {
            class_name: ['button', `button-${variant}`, 'button-small'],
            attributes: { type: 'button' },
            html_content: computeHtml(text_or_key)
        });

        const resolvedAria = ariaLabel || resolveText(text_or_key);
        if (resolvedAria) {
            button.setAttribute('aria-label', resolvedAria);
        }

        button.addEventListener('click', onClick);

        button.updateButtonText = (newText, newAria) => {
            button.innerHTML = computeHtml(newText);
            const aria = newAria || resolveText(newText);
            if (aria) {
                button.setAttribute('aria-label', aria);
            }
        };

        return button;
    },

    _renderPageTypesEditor(container, workingMetadata) {
        container.innerHTML = '';

        if (!Array.isArray(workingMetadata.pageTypes) || workingMetadata.pageTypes.length === 0) {
            const emptyRow = this.Helpers.create_element('p', {
                class_name: 'editable-empty',
                text_content: this.Translation.t('rulefile_metadata_empty_value')
            });
            container.appendChild(emptyRow);
        }

        workingMetadata.pageTypes.forEach((pageType, index) => {
            const row = this.Helpers.create_element('div', { class_name: 'editable-list-row' });
            const displayName = pageType || this.Translation.t('rulefile_metadata_untitled_item');
            const removeLabel = this.Translation.t('rulefile_metadata_remove_page_type', { name: displayName });
            const removeBtn = this._create_small_button(removeLabel, 'delete', () => {
                workingMetadata.pageTypes.splice(index, 1);
                this._renderPageTypesEditor(container, workingMetadata);
            }, 'danger', { plainText: true, ariaLabel: removeLabel });

            const field = this._create_inline_input('rulefile_metadata_field_text', pageType, value => {
                workingMetadata.pageTypes[index] = value;
                const updatedName = value || this.Translation.t('rulefile_metadata_untitled_item');
                const updatedLabel = this.Translation.t('rulefile_metadata_remove_page_type', { name: updatedName });
                removeBtn.updateButtonText?.(updatedLabel, updatedLabel);
            }, { rawLabel: this.Translation.t('rulefile_metadata_field_text') });
            row.append(field, removeBtn);
            container.appendChild(row);
        });

        const addBtn = this._create_small_button('rulefile_metadata_add_page_type', 'add', () => {
            workingMetadata.pageTypes.push('');
            this._renderPageTypesEditor(container, workingMetadata);
        });
        container.appendChild(addBtn);
    },

    _renderContentTypesEditor(container, workingMetadata) {
        container.innerHTML = '';

        if (!Array.isArray(workingMetadata.contentTypes) || workingMetadata.contentTypes.length === 0) {
            const emptyRow = this.Helpers.create_element('p', {
                class_name: 'editable-empty',
                text_content: this.Translation.t('rulefile_metadata_empty_value')
            });
            container.appendChild(emptyRow);
        }

        workingMetadata.contentTypes.forEach((parent, parentIndex) => {
            if (!parent) {
                workingMetadata.contentTypes[parentIndex] = { id: '', text: '', description: '', types: [] };
                parent = workingMetadata.contentTypes[parentIndex];
            }
            parent.types = Array.isArray(parent.types) ? parent.types : [];

            const card = this.Helpers.create_element('article', { class_name: 'editable-card' });
            const headingRow = this.Helpers.create_element('div', { class_name: 'editable-card-header' });
            const heading = this.Helpers.create_element('h3', { text_content: parent.text || this.Translation.t('rulefile_metadata_untitled_item') });
            const initialRemoveLabel = this.Translation.t('rulefile_metadata_remove_content_type', { name: heading.textContent });
            const removeParentBtn = this._create_small_button(initialRemoveLabel, 'delete', () => {
                workingMetadata.contentTypes.splice(parentIndex, 1);
                this._renderContentTypesEditor(container, workingMetadata);
            }, 'danger', { plainText: true, ariaLabel: initialRemoveLabel });
            headingRow.append(heading, removeParentBtn);
            card.appendChild(headingRow);

            card.appendChild(this._create_inline_input('rulefile_metadata_field_text', parent.text || '', value => {
                parent.text = value;
                const displayName = value || this.Translation.t('rulefile_metadata_untitled_item');
                heading.textContent = displayName;
                const updatedLabel = this.Translation.t('rulefile_metadata_remove_content_type', { name: displayName });
                removeParentBtn.updateButtonText?.(updatedLabel, updatedLabel);
            }));
            card.appendChild(this._create_inline_input('rulefile_metadata_field_description', parent.description || '', value => {
                parent.description = value;
            }, { textarea: true }));

            const childList = this.Helpers.create_element('div', { class_name: 'editable-sublist' });
            parent.types.forEach((child, childIndex) => {
                if (!child) {
                    parent.types[childIndex] = { id: '', text: '', description: '' };
                    child = parent.types[childIndex];
                }
                const childCard = this.Helpers.create_element('div', { class_name: 'editable-card editable-child-card' });
                const childDisplayName = child.text || this.Translation.t('rulefile_metadata_untitled_item');
                const removeChildInitial = this.Translation.t('rulefile_metadata_remove_content_subtype', { name: childDisplayName });
                const removeChildBtn = this._create_small_button(removeChildInitial, 'delete', () => {
                    parent.types.splice(childIndex, 1);
                    this._renderContentTypesEditor(container, workingMetadata);
                }, 'danger', { plainText: true, ariaLabel: removeChildInitial });
                childCard.appendChild(removeChildBtn);

                childCard.appendChild(this._create_inline_input('rulefile_metadata_field_text', child.text || '', value => {
                    child.text = value;
                    const updatedName = value || this.Translation.t('rulefile_metadata_untitled_item');
                    const updatedLabel = this.Translation.t('rulefile_metadata_remove_content_subtype', { name: updatedName });
                    removeChildBtn.updateButtonText?.(updatedLabel, updatedLabel);
                }));
                childCard.appendChild(this._create_inline_input('rulefile_metadata_field_description', child.description || '', value => {
                    child.description = value;
                }, { textarea: true }));
                childList.appendChild(childCard);
            });

            const addChildBtn = this._create_small_button('rulefile_metadata_add_content_subtype', 'add', () => {
                parent.types.push({ id: '', text: '', description: '' });
                this._renderContentTypesEditor(container, workingMetadata);
            });
            childList.appendChild(addChildBtn);
            card.appendChild(childList);
            container.appendChild(card);
        });

        const addParentBtn = this._create_small_button('rulefile_metadata_add_content_type', 'add', () => {
            workingMetadata.contentTypes.push({ id: '', text: '', description: '', types: [] });
            this._renderContentTypesEditor(container, workingMetadata);
        });
        container.appendChild(addParentBtn);
    },

    _renderSampleCategoriesEditor(container, workingMetadata) {
        container.innerHTML = '';
        // Support both old format (metadata.samples.sampleCategories) and new format (metadata.vocabularies.sampleTypes.sampleCategories)
        const categories = workingMetadata.vocabularies?.sampleTypes?.sampleCategories || workingMetadata.samples?.sampleCategories || [];
        if (categories.length === 0) {
            container.appendChild(this.Helpers.create_element('p', {
                class_name: 'editable-empty',
                text_content: this.Translation.t('rulefile_metadata_empty_value')
            }));
        }

        categories.forEach((category, categoryIndex) => {
            if (!category) {
                categories[categoryIndex] = { id: '', text: '', hasUrl: false, categories: [] };
                category = categories[categoryIndex];
            }
            category.categories = Array.isArray(category.categories) ? category.categories : [];

            const card = this.Helpers.create_element('article', { class_name: 'editable-card' });
            const headingRow = this.Helpers.create_element('div', { class_name: 'editable-card-header' });
            const heading = this.Helpers.create_element('h3', { text_content: category.text || this.Translation.t('rulefile_metadata_untitled_item') });
            const removeCategoryInitial = this.Translation.t('rulefile_metadata_remove_sample_category', { name: heading.textContent });
            const removeCategoryBtn = this._create_small_button(removeCategoryInitial, 'delete', () => {
                categories.splice(categoryIndex, 1);
                // Ensure vocabularies structure is updated
                if (!workingMetadata.vocabularies) {
                    workingMetadata.vocabularies = {};
                }
                if (!workingMetadata.vocabularies.sampleTypes) {
                    workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
                }
                workingMetadata.vocabularies.sampleTypes.sampleCategories = categories;
                // Also update samples for backward compatibility
                if (!workingMetadata.samples) {
                    workingMetadata.samples = { sampleCategories: [], sampleTypes: [] };
                }
                workingMetadata.samples.sampleCategories = categories;
                this._renderSampleCategoriesEditor(container, workingMetadata);
            }, 'danger', { plainText: true, ariaLabel: removeCategoryInitial });
            headingRow.append(heading, removeCategoryBtn);
            card.appendChild(headingRow);

            card.appendChild(this._create_inline_input('rulefile_metadata_field_text', category.text || '', value => {
                category.text = value;
                // Sync to vocabularies structure
                if (!workingMetadata.vocabularies) {
                    workingMetadata.vocabularies = {};
                }
                if (!workingMetadata.vocabularies.sampleTypes) {
                    workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
                }
                workingMetadata.vocabularies.sampleTypes.sampleCategories = categories;
                // Also update samples for backward compatibility
                if (!workingMetadata.samples) {
                    workingMetadata.samples = { sampleCategories: [], sampleTypes: [] };
                }
                workingMetadata.samples.sampleCategories = categories;
                const updatedName = value || this.Translation.t('rulefile_metadata_untitled_item');
                const updatedLabel = this.Translation.t('rulefile_metadata_remove_sample_category', { name: updatedName });
                heading.textContent = updatedName;
                removeCategoryBtn.updateButtonText?.(updatedLabel, updatedLabel);
            }));
            card.appendChild(this._create_checkbox_input('rulefile_metadata_field_has_url', category.hasUrl, value => {
                category.hasUrl = value;
                // Sync to vocabularies structure
                if (!workingMetadata.vocabularies) {
                    workingMetadata.vocabularies = {};
                }
                if (!workingMetadata.vocabularies.sampleTypes) {
                    workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
                }
                workingMetadata.vocabularies.sampleTypes.sampleCategories = categories;
                // Also update samples for backward compatibility
                if (!workingMetadata.samples) {
                    workingMetadata.samples = { sampleCategories: [], sampleTypes: [] };
                }
                workingMetadata.samples.sampleCategories = categories;
            }));

            const subList = this.Helpers.create_element('div', { class_name: 'editable-sublist' });
            category.categories.forEach((subCategory, subIndex) => {
                if (!subCategory) {
                    category.categories[subIndex] = { id: '', text: '' };
                    subCategory = category.categories[subIndex];
                }
                const row = this.Helpers.create_element('div', { class_name: 'editable-list-row' });
                const subDisplay = subCategory.text || this.Translation.t('rulefile_metadata_untitled_item');
                const removeSubInitial = this.Translation.t('rulefile_metadata_remove_sample_subcategory', { name: subDisplay });
                const removeSubBtn = this._create_small_button(removeSubInitial, 'delete', () => {
                    category.categories.splice(subIndex, 1);
                    // Sync to vocabularies structure
                    if (!workingMetadata.vocabularies) {
                        workingMetadata.vocabularies = {};
                    }
                    if (!workingMetadata.vocabularies.sampleTypes) {
                        workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
                    }
                    workingMetadata.vocabularies.sampleTypes.sampleCategories = categories;
                    // Also update samples for backward compatibility
                    if (!workingMetadata.samples) {
                        workingMetadata.samples = { sampleCategories: [], sampleTypes: [] };
                    }
                    workingMetadata.samples.sampleCategories = categories;
                    this._renderSampleCategoriesEditor(container, workingMetadata);
                }, 'danger', { plainText: true, ariaLabel: removeSubInitial });
                row.appendChild(this._create_inline_input('rulefile_metadata_field_text', subCategory.text || '', value => {
                    subCategory.text = value;
                    // Sync to vocabularies structure
                    if (!workingMetadata.vocabularies) {
                        workingMetadata.vocabularies = {};
                    }
                    if (!workingMetadata.vocabularies.sampleTypes) {
                        workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
                    }
                    workingMetadata.vocabularies.sampleTypes.sampleCategories = categories;
                    // Also update samples for backward compatibility
                    if (!workingMetadata.samples) {
                        workingMetadata.samples = { sampleCategories: [], sampleTypes: [] };
                    }
                    workingMetadata.samples.sampleCategories = categories;
                    const updatedName = value || this.Translation.t('rulefile_metadata_untitled_item');
                    const updatedLabel = this.Translation.t('rulefile_metadata_remove_sample_subcategory', { name: updatedName });
                    removeSubBtn.updateButtonText?.(updatedLabel, updatedLabel);
                }));
                row.appendChild(removeSubBtn);
                subList.appendChild(row);
            });

            const addSubBtn = this._create_small_button('rulefile_metadata_add_sample_subcategory', 'add', () => {
                category.categories.push({ id: '', text: '' });
                // Sync to vocabularies structure
                if (!workingMetadata.vocabularies) {
                    workingMetadata.vocabularies = {};
                }
                if (!workingMetadata.vocabularies.sampleTypes) {
                    workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
                }
                workingMetadata.vocabularies.sampleTypes.sampleCategories = categories;
                // Also update samples for backward compatibility
                if (!workingMetadata.samples) {
                    workingMetadata.samples = { sampleCategories: [], sampleTypes: [] };
                }
                workingMetadata.samples.sampleCategories = categories;
                this._renderSampleCategoriesEditor(container, workingMetadata);
            });
            subList.appendChild(addSubBtn);
            card.appendChild(subList);
            container.appendChild(card);
        });

        const addCategoryBtn = this._create_small_button('rulefile_metadata_add_sample_category', 'add', () => {
            categories.push({ id: '', text: '', hasUrl: false, categories: [] });
            // Ensure vocabularies structure is updated
            if (!workingMetadata.vocabularies) {
                workingMetadata.vocabularies = {};
            }
            if (!workingMetadata.vocabularies.sampleTypes) {
                workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
            }
            workingMetadata.vocabularies.sampleTypes.sampleCategories = categories;
            // Also update samples for backward compatibility
            if (!workingMetadata.samples) {
                workingMetadata.samples = { sampleCategories: [], sampleTypes: [] };
            }
            workingMetadata.samples.sampleCategories = categories;
            this._renderSampleCategoriesEditor(container, workingMetadata);
        });
        container.appendChild(addCategoryBtn);
    },

    _renderSampleTypesEditor(container, workingMetadata) {
        container.innerHTML = '';
        const sampleTypes = workingMetadata.samples.sampleTypes || [];

        if (sampleTypes.length === 0) {
            container.appendChild(this.Helpers.create_element('p', {
                class_name: 'editable-empty',
                text_content: this.Translation.t('rulefile_metadata_empty_value')
            }));
        }

        sampleTypes.forEach((type, index) => {
            const row = this.Helpers.create_element('div', { class_name: 'editable-list-row' });
            const displayName = type || this.Translation.t('rulefile_metadata_untitled_item');
            const removeLabel = this.Translation.t('rulefile_metadata_remove_sample_type', { name: displayName });
            const removeBtn = this._create_small_button(removeLabel, 'delete', () => {
                sampleTypes.splice(index, 1);
                this._renderSampleTypesEditor(container, workingMetadata);
            }, 'danger', { plainText: true, ariaLabel: removeLabel });
            row.appendChild(this._create_inline_input('rulefile_metadata_field_text', type || '', value => {
                sampleTypes[index] = value;
                const updatedName = value || this.Translation.t('rulefile_metadata_untitled_item');
                const updatedLabel = this.Translation.t('rulefile_metadata_remove_sample_type', { name: updatedName });
                removeBtn.updateButtonText?.(updatedLabel, updatedLabel);
            }, { rawLabel: this.Translation.t('rulefile_metadata_field_text') }));
            row.appendChild(removeBtn);
            container.appendChild(row);
        });

        const addBtn = this._create_small_button('rulefile_metadata_add_sample_type', 'add', () => {
            sampleTypes.push('');
            this._renderSampleTypesEditor(container, workingMetadata);
        });
        container.appendChild(addBtn);
    },

    _renderTaxonomiesEditor(container, workingMetadata) {
        container.innerHTML = '';
        if (!Array.isArray(workingMetadata.taxonomies) || workingMetadata.taxonomies.length === 0) {
            container.appendChild(this.Helpers.create_element('p', {
                class_name: 'editable-empty',
                text_content: this.Translation.t('rulefile_metadata_empty_value')
            }));
        }

        workingMetadata.taxonomies.forEach((taxonomy, taxonomyIndex) => {
            if (!taxonomy) {
                workingMetadata.taxonomies[taxonomyIndex] = { id: '', label: '', version: '', uri: '', concepts: [] };
                taxonomy = workingMetadata.taxonomies[taxonomyIndex];
            }
            taxonomy.concepts = Array.isArray(taxonomy.concepts) ? taxonomy.concepts : [];

            const card = this.Helpers.create_element('article', { class_name: 'editable-card' });
            const headingRow = this.Helpers.create_element('div', { class_name: 'editable-card-header' });
            const heading = this.Helpers.create_element('h3', { text_content: taxonomy.label || this.Translation.t('rulefile_metadata_untitled_item') });
            const removeTaxonomyInitial = this.Translation.t('rulefile_metadata_remove_taxonomy', { name: heading.textContent });
            const removeTaxonomyBtn = this._create_small_button(removeTaxonomyInitial, 'delete', () => {
                workingMetadata.taxonomies.splice(taxonomyIndex, 1);
                this._renderTaxonomiesEditor(container, workingMetadata);
            }, 'danger', { plainText: true, ariaLabel: removeTaxonomyInitial });
            headingRow.append(heading, removeTaxonomyBtn);
            card.appendChild(headingRow);

            card.appendChild(this._create_inline_input('rulefile_metadata_field_label', taxonomy.label || '', value => {
                taxonomy.label = value;
                const updatedName = value || this.Translation.t('rulefile_metadata_untitled_item');
                heading.textContent = updatedName;
                const updatedLabel = this.Translation.t('rulefile_metadata_remove_taxonomy', { name: updatedName });
                removeTaxonomyBtn.updateButtonText?.(updatedLabel, updatedLabel);
            }));
            card.appendChild(this._create_inline_input('rulefile_metadata_field_taxonomy_version', taxonomy.version || '', value => {
                taxonomy.version = value;
            }));
            card.appendChild(this._create_inline_input('rulefile_metadata_field_taxonomy_uri', taxonomy.uri || '', value => {
                taxonomy.uri = value;
            }));

            const conceptList = this.Helpers.create_element('div', { class_name: 'editable-sublist' });
            taxonomy.concepts.forEach((concept, conceptIndex) => {
                if (!concept) {
                    taxonomy.concepts[conceptIndex] = { id: '', label: '' };
                    concept = taxonomy.concepts[conceptIndex];
                }
                const row = this.Helpers.create_element('div', { class_name: 'editable-list-row' });
                const conceptName = concept.label || this.Translation.t('rulefile_metadata_untitled_item');
                const removeConceptInitial = this.Translation.t('rulefile_metadata_remove_taxonomy_concept', { name: conceptName });
                const removeConceptBtn = this._create_small_button(removeConceptInitial, 'delete', () => {
                    taxonomy.concepts.splice(conceptIndex, 1);
                    this._renderTaxonomiesEditor(container, workingMetadata);
                }, 'danger', { plainText: true, ariaLabel: removeConceptInitial });
                row.appendChild(this._create_inline_input('rulefile_metadata_field_label', concept.label || '', value => {
                    concept.label = value;
                    const updatedName = value || this.Translation.t('rulefile_metadata_untitled_item');
                    const updatedLabel = this.Translation.t('rulefile_metadata_remove_taxonomy_concept', { name: updatedName });
                    removeConceptBtn.updateButtonText?.(updatedLabel, updatedLabel);
                }));
                row.appendChild(removeConceptBtn);
                conceptList.appendChild(row);
            });

            const addConceptBtn = this._create_small_button('rulefile_metadata_add_taxonomy_concept', 'add', () => {
                taxonomy.concepts.push({ id: '', label: '' });
                this._renderTaxonomiesEditor(container, workingMetadata);
            });
            conceptList.appendChild(addConceptBtn);

            card.appendChild(conceptList);
            container.appendChild(card);
        });

        const addTaxonomyBtn = this._create_small_button('rulefile_metadata_add_taxonomy', 'add', () => {
            workingMetadata.taxonomies.push({ id: '', label: '', version: '', uri: '', concepts: [] });
            this._renderTaxonomiesEditor(container, workingMetadata);
        });
        container.appendChild(addTaxonomyBtn);
    },

    _create_report_template_section(reportTemplate, metadata) {
        const t = this.Translation.t;
        const section = this.Helpers.create_element('section', { class_name: 'form-section' });
        section.appendChild(this.Helpers.create_element('h2', { text_content: t('report_template_sections_title') || 'Rapportmall - Sektioner' }));
        
        const current_state = this.getState();
        const block_order = metadata?.blockOrders?.reportSections || [];
        const sections = reportTemplate.sections || {};
        
        const container = this.Helpers.create_element('div', { class_name: 'report-sections-editor' });
        
        // Render sections in order from blockOrders.reportSections
        const ordered_section_ids = [...block_order];
        const extra_section_ids = Object.keys(sections).filter(id => !ordered_section_ids.includes(id));
        ordered_section_ids.push(...extra_section_ids);
        
        ordered_section_ids.forEach((section_id, index) => {
            const section_data = sections[section_id] || { name: '', required: false, content: '' };
            
            const section_card = this.Helpers.create_element('div', { 
                class_name: 'report-section-card',
                attributes: { 'data-section-id': section_id }
            });
            
            const header = this.Helpers.create_element('div', { class_name: 'report-section-header' });
            
            // Move up button
            if (index > 0) {
                const move_up_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-small', 'button-default'],
                    attributes: { type: 'button', 'data-action': 'move-section-up', 'data-section-id': section_id },
                    html_content: this.Helpers.get_icon_svg('arrow_upward', [], 16)
                });
                move_up_btn.addEventListener('click', () => {
                    const current_index = ordered_section_ids.indexOf(section_id);
                    if (current_index > 0) {
                        ordered_section_ids.splice(current_index, 1);
                        ordered_section_ids.splice(current_index - 1, 0, section_id);
                        this._render_report_template_sections(container, reportTemplate, metadata);
                    }
                });
                header.appendChild(move_up_btn);
            }
            
            // Move down button
            if (index < ordered_section_ids.length - 1) {
                const move_down_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-small', 'button-default'],
                    attributes: { type: 'button', 'data-action': 'move-section-down', 'data-section-id': section_id },
                    html_content: this.Helpers.get_icon_svg('arrow_downward', [], 16)
                });
                move_down_btn.addEventListener('click', () => {
                    const current_index = ordered_section_ids.indexOf(section_id);
                    if (current_index < ordered_section_ids.length - 1) {
                        ordered_section_ids.splice(current_index, 1);
                        ordered_section_ids.splice(current_index + 1, 0, section_id);
                        this._render_report_template_sections(container, reportTemplate, metadata);
                    }
                });
                header.appendChild(move_down_btn);
            }
            
            // Section name input
            const name_input = this.Helpers.create_element('input', {
                class_name: 'form-control',
                attributes: {
                    type: 'text',
                    'data-section-id': section_id,
                    'data-field': 'name',
                    value: section_data.name || '',
                    placeholder: t('report_section_name_placeholder') || 'Sektionsnamn'
                }
            });
            name_input.style.width = '200px';
            name_input.style.display = 'inline-block';
            header.appendChild(name_input);
            
            // Required checkbox
            const required_label = this.Helpers.create_element('label', {
                class_name: 'checkbox-label',
                attributes: { 'for': `section_${section_id}_required` }
            });
            const required_checkbox = this.Helpers.create_element('input', {
                attributes: {
                    id: `section_${section_id}_required`,
                    type: 'checkbox',
                    'data-section-id': section_id,
                    'data-field': 'required',
                    checked: section_data.required === true,
                    disabled: section_data.required === true // Can't uncheck if required
                }
            });
            required_label.appendChild(required_checkbox);
            required_label.appendChild(document.createTextNode(' ' + (t('report_section_required') || 'Obligatorisk')));
            header.appendChild(required_label);
            
            // Delete button (only if not required)
            if (!section_data.required) {
                const delete_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-small', 'button-danger'],
                    attributes: { type: 'button', 'data-action': 'delete-section', 'data-section-id': section_id },
                    html_content: this.Helpers.get_icon_svg('delete', [], 16)
                });
                delete_btn.addEventListener('click', () => {
                    if (confirm(t('confirm_delete_report_section') || 'Är du säker på att du vill ta bort denna sektion?')) {
                        delete sections[section_id];
                        const order_index = ordered_section_ids.indexOf(section_id);
                        if (order_index !== -1) {
                            ordered_section_ids.splice(order_index, 1);
                        }
                        this._render_report_template_sections(container, reportTemplate, metadata);
                    }
                });
                header.appendChild(delete_btn);
            }
            
            section_card.appendChild(header);
            
            // Content textarea
            const content_group = this.Helpers.create_element('div', { class_name: 'form-group' });
            const content_label = this.Helpers.create_element('label', {
                attributes: { 'for': `section_${section_id}_content` },
                text_content: t('report_section_content') || 'Innehåll (Markdown)'
            });
            const content_textarea = this.Helpers.create_element('textarea', {
                class_name: 'form-control',
                attributes: {
                    id: `section_${section_id}_content`,
                    'data-section-id': section_id,
                    'data-field': 'content',
                    rows: '6'
                }
            });
            content_textarea.value = section_data.content || '';
            this.Helpers.init_auto_resize_for_textarea?.(content_textarea);
            content_group.appendChild(content_label);
            content_group.appendChild(content_textarea);
            section_card.appendChild(content_group);
            
            container.appendChild(section_card);
        });
        
        // Add new section button
        const add_section_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-secondary'],
            attributes: { type: 'button' },
            html_content: `<span>${t('add_report_section') || 'Lägg till rapportsektion'}</span>` + this.Helpers.get_icon_svg('add', [], 16)
        });
        add_section_btn.addEventListener('click', () => {
            const new_id = `section-${this.Helpers.generate_uuid_v4().substring(0, 8)}`;
            sections[new_id] = {
                name: t('new_report_section') || 'Ny sektion',
                required: false,
                content: ''
            };
            // Add to order list
            const block_order = metadata?.blockOrders?.reportSections || [];
            block_order.push(new_id);
            if (!metadata.blockOrders) {
                metadata.blockOrders = {};
            }
            if (!metadata.blockOrders.reportSections) {
                metadata.blockOrders.reportSections = [];
            }
            metadata.blockOrders.reportSections = block_order;
            this._render_report_template_sections(container, reportTemplate, metadata);
        });
        container.appendChild(add_section_btn);
        
        section.appendChild(container);
        
        // Store reference for updates
        this._report_template_ref = reportTemplate;
        this._report_template_metadata_ref = metadata;
        
        return section;
    },

    _render_report_template_sections(container, reportTemplate, metadata) {
        // Re-render the sections editor
        const parent_section = container.closest('.form-section');
        if (parent_section) {
            const form = parent_section.closest('form');
            if (form) {
                // Re-create the entire report template section
                const old_section = parent_section;
                const new_section = this._create_report_template_section(reportTemplate, metadata);
                old_section.replaceWith(new_section);
            }
        }
    },

    _create_form(metadata) {
        const workingMetadata = this._ensure_metadata_defaults(this._clone_metadata(metadata));
        const form = this.Helpers.create_element('form', { class_name: 'rulefile-metadata-edit-form' });

        const general_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        general_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_general') }));
        general_section.appendChild(this._create_field('rulefile_metadata_field_title', 'metadata.title', metadata.title || '', 'text', { required: true }));
        general_section.appendChild(this._create_field('rulefile_metadata_field_description', 'metadata.description', metadata.description || '', 'textarea'));
        general_section.appendChild(this._create_field('rulefile_metadata_field_version', 'metadata.version', metadata.version || ''));
        general_section.appendChild(this._create_field('rulefile_metadata_field_language', 'metadata.language', metadata.language || ''));
        general_section.appendChild(this._create_field('rulefile_metadata_field_monitoring_type_key', 'metadata.monitoringType.type', metadata.monitoringType?.type || ''));
        general_section.appendChild(this._create_field('rulefile_metadata_field_monitoring_type_label', 'metadata.monitoringType.text', metadata.monitoringType?.text || ''));
        general_section.appendChild(this._create_field('rulefile_metadata_field_date_created', 'metadata.dateCreated', metadata.dateCreated || '', 'date'));
        general_section.appendChild(this._create_field('rulefile_metadata_field_date_modified', 'metadata.dateModified', metadata.dateModified || '', 'date'));
        general_section.appendChild(this._create_field('rulefile_metadata_field_license', 'metadata.license', metadata.license || ''));

        const publisher_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        publisher_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_publisher') }));
        publisher_section.appendChild(this._create_field('rulefile_metadata_field_publisher_name', 'metadata.publisher.name', metadata.publisher?.name || ''));
        publisher_section.appendChild(this._create_field('rulefile_metadata_field_publisher_contact', 'metadata.publisher.contactPoint', metadata.publisher?.contactPoint || ''));

        const source_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        source_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_source') }));
        source_section.appendChild(this._create_field('rulefile_metadata_field_source_url', 'metadata.source.url', metadata.source?.url || '', 'url'));
        source_section.appendChild(this._create_field('rulefile_metadata_field_source_title', 'metadata.source.title', metadata.source?.title || ''));
        source_section.appendChild(this._create_field('rulefile_metadata_field_source_retrieved', 'metadata.source.retrievedDate', metadata.source?.retrievedDate || '', 'date'));
        source_section.appendChild(this._create_field('rulefile_metadata_field_source_format', 'metadata.source.format', metadata.source?.format || ''));

        const keywords_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        keywords_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_keywords') }));
        const keywords_text = Array.isArray(metadata.keywords) ? metadata.keywords.join('\n') : '';
        const keywords_field = this._create_field('rulefile_metadata_field_keywords', 'metadata.keywords', keywords_text, 'textarea');
        keywords_field.appendChild(this.Helpers.create_element('p', {
            class_name: 'field-hint',
            text_content: this.Translation.t('rulefile_metadata_field_keywords_hint')
        }));
        keywords_section.appendChild(keywords_field);

        const page_types_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        page_types_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_page_types') }));
        const page_types_body = this.Helpers.create_element('div', { class_name: 'editable-list-container' });
        page_types_section.appendChild(page_types_body);
        this._renderPageTypesEditor(page_types_body, workingMetadata);

        const content_types_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        content_types_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_content_types') }));
        const content_types_body = this.Helpers.create_element('div', { class_name: 'editable-card-list' });
        content_types_section.appendChild(content_types_body);
        this._renderContentTypesEditor(content_types_body, workingMetadata);

        const samples_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        samples_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_samples') }));
        samples_section.appendChild(this.Helpers.create_element('h3', { text_content: this.Translation.t('rulefile_metadata_sample_categories_title') }));
        const sample_categories_body = this.Helpers.create_element('div', { class_name: 'editable-card-list' });
        samples_section.appendChild(sample_categories_body);
        this._renderSampleCategoriesEditor(sample_categories_body, workingMetadata);
        samples_section.appendChild(this.Helpers.create_element('h3', { text_content: this.Translation.t('rulefile_metadata_sample_types_title') }));
        const sample_types_body = this.Helpers.create_element('div', { class_name: 'editable-list-container' });
        samples_section.appendChild(sample_types_body);
        this._renderSampleTypesEditor(sample_types_body, workingMetadata);

        const taxonomies_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        taxonomies_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_taxonomies') }));
        const taxonomies_body = this.Helpers.create_element('div', { class_name: 'editable-card-list' });
        taxonomies_section.appendChild(taxonomies_body);
        this._renderTaxonomiesEditor(taxonomies_body, workingMetadata);

        // Report Template Sections (if reportTemplate exists in ruleFileContent)
        const current_state = this.getState();
        const rule_file_content = current_state?.ruleFileContent || {};
        const report_template = rule_file_content.reportTemplate || { sections: {} };
        // Ensure reportTemplate.sections exists
        if (!report_template.sections) {
            report_template.sections = {};
        }
        const report_sections_section = this._create_report_template_section(report_template, workingMetadata);
        
        form.append(
            general_section,
            publisher_section,
            source_section,
            keywords_section,
            page_types_section,
            content_types_section,
            samples_section,
            taxonomies_section,
            report_sections_section
        );

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
            html_content: `<span>${this.Translation.t('rulefile_metadata_view_without_saving')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('visibility') : '')
        });
        footerCancelButton.addEventListener('click', () => this.router('edit_rulefile_main'));

        footerActions.append(footerSaveButton, footerCancelButton);
        form.appendChild(footerActions);

        return { form, workingMetadata };
    },

    _handle_submit(form, originalMetadata, workingMetadata) {
        const t = this.Translation.t;
        const formData = new FormData(form);
        const getValue = name => (formData.get(name) || '').toString().trim();

        const keywords_input = getValue('metadata.keywords');
        const keywords = keywords_input
            ? keywords_input.split(/[\n\r,]+/).map(entry => entry.trim()).filter(Boolean)
            : [];

        const cleanedPageTypes = (workingMetadata.pageTypes || [])
            .map(entry => (entry || '').trim())
            .filter(Boolean);

        const cleanedContentTypes = (workingMetadata.contentTypes || []).map(parent => {
            const cleanedParent = {
                id: (parent.id || '').trim(),
                text: (parent.text || '').trim(),
                description: (parent.description || '').trim()
            };
            const childTypes = Array.isArray(parent.types) ? parent.types : [];
            cleanedParent.types = childTypes
                .map(child => ({
                    id: (child?.id || '').trim(),
                    text: (child?.text || '').trim(),
                    description: (child?.description || '').trim()
                }))
                .filter(child => child.id || child.text || child.description);
            return cleanedParent;
        }).filter(parent => parent.id || parent.text || parent.description || (parent.types && parent.types.length > 0));

        const cleanedSampleCategories = (workingMetadata.samples?.sampleCategories || []).map(category => {
            const cleanedCategory = {
                id: (category?.id || '').trim(),
                text: (category?.text || '').trim(),
                hasUrl: !!category?.hasUrl
            };
            const subCategories = Array.isArray(category?.categories) ? category.categories : [];
            cleanedCategory.categories = subCategories
                .map(sub => ({
                    id: (sub?.id || '').trim(),
                    text: (sub?.text || '').trim()
                }))
                .filter(sub => sub.id || sub.text);
            return cleanedCategory;
        }).filter(cat => cat.id || cat.text || (cat.categories && cat.categories.length > 0));

        const cleanedSampleTypes = (workingMetadata.samples?.sampleTypes || [])
            .map(entry => (entry || '').trim())
            .filter(Boolean);

        const cleanedTaxonomies = (workingMetadata.taxonomies || []).map(taxonomy => {
            const cleanedTaxonomy = {
                id: (taxonomy?.id || '').trim(),
                label: (taxonomy?.label || '').trim(),
                version: (taxonomy?.version || '').trim(),
                uri: (taxonomy?.uri || '').trim()
            };
            const concepts = Array.isArray(taxonomy?.concepts) ? taxonomy.concepts : [];
            cleanedTaxonomy.concepts = concepts
                .map(concept => ({
                    id: (concept?.id || '').trim(),
                    label: (concept?.label || '').trim()
                }))
                .filter(concept => concept.id || concept.label);
            return cleanedTaxonomy;
        }).filter(taxonomy => taxonomy.id || taxonomy.label || taxonomy.version || taxonomy.uri || (taxonomy.concepts && taxonomy.concepts.length > 0));

        const contentTypeSlugSet = new Set(cleanedContentTypes.map(ct => ct.id).filter(Boolean));
        cleanedContentTypes.forEach(parent => {
            if (!parent.id) {
                parent.id = this._ensure_unique_slug(contentTypeSlugSet, this._generate_slug(parent.text), 'content-type');
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

        const sampleCategorySlugSet = new Set(cleanedSampleCategories.map(cat => cat.id).filter(Boolean));
        cleanedSampleCategories.forEach(category => {
            if (!category.id) {
                category.id = this._ensure_unique_slug(sampleCategorySlugSet, this._generate_slug(category.text), 'sample-category');
            } else {
                sampleCategorySlugSet.add(category.id);
            }

            const subSlugSet = new Set(category.categories.map(sub => sub.id).filter(Boolean));
            category.categories.forEach(sub => {
                if (!sub.id) {
                    const subSlug = this._generate_slug(sub.text);
                    const base = category.id || 'category';
                    const preferred = subSlug ? `${base}-${subSlug}` : '';
                    sub.id = this._ensure_unique_slug(subSlugSet, preferred, `${base}-subcategory`);
                } else {
                    subSlugSet.add(sub.id);
                }
            });
        });

        const taxonomySlugSet = new Set(cleanedTaxonomies.map(t => t.id).filter(Boolean));
        cleanedTaxonomies.forEach(taxonomy => {
            if (!taxonomy.id) {
                taxonomy.id = this._ensure_unique_slug(taxonomySlugSet, this._generate_slug(taxonomy.label), 'taxonomy');
            } else {
                taxonomySlugSet.add(taxonomy.id);
            }

            const conceptSlugSet = new Set(taxonomy.concepts.map(c => c.id).filter(Boolean));
            taxonomy.concepts.forEach(concept => {
                if (!concept.id) {
                    const conceptSlug = this._generate_slug(concept.label);
                    const base = taxonomy.id || 'taxonomy';
                    const preferred = conceptSlug ? `${base}-${conceptSlug}` : '';
                    concept.id = this._ensure_unique_slug(conceptSlugSet, preferred, `${base}-concept`);
                } else {
                    conceptSlugSet.add(concept.id);
                }
            });
        });

        const updatedMetadata = {
            ...originalMetadata,
            title: getValue('metadata.title'),
            description: formData.get('metadata.description')?.toString() || '',
            version: getValue('metadata.version'),
            language: getValue('metadata.language'),
            monitoringType: {
                ...originalMetadata.monitoringType,
                type: getValue('metadata.monitoringType.type'),
                text: getValue('metadata.monitoringType.text')
            },
            dateCreated: getValue('metadata.dateCreated'),
            dateModified: getValue('metadata.dateModified'),
            license: getValue('metadata.license'),
            publisher: {
                ...originalMetadata.publisher,
                name: getValue('metadata.publisher.name'),
                contactPoint: getValue('metadata.publisher.contactPoint')
            },
            source: {
                ...originalMetadata.source,
                url: getValue('metadata.source.url'),
                title: getValue('metadata.source.title'),
                retrievedDate: getValue('metadata.source.retrievedDate'),
                format: getValue('metadata.source.format')
            },
            keywords,
            pageTypes: cleanedPageTypes,
            contentTypes: cleanedContentTypes,
            samples: {
                ...originalMetadata.samples,
                sampleCategories: cleanedSampleCategories,
                sampleTypes: cleanedSampleTypes
            },
            taxonomies: cleanedTaxonomies,
            // Update vocabularies structure
            vocabularies: {
                ...originalMetadata.vocabularies,
                pageTypes: cleanedPageTypes,
                contentTypes: cleanedContentTypes,
                taxonomies: cleanedTaxonomies,
                sampleTypes: {
                    sampleCategories: cleanedSampleCategories,
                    sampleTypes: cleanedSampleTypes
                }
            }
        };

        // Collect report template sections data
        const report_template_sections = {};
        const report_section_order = [];
        if (this._report_template_ref) {
            const section_cards = form.querySelectorAll('.report-section-card');
            section_cards.forEach(card => {
                const section_id = card.dataset.sectionId;
                if (!section_id) return;
                
                const name_input = card.querySelector(`input[data-field="name"][data-section-id="${section_id}"]`);
                const required_checkbox = card.querySelector(`input[data-field="required"][data-section-id="${section_id}"]`);
                const content_textarea = card.querySelector(`textarea[data-field="content"][data-section-id="${section_id}"]`);
                
                report_template_sections[section_id] = {
                    name: name_input?.value.trim() || '',
                    required: required_checkbox?.checked || false,
                    content: content_textarea?.value.trim() || ''
                };
                report_section_order.push(section_id);
            });
        }
        
        // Update metadata.blockOrders.reportSections
        if (report_section_order.length > 0) {
            if (!updatedMetadata.blockOrders) {
                updatedMetadata.blockOrders = {};
            }
            updatedMetadata.blockOrders.reportSections = report_section_order;
        }
        
        const state = this.getState();
        const currentRulefile = state?.ruleFileContent || {};
        const updatedRulefileContent = {
            ...currentRulefile,
            metadata: updatedMetadata
        };
        
        // Update reportTemplate if it exists or create it
        if (Object.keys(report_template_sections).length > 0 || currentRulefile.reportTemplate) {
            updatedRulefileContent.reportTemplate = {
                sections: report_template_sections
            };
        }

        this.dispatch({
            type: this.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: { ruleFileContent: updatedRulefileContent }
        });

        this.NotificationComponent.show_global_message?.(t('rulefile_metadata_edit_saved'), 'success');
        this.router('edit_rulefile_main');
    },

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        const state = this.getState();

        if (!state?.ruleFileContent?.metadata) {
            this.router('edit_rulefile_main');
            return;
        }

        this.root.innerHTML = '';
        const plate = this.Helpers.create_element('div', { class_name: ['content-plate', 'rulefile-metadata-edit-plate'] });

        const headingWrapper = this.Helpers.create_element('div', { class_name: 'metadata-edit-header' });
        headingWrapper.appendChild(this.Helpers.create_element('h1', { text_content: t('rulefile_metadata_edit_title') }));
        const introParagraph = this.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('rulefile_metadata_edit_intro')
        });
        headingWrapper.appendChild(introParagraph);
        plate.appendChild(headingWrapper);

        const { form } = this._create_form(state.ruleFileContent.metadata);

        const actionRow = this.Helpers.create_element('div', { class_name: 'metadata-edit-actions' });
        const saveTopButton = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'button' },
            html_content: `<span>${t('rulefile_metadata_save_metadata')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('save') : '')
        });
        saveTopButton.addEventListener('click', () => form.requestSubmit());

        const viewWithoutSaveButton = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: { type: 'button' },
            html_content: `<span>${t('rulefile_metadata_view_without_saving')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('visibility') : '')
        });
        viewWithoutSaveButton.addEventListener('click', () => this.router('edit_rulefile_main'));

        actionRow.append(saveTopButton, viewWithoutSaveButton);

        plate.appendChild(actionRow);
        plate.appendChild(form);

        this.root.appendChild(plate);
    },

    destroy() {
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
    }
};
