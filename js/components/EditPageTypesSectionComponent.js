// js/components/EditPageTypesSectionComponent.js

export const EditPageTypesSectionComponent = {
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
        this.showing_add_form = false;
        this.debounceTimer = null;
        
        // Binda autospar-metoder
        this.debounced_autosave_form = this.debounced_autosave_form.bind(this);
        this.save_form_data_immediately = this.save_form_data_immediately.bind(this);
        
        if (this.Helpers?.load_css) {
            await this.Helpers.load_css(this.CSS_PATH).catch(err => console.warn('[EditPageTypesSectionComponent] Failed to load CSS', err));
        }
    },

    _clone_metadata(metadata) {
        return JSON.parse(JSON.stringify(metadata || {}));
    },

    _ensure_metadata_defaults(workingMetadata) {
        // Se till att samples och sampleCategories finns
        if (!workingMetadata.samples) {
            workingMetadata.samples = {};
        }
        if (!Array.isArray(workingMetadata.samples.sampleCategories)) {
            workingMetadata.samples.sampleCategories = [];
        }
        
        // Se till att pageTypes finns
        if (!Array.isArray(workingMetadata.pageTypes)) {
            workingMetadata.pageTypes = [];
        }
        
        return workingMetadata;
    },

    _move_page_type(workingMetadata, index, direction, clickedButton) {
        // direction: 'up' eller 'down'
        
        // Spara nuvarande värden från formuläret innan vi flyttar
        this._save_form_values_to_metadata(workingMetadata);
        
        const vocabularies = workingMetadata.vocabularies || {};
        let page_types = vocabularies.pageTypes || workingMetadata.pageTypes || [];
        const samples = workingMetadata.samples || {};
        let sample_categories = samples.sampleCategories || [];
        
        // Om sampleCategories är tom, försök hämta från vocabularies
        if (!Array.isArray(sample_categories) || sample_categories.length === 0) {
            const vocab_samples = vocabularies.sampleTypes || {};
            if (Array.isArray(vocab_samples.sampleCategories)) {
                sample_categories = vocab_samples.sampleCategories;
            }
        }
        
        // Om pageTypes är tom, använd sampleCategories som källa
        if (!Array.isArray(page_types) || page_types.length === 0) {
            if (Array.isArray(sample_categories) && sample_categories.length > 0) {
                page_types = sample_categories.map(cat => cat.text || cat.id).filter(Boolean);
            }
        }
        
        const new_index = direction === 'up' ? index - 1 : index + 1;
        
        if (new_index < 0 || new_index >= page_types.length) {
            return; // Kan inte flytta utanför arrayen
        }
        
        // Byt plats på elementen
        const temp = page_types[index];
        page_types[index] = page_types[new_index];
        page_types[new_index] = temp;
        
        // Byt också plats på motsvarande sampleCategories om de finns
        if (index < sample_categories.length && new_index < sample_categories.length) {
            const temp_cat = sample_categories[index];
            sample_categories[index] = sample_categories[new_index];
            sample_categories[new_index] = temp_cat;
        }
        
        // Uppdatera workingMetadata
        if (vocabularies.pageTypes) {
            vocabularies.pageTypes = page_types;
        } else {
            workingMetadata.pageTypes = page_types;
        }
        
        if (samples.sampleCategories) {
            samples.sampleCategories = sample_categories;
        }
        
        // Spara ändringar omedelbart
        this.save_form_data_immediately();
        
        // Rendera om formuläret med animation
        this._render_form_with_animation(workingMetadata, new_index, index, clickedButton);
    },

    _delete_page_type_with_animation(workingMetadata, index, elementToDelete) {
        // Spara nuvarande värden från formuläret innan vi tar bort
        this._save_form_values_to_metadata(workingMetadata);
        
        const vocabularies = workingMetadata.vocabularies || {};
        let page_types = vocabularies.pageTypes || workingMetadata.pageTypes || [];
        const samples = workingMetadata.samples || {};
        let sample_categories = samples.sampleCategories || [];
        
        // Om sampleCategories är tom, försök hämta från vocabularies
        if (!Array.isArray(sample_categories) || sample_categories.length === 0) {
            const vocab_samples = vocabularies.sampleTypes || {};
            if (Array.isArray(vocab_samples.sampleCategories)) {
                sample_categories = vocab_samples.sampleCategories;
            }
        }
        
        // Om pageTypes är tom, använd sampleCategories som källa
        if (!Array.isArray(page_types) || page_types.length === 0) {
            if (Array.isArray(sample_categories) && sample_categories.length > 0) {
                page_types = sample_categories.map(cat => cat.text || cat.id).filter(Boolean);
            }
        }
        
        if (index < 0 || index >= page_types.length) {
            return; // Ogiltigt index
        }
        
        // Spara höjden på elementet som ska tas bort
        const elementHeight = elementToDelete.offsetHeight;
        const gap = 32; // Gap från page-types-editor (2rem = 32px)
        const totalHeight = elementHeight + gap;
        
        // Hitta containern och alla items
        const form = this.form_element_ref;
        const container = form ? form.querySelector('.page-types-editor') : null;
        if (!container) return;
        
        const allItems = container.querySelectorAll('.page-type-editor-item');
        
        // Fade:a ut elementet som ska tas bort
        // Sätt transition explicit (överrid den globala transitionen)
        elementToDelete.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
        
        // Vänta en frame för att säkerställa att transition är satt innan vi ändrar värden
        requestAnimationFrame(() => {
            // Nu sätt fade-out värden
            elementToDelete.style.opacity = '0';
            elementToDelete.style.transform = 'scale(0.95)';
        });
        
        // Vänta tills fade-out är klar (300ms) + 0.1 sekunder extra, sedan ta bort från DOM och flytta upp
        setTimeout(() => {
            // Ta bort elementet från DOM:en direkt
            if (elementToDelete.parentNode) {
                elementToDelete.parentNode.removeChild(elementToDelete);
            }
            
            // Hitta alla element efter det som tas bort (nu när det är borttaget från DOM)
            const remainingItems = container.querySelectorAll('.page-type-editor-item');
            const itemsAfter = [];
            for (let i = index; i < remainingItems.length; i++) {
                itemsAfter.push(remainingItems[i]);
            }
            
            // Animera de underliggande elementen uppåt
            itemsAfter.forEach((item) => {
                item.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                item.style.transform = `translateY(-${totalHeight}px)`;
            });
            
            // Efter animation, ta bort elementet från metadata och rendera om
            setTimeout(() => {
                // Ta bort från arrays
                page_types.splice(index, 1);
                if (index < sample_categories.length) {
                    sample_categories.splice(index, 1);
                }
                
                // Uppdatera workingMetadata
                if (vocabularies.pageTypes) {
                    vocabularies.pageTypes = page_types;
                } else {
                    workingMetadata.pageTypes = page_types;
                }
                
                if (samples.sampleCategories) {
                    samples.sampleCategories = sample_categories;
                }
                
                // Spara ändringar omedelbart
                this.save_form_data_immediately();
                
                // Återställ showing_add_form när formuläret renderas om
                this.showing_add_form = false;
                
                // Rendera om formuläret
                const old_form = this.form_element_ref;
                const new_form_data = this._create_form(workingMetadata);
                const new_form = new_form_data.form;
                
                // Ersätt formuläret
                if (old_form && old_form.parentNode) {
                    old_form.parentNode.replaceChild(new_form, old_form);
                }
                
                this.form_element_ref = new_form;
                this.working_metadata = workingMetadata;
            }, 400);
        }, 400); // Vänta 300ms (fade-out) + 100ms = 400ms totalt
    },

    _save_form_values_to_metadata(workingMetadata) {
        if (!this.form_element_ref) return;
        
        const form = this.form_element_ref;
        const page_type_inputs = form.querySelectorAll('input[name^="pageTypes"]');
        const category_textareas = form.querySelectorAll('textarea[name^="categories"]');
        
        // Spara pageTypes-värden
        const vocabularies = workingMetadata.vocabularies || {};
        let page_types = vocabularies.pageTypes || workingMetadata.pageTypes || [];
        
        page_type_inputs.forEach((input, index) => {
            const dataIndex = input.getAttribute('data-index');
            if (dataIndex === 'new') {
                // Hantera ny sidtyp - lägg till om den har värde
                const value = input.value.trim();
                if (value) {
                    // Om det inte redan finns i arrayen, lägg till
                    if (!page_types.includes(value)) {
                        page_types.push(value);
                    }
                }
            } else {
                const idx = parseInt(dataIndex, 10);
                if (!isNaN(idx) && idx < page_types.length) {
                    page_types[idx] = input.value.trim();
                }
            }
        });
        
        if (vocabularies.pageTypes) {
            vocabularies.pageTypes = page_types;
        } else {
            workingMetadata.pageTypes = page_types;
        }
        
        // Spara categories-värden
        const samples = workingMetadata.samples || {};
        let sample_categories = samples.sampleCategories || [];
        
        category_textareas.forEach((textarea, index) => {
            const dataIndex = textarea.getAttribute('data-index');
            if (dataIndex === 'new') {
                // Hantera nya kategorier
                const category_lines = textarea.value.split('\n').map(line => line.trim()).filter(Boolean);
                if (category_lines.length > 0) {
                    // Hitta motsvarande page_type för den nya kategorin
                    const newPageTypeInput = form.querySelector('input[data-index="new"]');
                    if (newPageTypeInput && newPageTypeInput.value.trim()) {
                        const pageTypeText = newPageTypeInput.value.trim();
                        // Skapa ny sampleCategory
                        const newCategory = {
                            text: pageTypeText,
                            id: this._generate_slug(pageTypeText),
                            categories: category_lines.map(text => ({ text, id: this._generate_slug(text) }))
                        };
                        sample_categories.push(newCategory);
                    }
                }
            } else {
                const idx = parseInt(dataIndex, 10);
                if (!isNaN(idx) && idx < sample_categories.length && sample_categories[idx]) {
                    const category_lines = textarea.value.split('\n').map(line => line.trim()).filter(Boolean);
                    if (sample_categories[idx].categories) {
                        sample_categories[idx].categories = category_lines.map(text => ({ text, id: this._generate_slug(text) }));
                    }
                }
            }
        });
        
        if (samples.sampleCategories) {
            samples.sampleCategories = sample_categories;
        }
    },

    save_form_data_immediately() {
        if (!this.form_element_ref || !this.working_metadata) return;
        
        // Spara aktuellt fokus och scroll-position innan autospar
        const activeElement = document.activeElement;
        const focusInfo = activeElement && this.form_element_ref.contains(activeElement) ? {
            elementId: activeElement.id || null,
            elementName: activeElement.name || null,
            dataIndex: activeElement.getAttribute('data-index') || null,
            selectionStart: activeElement.selectionStart !== undefined ? activeElement.selectionStart : null,
            selectionEnd: activeElement.selectionEnd !== undefined ? activeElement.selectionEnd : null,
            scrollTop: activeElement.scrollTop !== undefined ? activeElement.scrollTop : null,
            scrollLeft: activeElement.scrollLeft !== undefined ? activeElement.scrollLeft : null
        } : null;
        
        const windowScrollY = window.scrollY;
        const windowScrollX = window.scrollX;
        
        // Spara formulärvärden till workingMetadata
        this._save_form_values_to_metadata(this.working_metadata);
        
        const state = this.getState();
        const currentRulefile = state?.ruleFileContent || {};
        
        // Uppdatera metadata-strukturen korrekt
        const updatedMetadata = { ...this.working_metadata };
        
        // Se till att vocabularies och samples är korrekt strukturerade
        if (!updatedMetadata.vocabularies) {
            updatedMetadata.vocabularies = {};
        }
        if (!updatedMetadata.samples) {
            updatedMetadata.samples = {};
        }
        
        // Synka pageTypes till vocabularies
        if (updatedMetadata.pageTypes) {
            updatedMetadata.vocabularies.pageTypes = updatedMetadata.pageTypes;
        }
        
        // Synka sampleCategories till samples
        if (updatedMetadata.samples.sampleCategories) {
            if (!updatedMetadata.vocabularies.sampleTypes) {
                updatedMetadata.vocabularies.sampleTypes = {};
            }
            updatedMetadata.vocabularies.sampleTypes.sampleCategories = updatedMetadata.samples.sampleCategories;
        }
        
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
                    
                    // Försök hitta elementet via id först, sedan name, sedan data-index
                    if (focusInfo.elementId) {
                        elementToFocus = this.form_element_ref.querySelector(`#${CSS.escape(focusInfo.elementId)}`);
                    }
                    if (!elementToFocus && focusInfo.elementName) {
                        elementToFocus = this.form_element_ref.querySelector(`[name="${CSS.escape(focusInfo.elementName)}"]`);
                    }
                    if (!elementToFocus && focusInfo.dataIndex !== null) {
                        // För page types kan vi behöva matcha på data-index
                        const elements = this.form_element_ref.querySelectorAll(`[data-index="${CSS.escape(focusInfo.dataIndex)}"]`);
                        // Ta det första elementet som matchar (kan vara input eller textarea)
                        if (elements.length > 0) {
                            elementToFocus = elements[0];
                        }
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

    debounced_autosave_form() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.save_form_data_immediately();
        }, 3000);
    },

    _generate_slug(value) {
        if (!value) return '';
        return value.toString().trim().toLowerCase()
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-{2,}/g, '-')
            .replace(/^-+|-+$/g, '');
    },

    _toggle_add_form(page_types_section, page_types_container, workingMetadata) {
        const existing_add_form = page_types_section.querySelector('.page-type-add-form');
        
        if (this.showing_add_form && existing_add_form) {
            // Dölj formuläret med animation
            const content_height = existing_add_form.scrollHeight;
            const gap = 12; // Gap från form-section (0.75rem = 12px)
            page_types_container.style.transition = 'transform 0.3s ease-out';
            existing_add_form.style.transition = 'height 0.3s ease-out';
            existing_add_form.style.height = content_height + 'px';
            
            requestAnimationFrame(() => {
                existing_add_form.style.height = '0';
                page_types_container.style.transform = 'translateY(0)';
                
                setTimeout(() => {
                    existing_add_form.remove();
                    page_types_container.style.transition = '';
                    this.showing_add_form = false;
                    // Uppdatera knappar när formuläret döljs
                    this._update_move_buttons(page_types_container, workingMetadata);
                }, 300);
            });
        } else if (!this.showing_add_form) {
            // Visa formuläret med animation
            this.showing_add_form = true;
            this._add_new_page_type_form(page_types_section, page_types_container, workingMetadata);
            // Knapparna uppdateras automatiskt när animationen är klar i _add_new_page_type_form
        }
    },

    _update_move_buttons(page_types_container, workingMetadata, includeNewForm = false) {
        const t = this.Translation.t;
        
        // Hämta pageTypes för att få namn och räkna antal
        const vocabularies = workingMetadata.vocabularies || {};
        let page_types = vocabularies.pageTypes || workingMetadata.pageTypes || [];
        const totalCount = page_types.length + (includeNewForm ? 1 : 0);
        
        // Logik för knappar:
        // 1 block: inga knappar
        // 2 block: första har ner, andra har upp
        // 3+ block: första har ner, mitten har båda, sista har upp
        
        // Hitta alla items (exkludera det nya formuläret om det finns)
        const allItems = page_types_container.querySelectorAll('.page-type-editor-item');
        const items = Array.from(allItems).filter(item => item.getAttribute('data-index') !== 'new');
        
        items.forEach((item) => {
            const dataIndex = item.getAttribute('data-index');
            const itemIndex = parseInt(dataIndex, 10);
            if (isNaN(itemIndex)) return;
            
            const page_type_str = page_types[itemIndex] ? String(page_types[itemIndex]) : '';
            const move_button_group = item.querySelector('.page-type-move-button-group');
            if (!move_button_group) return;
            
            // Rensa befintliga knappar
            move_button_group.innerHTML = '';
            
            const isFirst = itemIndex === 0;
            const isLast = itemIndex === page_types.length - 1;
            const hasMultipleBlocks = totalCount > 1;
            
            // Upp-knapp: visas om det finns fler än 1 block OCH det inte är första blocket
            if (hasMultipleBlocks && !isFirst) {
                const new_position = itemIndex;
                const up_button = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'button-small'],
                    attributes: {
                        type: 'button',
                        'data-action': 'move-page-type-up',
                        'data-index': itemIndex,
                        'aria-label': t('rulefile_metadata_move_page_type_up_aria_with_position', { 
                            pageType: page_type_str, 
                            newPosition: new_position, 
                            totalCount: totalCount 
                        }) || `Flytta upp sidtyp: ${page_type_str} (${new_position} av ${totalCount})`
                    },
                    html_content: `<span>${t('rulefile_metadata_move_up_text') || 'Flytta upp'}</span>` + 
                                  (this.Helpers.get_icon_svg ? `<span aria-hidden="true">${this.Helpers.get_icon_svg('arrow_upward', ['currentColor'], 16)}</span>` : '')
                });
                up_button.addEventListener('click', (e) => {
                    e.preventDefault();
                    const current_metadata = this.working_metadata || this._ensure_metadata_defaults(this._clone_metadata(this.getState().ruleFileContent.metadata));
                    this._move_page_type(current_metadata, itemIndex, 'up', e.currentTarget);
                });
                move_button_group.appendChild(up_button);
            }
            
            // Ner-knapp: visas om det finns fler än 1 block OCH det inte är sista blocket (eller om det är sista men vi har ett nytt formulär)
            if (hasMultipleBlocks && (!isLast || includeNewForm)) {
                const new_position = itemIndex + 2;
                const down_button = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'button-small'],
                    attributes: {
                        type: 'button',
                        'data-action': 'move-page-type-down',
                        'data-index': itemIndex,
                        'aria-label': t('rulefile_metadata_move_page_type_down_aria_with_position', { 
                            pageType: page_type_str, 
                            newPosition: new_position, 
                            totalCount: totalCount 
                        }) || `Flytta ner sidtyp: ${page_type_str} (${new_position} av ${totalCount})`
                    },
                    html_content: `<span>${t('rulefile_metadata_move_down_text') || 'Flytta ner'}</span>` + 
                                  (this.Helpers.get_icon_svg ? `<span aria-hidden="true">${this.Helpers.get_icon_svg('arrow_downward', ['currentColor'], 16)}</span>` : '')
                });
                down_button.addEventListener('click', (e) => {
                    e.preventDefault();
                    const current_metadata = this.working_metadata || this._ensure_metadata_defaults(this._clone_metadata(this.getState().ruleFileContent.metadata));
                    this._move_page_type(current_metadata, itemIndex, 'down', e.currentTarget);
                });
                move_button_group.appendChild(down_button);
            }
        });
    },

    _add_new_page_type_form(page_types_section, page_types_container, workingMetadata) {
        const t = this.Translation.t;
        
        // Skapa wrapper för formuläret
        const add_form_wrapper = this.Helpers.create_element('div', {
            class_name: 'page-type-add-form',
            attributes: { 'data-is-new': 'true' }
        });
        
        // Sätt initial höjd till 0 för animation
        add_form_wrapper.style.height = '0';
        add_form_wrapper.style.overflow = 'hidden';
        add_form_wrapper.style.transition = 'height 0.3s ease-out';
        
        // Skapa innehållet
        const page_type_wrapper = this.Helpers.create_element('div', { 
            class_name: 'page-type-editor-item',
            attributes: { 'data-index': 'new' }
        });
        
        // Input för huvudkategori med knappar
        const page_type_group = this.Helpers.create_element('div', { class_name: 'form-group' });
        
        // Label och alla knappar på samma rad
        const label_row = this.Helpers.create_element('div', { 
            class_name: 'page-type-label-row',
            style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;'
        });
        
        const page_type_label = this.Helpers.create_element('label', { 
            attributes: { for: 'page_type_new' },
            text_content: t('rulefile_metadata_field_page_type_name') || 'Huvudkategori (sidtyp)'
        });
        
        // Vänster sida: label och flytta-knappar (tom för nu eftersom det är första elementet)
        const left_group = this.Helpers.create_element('div', {
            class_name: 'page-type-left-group',
            style: 'display: flex; align-items: center; gap: 0.75rem;'
        });
        
        left_group.appendChild(page_type_label);
        
        // Knappgrupp för upp/ner (tom för nya formuläret)
        const move_button_group = this.Helpers.create_element('div', { 
            class_name: 'page-type-move-button-group',
            style: 'display: flex; gap: 0.5rem; align-items: center;'
        });
        
        left_group.appendChild(move_button_group);
        
        // Ta bort-knapp längst till höger
        const delete_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-danger', 'button-small'],
            attributes: {
                type: 'button',
                'data-action': 'delete-new-page-type',
                'aria-label': t('rulefile_metadata_delete_new_page_type_aria')
            },
            html_content: `<span>${t('rulefile_metadata_delete_button_text')}</span>` + 
                          (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('delete', ['currentColor'], 16) : '')
        });
        delete_button.addEventListener('click', () => {
            this._toggle_add_form(page_types_section, page_types_container, workingMetadata);
        });
        
        label_row.appendChild(left_group);
        label_row.appendChild(delete_button);
        
        const page_type_input = this.Helpers.create_element('input', {
            class_name: 'form-control',
            attributes: { 
                id: 'page_type_new',
                name: 'pageTypes[new]',
                type: 'text',
                'data-index': 'new'
            }
        });
        
        // Lägg till autospar-event listeners
        // Autospar sker endast vid inaktivitet (debounced), inte vid blur
        page_type_input.addEventListener('input', this.debounced_autosave_form);
        
        page_type_group.appendChild(label_row);
        page_type_group.appendChild(page_type_input);
        page_type_wrapper.appendChild(page_type_group);
        
        // Textarea för kategorier (3 rader)
        const categories_group = this.Helpers.create_element('div', { class_name: 'form-group' });
        const categories_label = this.Helpers.create_element('label', {
            attributes: { for: 'categories_new' },
            text_content: t('rulefile_metadata_field_page_type_categories') || 'Underkategorier för denna sidtyp (en per rad)'
        });
        const categories_textarea = this.Helpers.create_element('textarea', {
            class_name: 'form-control',
            attributes: {
                id: 'categories_new',
                name: 'categories[new]',
                rows: '3',
                'data-index': 'new'
            }
        });
        
        // Lägg till autospar-event listeners
        // Autospar sker endast vid inaktivitet (debounced), inte vid blur
        categories_textarea.addEventListener('input', this.debounced_autosave_form);
        
        this.Helpers.init_auto_resize_for_textarea?.(categories_textarea);
        categories_group.appendChild(categories_label);
        categories_group.appendChild(categories_textarea);
        page_type_wrapper.appendChild(categories_group);
        
        add_form_wrapper.appendChild(page_type_wrapper);
        
        // Lägg till direkt efter h2_wrapper, före page_types_container
        const h2_wrapper = page_types_section.querySelector('.page-types-section-header');
        if (h2_wrapper && h2_wrapper.nextSibling) {
            page_types_section.insertBefore(add_form_wrapper, h2_wrapper.nextSibling);
        } else {
            page_types_section.insertBefore(add_form_wrapper, page_types_container);
        }
        
        // Använd animation för att visa formuläret och trycka ner innehållet
        // Vänta lite för att DOM ska uppdateras innan vi beräknar höjden
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const content_height = page_type_wrapper.scrollHeight;
                const gap = 12; // Gap från form-section (0.75rem = 12px)
                
                // Sätt transition på containern
                page_types_container.style.transition = 'transform 0.3s ease-out';
                
                // Starta animationen för add-form
                add_form_wrapper.style.height = content_height + 'px';
                
                // Animera ner containern samtidigt (höjd + gap)
                page_types_container.style.transform = `translateY(${content_height + gap}px)`;
                
                // När animationen är klar, ta bort height-begränsningen och återställ transform
                setTimeout(() => {
                    add_form_wrapper.style.height = 'auto';
                    add_form_wrapper.style.overflow = 'visible';
                    page_types_container.style.transform = 'translateY(0)';
                    page_types_container.style.transition = '';
                    
                    // Uppdatera knappar omedelbart när formuläret är synligt
                    this._update_move_buttons(page_types_container, workingMetadata, true);
                }, 300);
            });
        });
        
        // Fokusera på input-fältet
        requestAnimationFrame(() => {
            page_type_input.focus();
        });
    },

    _render_form_with_animation(workingMetadata, focus_index, old_index, clickedButton) {
        // Spara workingMetadata
        this.working_metadata = workingMetadata;
        
        const form = this.form_element_ref;
        if (!form) return;
        
        const container = form.querySelector('.page-types-editor');
        if (!container) return;
        
        // Spara positionen för scroll
        const scroll_position = container.scrollTop;
        
        // Spara positioner och höjder för elementen innan de flyttas
        const old_items = container.querySelectorAll('.page-type-editor-item');
        const item_positions = [];
        const item_heights = [];
        
        old_items.forEach((item, idx) => {
            const rect = item.getBoundingClientRect();
            const container_rect = container.getBoundingClientRect();
            item_positions.push({
                top: rect.top - container_rect.top + container.scrollTop,
                height: rect.height
            });
            item_heights.push(rect.height);
        });
        
        // Återställ showing_add_form när formuläret renderas om
        this.showing_add_form = false;
        
        // Rendera om formuläret
        const old_form = this.form_element_ref;
        const new_form_data = this._create_form(workingMetadata);
        const new_form = new_form_data.form;
        
        // Ersätt formuläret
        if (old_form && old_form.parentNode) {
            old_form.parentNode.replaceChild(new_form, old_form);
        }
        
        this.form_element_ref = new_form;
        this.working_metadata = workingMetadata;
        
        // Hitta det element som ska animeras
        const new_container = new_form.querySelector('.page-types-editor');
        if (new_container && old_index !== undefined && focus_index !== undefined) {
            // Återställ scroll-position
            new_container.scrollTop = scroll_position;
            
            // Vänta lite för att DOM ska uppdateras
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const new_items = new_container.querySelectorAll('.page-type-editor-item');
                    const old_item = old_items[old_index];
                    const new_item = new_items[focus_index];
                    const other_item = new_items[old_index];
                    
                    if (old_item && new_item && other_item && item_positions[old_index] && item_positions[focus_index]) {
                        // Beräkna avståndet som elementen ska flytta baserat på gamla positionerna
                        const old_top = item_positions[old_index].top;
                        const new_top = item_positions[focus_index].top;
                        const distance = new_top - old_top;
                        
                        // Beräkna höjderna för att få korrekt avstånd
                        const old_height = item_positions[old_index].height;
                        const new_height = item_positions[focus_index].height;
                        
                        // Sätt initial positioner för animationen - elementen ska börja på sina gamla positioner
                        new_item.style.position = 'relative';
                        new_item.style.zIndex = '10';
                        new_item.classList.add('moving');
                        new_item.style.transition = 'none'; // Ingen transition initialt
                        new_item.style.transform = `translateY(${-distance}px)`;
                        new_item.style.opacity = '0.9';
                        
                        if (other_item && other_item !== new_item) {
                            other_item.style.position = 'relative';
                            other_item.style.zIndex = '9';
                            other_item.classList.add('moving');
                            other_item.style.transition = 'none'; // Ingen transition initialt
                            other_item.style.transform = `translateY(${distance}px)`;
                            other_item.style.opacity = '0.9';
                        }
                        
                        // Vänta lite extra för att säkerställa att DOM är redo och initial position är satt
                        setTimeout(() => {
                            // Sätt transition och starta animationen
                            new_item.style.transition = 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.8s ease';
                            new_item.style.transform = 'translateY(0)';
                            new_item.style.opacity = '1';
                            
                            if (other_item && other_item !== new_item) {
                                other_item.style.transition = 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.8s ease';
                                other_item.style.transform = 'translateY(0)';
                                other_item.style.opacity = '1';
                            }
                            
                            // Scrolla till elementet
                            new_item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            
                            // Återställ fokus till knappen efter animationen
                            setTimeout(() => {
                                if (clickedButton) {
                                    // Hitta motsvarande knapp i det nya formuläret
                                    const buttonAction = clickedButton.getAttribute('data-action');
                                    
                                    if (buttonAction) {
                                        // Hitta knappen baserat på action och det nya indexet
                                        const newButton = new_container.querySelector(
                                            `button[data-action="${buttonAction}"][data-index="${focus_index}"]`
                                        );
                                        if (newButton) {
                                            newButton.focus();
                                        }
                                    }
                                }
                                
                                // Ta bort animation-egenskaperna efter animationen
                                new_item.classList.remove('moving');
                                new_item.style.position = '';
                                new_item.style.zIndex = '';
                                new_item.style.transition = '';
                                new_item.style.transform = '';
                                new_item.style.opacity = '';
                                if (other_item && other_item !== new_item) {
                                    other_item.classList.remove('moving');
                                    other_item.style.position = '';
                                    other_item.style.zIndex = '';
                                    other_item.style.transition = '';
                                    other_item.style.transform = '';
                                    other_item.style.opacity = '';
                                }
                            }, 800);
                        }, 100);
                    }
                });
            });
        }
    },

    _create_form(metadata) {
        const workingMetadata = this._ensure_metadata_defaults(this._clone_metadata(metadata));
        const form = this.Helpers.create_element('form', { class_name: 'rulefile-metadata-edit-form' });

        const t = this.Translation.t;
        
        // Hämta pageTypes och sampleCategories
        const vocabularies = metadata.vocabularies || {};
        let page_types = vocabularies.pageTypes || metadata.pageTypes || [];
        const samples = metadata.samples || {};
        let sample_categories = samples.sampleCategories || [];
        
        // Om sampleCategories är tom, försök hämta från vocabularies
        if (!Array.isArray(sample_categories) || sample_categories.length === 0) {
            const vocab_samples = vocabularies.sampleTypes || {};
            if (Array.isArray(vocab_samples.sampleCategories)) {
                sample_categories = vocab_samples.sampleCategories;
            }
        }
        
        // Om pageTypes är tom, använd sampleCategories som källa
        if (!Array.isArray(page_types) || page_types.length === 0) {
            if (Array.isArray(sample_categories) && sample_categories.length > 0) {
                page_types = sample_categories.map(cat => cat.text || cat.id).filter(Boolean);
            }
        }

        // Page Types section
        const page_types_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        
        // Skapa page_types_container först så den är tillgänglig i event listenern
        const page_types_container = this.Helpers.create_element('div', { class_name: 'page-types-editor' });
        
        // H2 med knapp direkt till höger
        const h2_wrapper = this.Helpers.create_element('div', { 
            class_name: 'page-types-section-header',
            style: 'display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.25rem;'
        });
        const h2 = this.Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_page_types') || 'Sidtyper' });
        h2.style.margin = '0';
        h2_wrapper.appendChild(h2);
        
        const add_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary', 'button-small'],
            attributes: {
                type: 'button',
                'data-action': 'add-page-type'
            },
            html_content: `<span>${t('rulefile_metadata_add_page_type')}</span>` + 
                          (this.Helpers.get_icon_svg ? `<span aria-hidden="true">${this.Helpers.get_icon_svg('add', ['currentColor'], 16)}</span>` : '')
        });
        add_button.addEventListener('click', () => {
            this._toggle_add_form(page_types_section, page_types_container, workingMetadata);
        });
        h2_wrapper.appendChild(add_button);
        page_types_section.appendChild(h2_wrapper);
        
        // Lägg till formulär för ny sidtyp om det ska visas
        if (this.showing_add_form) {
            this._add_new_page_type_form(page_types_section, page_types_container, workingMetadata);
        }
        
        // Skapa input-fält för varje huvudkategori
        page_types.forEach((page_type, index) => {
            const page_type_wrapper = this.Helpers.create_element('div', { 
                class_name: 'page-type-editor-item',
                attributes: { 'data-index': index }
            });
            
            // Konvertera page_type till sträng först
            const page_type_str = String(page_type);
            
            // Input för huvudkategori med delete-knapp
            const page_type_group = this.Helpers.create_element('div', { class_name: 'form-group' });
            
            // Label och alla knappar på samma rad
            const label_row = this.Helpers.create_element('div', { 
                class_name: 'page-type-label-row',
                style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;'
            });
            
            const page_type_label = this.Helpers.create_element('label', { 
                attributes: { for: `page_type_${index}` },
                text_content: t('rulefile_metadata_field_page_type_name') || 'Huvudkategori (sidtyp)'
            });
            
            // Vänster sida: label och flytta-knappar
            const left_group = this.Helpers.create_element('div', {
                class_name: 'page-type-left-group',
                style: 'display: flex; align-items: center; gap: 0.75rem;'
            });
            
            left_group.appendChild(page_type_label);
            
            // Knappgrupp för upp/ner direkt efter label
            const move_button_group = this.Helpers.create_element('div', { 
                class_name: 'page-type-move-button-group',
                style: 'display: flex; gap: 0.5rem; align-items: center;'
            });
            
            // Logik för knappar:
            // 1 block: inga knappar
            // 2 block: första har ner, andra har upp
            // 3+ block: första har ner, mitten har båda, sista har upp
            
            const total_count = page_types.length + (this.showing_add_form ? 1 : 0);
            const isFirst = index === 0;
            const isLast = index === page_types.length - 1;
            const hasMultipleBlocks = total_count > 1;
            
            // Upp-knapp: visas om det finns fler än 1 block OCH det inte är första blocket
            // För 2 block: visas bara på andra blocket
            // För 3+ block: visas på alla utom första
            if (hasMultipleBlocks && !isFirst) {
                const new_position = index; // När man flyttar upp från index blir det index-1, vilket är position index (1-indexerad)
                const up_button = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'button-small'],
                    attributes: {
                        type: 'button',
                        'data-action': 'move-page-type-up',
                        'data-index': index,
                        'aria-label': t('rulefile_metadata_move_page_type_up_aria_with_position', { 
                            pageType: page_type_str, 
                            newPosition: new_position, 
                            totalCount: total_count 
                        }) || `Flytta upp sidtyp: ${page_type_str} (${new_position} av ${total_count})`
                    },
                    html_content: `<span>${t('rulefile_metadata_move_up_text') || 'Flytta upp'}</span>` + 
                                  (this.Helpers.get_icon_svg ? `<span aria-hidden="true">${this.Helpers.get_icon_svg('arrow_upward', ['currentColor'], 16)}</span>` : '')
                });
                up_button.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Använd senaste workingMetadata eller skapa ny från state
                    const current_metadata = this.working_metadata || this._ensure_metadata_defaults(this._clone_metadata(this.getState().ruleFileContent.metadata));
                    this._move_page_type(current_metadata, index, 'up', e.currentTarget);
                });
                move_button_group.appendChild(up_button);
            }
            
            // Ner-knapp: visas om det finns fler än 1 block OCH det inte är sista blocket (eller om det är sista men vi har ett nytt formulär)
            // För 2 block: visas bara på första blocket
            // För 3+ block: visas på alla utom sista
            if (hasMultipleBlocks && (!isLast || this.showing_add_form)) {
                const new_position = index + 2; // När man flyttar ner från index blir det index+1, vilket är position index+2 (1-indexerad)
                const down_button = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'button-small'],
                    attributes: {
                        type: 'button',
                        'data-action': 'move-page-type-down',
                        'data-index': index,
                        'aria-label': t('rulefile_metadata_move_page_type_down_aria_with_position', { 
                            pageType: page_type_str, 
                            newPosition: new_position, 
                            totalCount: total_count 
                        }) || `Flytta ner sidtyp: ${page_type_str} (${new_position} av ${total_count})`
                    },
                    html_content: `<span>${t('rulefile_metadata_move_down_text') || 'Flytta ner'}</span>` + 
                                  (this.Helpers.get_icon_svg ? `<span aria-hidden="true">${this.Helpers.get_icon_svg('arrow_downward', ['currentColor'], 16)}</span>` : '')
                });
                down_button.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Använd senaste workingMetadata eller skapa ny från state
                    const current_metadata = this.working_metadata || this._ensure_metadata_defaults(this._clone_metadata(this.getState().ruleFileContent.metadata));
                    this._move_page_type(current_metadata, index, 'down', e.currentTarget);
                });
                move_button_group.appendChild(down_button);
            }
            
            left_group.appendChild(move_button_group);
            
            // Ta bort-knapp längst till höger
            const delete_button = this.Helpers.create_element('button', {
                class_name: ['button', 'button-danger', 'button-small'],
                attributes: {
                    type: 'button',
                    'data-action': 'delete-page-type',
                    'data-index': index,
                    'aria-label': t('rulefile_metadata_delete_page_type_aria', { pageType: page_type_str })
                },
                html_content: `<span>${t('rulefile_metadata_delete_button_text')}</span>` +
                              (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('delete', ['currentColor'], 16) : '')
            });
            delete_button.addEventListener('click', (e) => {
                e.preventDefault();
                const current_metadata = this.working_metadata || this._ensure_metadata_defaults(this._clone_metadata(this.getState().ruleFileContent.metadata));
                this._delete_page_type_with_animation(current_metadata, index, page_type_wrapper);
            });
            
            label_row.appendChild(left_group);
            label_row.appendChild(delete_button);
            
            const page_type_input = this.Helpers.create_element('input', {
                class_name: 'form-control',
                attributes: { 
                    id: `page_type_${index}`,
                    name: `pageTypes[${index}]`,
                    type: 'text',
                    'data-index': index
                }
            });
            page_type_input.value = page_type_str;
            
            // Lägg till autospar-event listeners
            // Autospar sker endast vid inaktivitet (debounced), inte vid blur
            page_type_input.addEventListener('input', this.debounced_autosave_form);
            
            page_type_group.appendChild(label_row);
            page_type_group.appendChild(page_type_input);
            page_type_wrapper.appendChild(page_type_group);
            
            // Hitta motsvarande sampleCategory
            const page_type_normalized = page_type_str.toLowerCase().trim();
            
            let matching_category = sample_categories.find(cat => {
                const cat_text = (cat.text || '').toLowerCase().trim();
                const cat_id = (cat.id || '').toLowerCase().trim();
                return cat_text === page_type_normalized || cat_id === page_type_normalized;
            });
            
            // Fallback: matcha på index
            if (!matching_category && index < sample_categories.length) {
                matching_category = sample_categories[index];
            }
            
            // Textarea för kategorier (varje kategori på en egen rad)
            const categories_group = this.Helpers.create_element('div', { class_name: 'form-group' });
            const categories_label = this.Helpers.create_element('label', {
                attributes: { for: `categories_${index}` },
                text_content: t('rulefile_metadata_field_page_type_categories') || 'Underkategorier för denna sidtyp (en per rad)'
            });
            const categories_textarea = this.Helpers.create_element('textarea', {
                class_name: 'form-control',
                attributes: {
                    id: `categories_${index}`,
                    name: `categories[${index}]`,
                    rows: '6',
                    'data-index': index
                }
            });
            
            // Fyll textarea med kategorier (varje kategori på en egen rad)
            if (matching_category && Array.isArray(matching_category.categories) && matching_category.categories.length > 0) {
                const category_texts = matching_category.categories.map(cat => cat.text || cat.id).filter(Boolean);
                categories_textarea.value = category_texts.join('\n');
            }
            
            // Lägg till autospar-event listeners
            // Autospar sker endast vid inaktivitet (debounced), inte vid blur
            categories_textarea.addEventListener('input', this.debounced_autosave_form);
            
            this.Helpers.init_auto_resize_for_textarea?.(categories_textarea);
            categories_group.appendChild(categories_label);
            categories_group.appendChild(categories_textarea);
            page_type_wrapper.appendChild(categories_group);
            
            page_types_container.appendChild(page_type_wrapper);
        });
        
        page_types_section.appendChild(page_types_container);
        form.appendChild(page_types_section);

        // Knapparna skapas redan korrekt i loopen ovan med rätt logik
        // Ingen behov av att uppdatera dem här eftersom logiken redan tar hänsyn till showing_add_form

        // Form submit handler (tom för nu)
        form.addEventListener('submit', event => {
            event.preventDefault();
            // Spara-funktionalitet kommer senare
        });

        return { form, workingMetadata };
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
        // Rensa debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        
        // Ta bort event listeners från formulärfält
        if (this.form_element_ref) {
            const inputs = this.form_element_ref.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                input.removeEventListener('input', this.debounced_autosave_form);
            });
        }
        
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.form_element_ref = null;
        this.working_metadata = null;
        this.deps = null;
    }
};
