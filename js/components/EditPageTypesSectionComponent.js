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
        this.AutosaveService = deps.AutosaveService;
        this.form_element_ref = null;
        this.working_metadata = null;
        this.initial_metadata_snapshot = null;
        this.autosave_session = null;
        this.skip_autosave_on_destroy = false;
        this.move_after_render = null;
        this.handle_autosave_input = this.handle_autosave_input.bind(this);
        
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
        
        // Animera först, byt plats och rendera om efteråt (samma mönster som informationsblock)
        this._animate_then_render_page_type_move(workingMetadata, index, new_index, direction, clickedButton);
    },

    _delete_page_type_with_animation(workingMetadata, index, elementToDelete) {
        // Avbryt väntande autospar så att det inte skriver tillbaka den gamla datan efter radering
        this.autosave_session?.cancel_pending?.();

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
        elementToDelete.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
        
        // Vänta en frame för att säkerställa att transition är satt innan vi ändrar värden
        requestAnimationFrame(() => {
            elementToDelete.style.opacity = '0';
            elementToDelete.style.transform = 'scale(0.95)';
        });
        
        // Vänta tills fade-out är klar (300ms), sedan ta bort från DOM och flytta upp
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
                
                // Uppdatera endast working_metadata (som vid flytt) – sparas till state vid Spara eller flush
                this.working_metadata = workingMetadata;
                
                const old_form = this.form_element_ref;
                const new_form_data = this._create_form(workingMetadata);
                const new_form = new_form_data.form;
                
                if (old_form && old_form.parentNode) {
                    old_form.parentNode.replaceChild(new_form, old_form);
                }
                
                this.form_element_ref = new_form;
                this.working_metadata = workingMetadata;
                this.autosave_session?.set_form_element?.(new_form);
                
                setTimeout(() => {
                    const h1 = document.querySelector('.rulefile-sections-header h1');
                    if (h1) {
                        h1.setAttribute('tabindex', '-1');
                        h1.focus();
                    }
                }, 50);
            }, 400);
        }, 400);
    },

    _save_form_values_to_metadata(workingMetadata, shouldTrim = false) {
        if (!this.form_element_ref) return;

        const form = this.form_element_ref;
        const container = form.querySelector('.page-types-editor');
        if (!container) return;

        const vocabularies = workingMetadata.vocabularies || {};
        let existing_page_types = vocabularies.pageTypes || workingMetadata.pageTypes || [];
        const samples = workingMetadata.samples || {};
        let existing_sample_categories = samples.sampleCategories || [];
        if (!Array.isArray(existing_sample_categories) || existing_sample_categories.length === 0) {
            const vocab_samples = vocabularies.sampleTypes || {};
            if (Array.isArray(vocab_samples.sampleCategories)) {
                existing_sample_categories = vocab_samples.sampleCategories;
            }
        }
        if (!Array.isArray(existing_page_types)) existing_page_types = [];
        if (!Array.isArray(existing_sample_categories)) existing_sample_categories = [];
        const page_types = [];
        const sample_categories = [];

        const get_category_lines = (textarea) => {
            const rawValue = textarea?.value || '';
            const lines = shouldTrim && this.Helpers?.trim_textarea_preserve_lines
                ? this.Helpers.trim_textarea_preserve_lines(rawValue).split('\n')
                : rawValue.split('\n');
            return lines.map(line => (shouldTrim ? line.trim() : line)).filter(Boolean);
        };

        const items = Array.from(container.querySelectorAll('.page-type-editor-item'))
            .sort((a, b) => {
                const idxA = parseInt(a.getAttribute('data-index'), 10);
                const idxB = parseInt(b.getAttribute('data-index'), 10);
                return (isNaN(idxA) ? 999 : idxA) - (isNaN(idxB) ? 999 : idxB);
            });

        items.forEach((item) => {
            const input = item.querySelector('input[name^="pageTypes"]');
            const textarea = item.querySelector('textarea[name^="categories"]');
            const dataIndex = input?.getAttribute('data-index');
            const idx = parseInt(dataIndex, 10);
            if (isNaN(idx)) return;

            const rawValue = input?.value ?? '';
            const value = shouldTrim ? rawValue.trim() : rawValue;
            const category_lines = get_category_lines(textarea);
            const existing_cat = existing_sample_categories[idx];

            page_types.push(value);
            sample_categories.push({
                text: value,
                id: this._generate_slug(value.trim()) || (existing_cat?.id ?? ''),
                categories: category_lines.map(text => ({ text, id: this._generate_slug(text.trim()) }))
            });
        });

        while (sample_categories.length < page_types.length) {
            const pt = page_types[sample_categories.length];
            sample_categories.push({
                text: pt || '',
                id: this._generate_slug((pt || '').trim()),
                categories: []
            });
        }
        sample_categories.length = page_types.length;

        workingMetadata.pageTypes = page_types;
        if (vocabularies.pageTypes) {
            vocabularies.pageTypes = page_types;
        }
        if (!workingMetadata.samples) workingMetadata.samples = {};
        workingMetadata.samples.sampleCategories = sample_categories;
        if (vocabularies.sampleTypes) {
            vocabularies.sampleTypes.sampleCategories = sample_categories;
        }
    },

    _perform_save(shouldTrim, skip_render) {
        if (!this.form_element_ref) return;
        const state = this.getState();
        if (!this.working_metadata) {
            const base_metadata = state?.ruleFileContent?.metadata || {};
            this.working_metadata = this._ensure_metadata_defaults(this._clone_metadata(base_metadata));
        }
        this._save_form_values_to_metadata(this.working_metadata, shouldTrim);
        const currentRulefile = state?.ruleFileContent || {};
        const updatedMetadata = { ...this.working_metadata };
        if (!updatedMetadata.vocabularies) updatedMetadata.vocabularies = {};
        if (!updatedMetadata.samples) updatedMetadata.samples = {};
        if (updatedMetadata.pageTypes) updatedMetadata.vocabularies.pageTypes = updatedMetadata.pageTypes;
        if (updatedMetadata.samples.sampleCategories) {
            if (!updatedMetadata.vocabularies.sampleTypes) updatedMetadata.vocabularies.sampleTypes = {};
            updatedMetadata.vocabularies.sampleTypes.sampleCategories = updatedMetadata.samples.sampleCategories;
        }
        const updatedRulefileContent = {
            ...currentRulefile,
            metadata: { ...currentRulefile.metadata, ...updatedMetadata }
        };
        this.dispatch({
            type: this.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: { ruleFileContent: updatedRulefileContent, skip_render: skip_render === true }
        });

        if (skip_render && this.form_element_ref && this.working_metadata) {
            const container = this.form_element_ref.querySelector('.page-types-editor');
            if (container) {
                this._update_move_buttons(container, this.working_metadata);
            }
        }
    },

    handle_autosave_input() {
        this.autosave_session?.request_autosave();
    },

    _generate_slug(value) {
        if (!value) return '';
        return value.toString().trim().toLowerCase()
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-{2,}/g, '-')
            .replace(/^-+|-+$/g, '');
    },

    _update_move_buttons(page_types_container, workingMetadata) {
        const t = this.Translation.t;
        
        const vocabularies = workingMetadata.vocabularies || {};
        let page_types = vocabularies.pageTypes || workingMetadata.pageTypes || [];
        const totalCount = page_types.length;
        
        const items = Array.from(page_types_container.querySelectorAll('.page-type-editor-item'))
            .sort((a, b) => {
                const idxA = parseInt(a.getAttribute('data-index'), 10);
                const idxB = parseInt(b.getAttribute('data-index'), 10);
                return (isNaN(idxA) ? 999 : idxA) - (isNaN(idxB) ? 999 : idxB);
            });

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
            
            // Ner-knapp: visas om det finns fler än 1 block OCH det inte är sista blocket
            // (När add-form visas ligger den sist, så sista befintliga får ner-knapp)
            if (hasMultipleBlocks && !isLast) {
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

    handle_add_page_type_click() {
        if (!this.form_element_ref || !this.working_metadata) return;

        const workingMetadata = this.working_metadata;
        const vocabularies = workingMetadata.vocabularies || {};
        let page_types = vocabularies.pageTypes || workingMetadata.pageTypes || [];
        const samples = workingMetadata.samples || {};
        let sample_categories = samples.sampleCategories || [];

        if (!Array.isArray(page_types)) page_types = [];
        if (!Array.isArray(sample_categories)) sample_categories = [];

        if (!workingMetadata.vocabularies) workingMetadata.vocabularies = {};
        if (!workingMetadata.samples) workingMetadata.samples = {};
        if (!Array.isArray(workingMetadata.samples.sampleCategories)) workingMetadata.samples.sampleCategories = [];

        page_types.push('');
        sample_categories.push({ text: '', id: '', categories: [] });
        workingMetadata.vocabularies.pageTypes = page_types;
        workingMetadata.pageTypes = page_types;
        workingMetadata.samples.sampleCategories = sample_categories;

        this._recreate_form_and_focus(workingMetadata, page_types.length - 1);
    },

    _recreate_form_and_focus(workingMetadata, focusIndex) {
        const form = this.form_element_ref;
        if (!form?.parentNode) return;

        this.working_metadata = workingMetadata;
        const { form: new_form } = this._create_form(workingMetadata);
        form.parentNode.replaceChild(new_form, form);
        this.form_element_ref = new_form;
        this.autosave_session?.set_form_element?.(new_form);

        setTimeout(() => {
            const input = new_form.querySelector(`input[data-index="${focusIndex}"]`);
            if (input) {
                input.focus();
            }
        }, 50);
    },

    _animate_then_render_page_type_move(workingMetadata, index, new_index, direction, clickedButton) {
        const form = this.form_element_ref;
        if (!form) return;
        const container = form.querySelector('.page-types-editor');
        if (!container) return;

        const items = Array.from(container.querySelectorAll('.page-type-editor-item'))
            .sort((a, b) => {
                const idxA = parseInt(a.getAttribute('data-index'), 10);
                const idxB = parseInt(b.getAttribute('data-index'), 10);
                return (isNaN(idxA) ? 999 : idxA) - (isNaN(idxB) ? 999 : idxB);
            });
        const total = items.length;
        const moved_item = items[index];
        const other_item = items[new_index];
        if (!moved_item || !other_item || moved_item === other_item) {
            this._do_swap_and_render_page_type_move(workingMetadata, index, new_index, null, clickedButton);
            return;
        }

        const get_offset = (el) => el.getBoundingClientRect().top;
        const dist = get_offset(other_item) - get_offset(moved_item);
        const cubic = 'cubic-bezier(0.4, 0, 0.2, 1)';
        const DUR_MOVE = 0.25;
        const DUR_FADE = 0.25;

        let fade_out_btn = null;
        let fade_in_after = null;
        if (direction === 'up') {
            if (index === 1) {
                fade_out_btn = moved_item.querySelector('button[data-action="move-page-type-up"]');
                fade_in_after = { row: 'other', action: 'up' };
            } else if (index === total - 1) {
                fade_out_btn = other_item.querySelector('button[data-action="move-page-type-down"]');
                fade_in_after = { row: 'moved', action: 'down' };
            }
        } else {
            if (index === 0) {
                fade_out_btn = other_item.querySelector('button[data-action="move-page-type-up"]');
                fade_in_after = { row: 'moved', action: 'up' };
            } else if (index === total - 2) {
                fade_out_btn = moved_item.querySelector('button[data-action="move-page-type-down"]');
                fade_in_after = { row: 'other', action: 'down' };
            }
        }

        moved_item.style.position = 'relative';
        moved_item.style.zIndex = '10';
        moved_item.classList.add('moving');
        other_item.style.position = 'relative';
        other_item.style.zIndex = '9';
        other_item.classList.add('moving');

        requestAnimationFrame(() => {
            moved_item.style.transition = `transform ${DUR_MOVE}s ${cubic}`;
            moved_item.style.transform = `translateY(${dist}px)`;
            other_item.style.transition = `transform ${DUR_MOVE}s ${cubic}`;
            other_item.style.transform = `translateY(${-dist}px)`;

            const after_move = () => {
                if (fade_out_btn) {
                    fade_out_btn.style.transition = `opacity ${DUR_FADE}s ${cubic}`;
                    fade_out_btn.style.opacity = '0';
                    setTimeout(after_fade_out, DUR_FADE * 1000);
                } else {
                    after_fade_out();
                }
            };
            const after_fade_out = () => {
                moved_item.style.transition = '';
                moved_item.style.transform = '';
                moved_item.classList.remove('moving');
                other_item.style.transition = '';
                other_item.style.transform = '';
                other_item.classList.remove('moving');
                if (fade_out_btn) {
                    fade_out_btn.style.transition = '';
                    fade_out_btn.style.opacity = '';
                }
                this._do_swap_and_render_page_type_move(workingMetadata, index, new_index, fade_in_after, clickedButton);
            };
            setTimeout(after_move, DUR_MOVE * 1000);
        });
    },

    _do_swap_and_render_page_type_move(workingMetadata, index, new_index, fade_in_after, clickedButton) {
        const vocabularies = workingMetadata.vocabularies || {};
        const page_types = vocabularies.pageTypes || workingMetadata.pageTypes || [];
        const samples = workingMetadata.samples || {};
        const sample_categories = samples.sampleCategories || [];

        const temp_pt = page_types[index];
        page_types[index] = page_types[new_index];
        page_types[new_index] = temp_pt;
        if (index < sample_categories.length && new_index < sample_categories.length) {
            const temp_cat = sample_categories[index];
            sample_categories[index] = sample_categories[new_index];
            sample_categories[new_index] = temp_cat;
        }
        if (vocabularies.pageTypes) vocabularies.pageTypes = page_types;
        else workingMetadata.pageTypes = page_types;
        if (samples.sampleCategories) samples.sampleCategories = sample_categories;

        this.move_after_render = {
            focus_index: new_index,
            old_index: index,
            button_type: clickedButton?.getAttribute('data-action')?.includes('up') ? 'up' : 'down',
            fade_in_after
        };
        this._render_form_after_page_type_move(workingMetadata);
    },

    _render_form_after_page_type_move(workingMetadata) {
        this.working_metadata = workingMetadata;
        const form = this.form_element_ref;
        if (!form) return;
        const container = form.querySelector('.page-types-editor');
        const scroll_position = container ? container.scrollTop : 0;

        const new_form_data = this._create_form(workingMetadata);
        const new_form = new_form_data.form;
        const old_form = this.form_element_ref;
        if (old_form?.parentNode) {
            old_form.parentNode.replaceChild(new_form, old_form);
        }
        this.form_element_ref = new_form;
        this.autosave_session?.set_form_element?.(new_form);

        const new_container = new_form.querySelector('.page-types-editor');
        if (new_container) new_container.scrollTop = scroll_position;

        const move_data = this.move_after_render || {};
        const { focus_index, old_index, button_type, fade_in_after } = move_data;
        this.move_after_render = null;
        if (focus_index === undefined || !new_container) return;

        const items = Array.from(new_container.querySelectorAll('.page-type-editor-item')).filter(
            item => item.getAttribute('data-index') !== 'new'
        );
        const cubic = 'cubic-bezier(0.4, 0, 0.2, 1)';
        const DUR_FADE = 0.25;

        const do_focus = () => {
            const action = button_type === 'up' ? 'move-page-type-up' : 'move-page-type-down';
            let btn = new_container.querySelector(`button[data-action="${action}"][data-index="${focus_index}"]`);
            if (!btn) {
                const other_action = button_type === 'up' ? 'move-page-type-down' : 'move-page-type-up';
                btn = new_container.querySelector(`button[data-action="${other_action}"][data-index="${focus_index}"]`);
            }
            if (btn) btn.focus();
        };

        if (fade_in_after) {
            const target_item = fade_in_after.row === 'moved' ? items[focus_index] : items[old_index ?? focus_index];
            const fade_in_btn = target_item?.querySelector(`button[data-action="move-page-type-${fade_in_after.action}"]`);
            if (fade_in_btn) {
                fade_in_btn.style.opacity = '0';
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        fade_in_btn.style.transition = `opacity ${DUR_FADE}s ${cubic}`;
                        fade_in_btn.style.opacity = '1';
                        setTimeout(() => {
                            fade_in_btn.style.transition = '';
                            fade_in_btn.style.opacity = '';
                            do_focus();
                        }, DUR_FADE * 1000);
                    });
                });
            } else {
                do_focus();
            }
        } else {
            do_focus();
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

        const page_types_container = this.Helpers.create_element('div', { class_name: 'page-types-editor' });
        
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
            
            const total_count = page_types.length;
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
            if (hasMultipleBlocks && !isLast) {
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
                const do_delete = () => {
                    const current_metadata = this.working_metadata || this._ensure_metadata_defaults(this._clone_metadata(this.getState().ruleFileContent.metadata));
                    this._delete_page_type_with_animation(current_metadata, index, page_type_wrapper);
                };
                if (window.show_confirm_delete_modal) {
                    const h1_text = t('modal_h1_delete_page_type');
                    const message_text = t('modal_message_delete_page_type', { name: page_type_str || t('rulefile_metadata_untitled_item') });
                    const page_h1 = document.querySelector('.rulefile-sections-header h1');
                    if (page_h1) page_h1.setAttribute('tabindex', '-1');
                    window.show_confirm_delete_modal({
                        h1_text,
                        warning_text: message_text,
                        delete_button,
                        on_confirm: do_delete,
                        focusOnConfirm: page_h1 || undefined
                    });
                } else {
                    do_delete();
                }
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
            page_type_input.addEventListener('input', this.handle_autosave_input);
            
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
            categories_textarea.addEventListener('input', this.handle_autosave_input);
            
            // Fyll textarea med kategorier (varje kategori på en egen rad)
            if (matching_category && Array.isArray(matching_category.categories) && matching_category.categories.length > 0) {
                const category_texts = matching_category.categories.map(cat => cat.text || cat.id).filter(Boolean);
                categories_textarea.value = category_texts.join('\n');
            }
            
            this.Helpers.init_auto_resize_for_textarea?.(categories_textarea);
            categories_group.appendChild(categories_label);
            categories_group.appendChild(categories_textarea);
            page_type_wrapper.appendChild(categories_group);
            
            page_types_container.appendChild(page_type_wrapper);
        });
        
        form.appendChild(page_types_container);

        // Spara-knapp efter alla formulärfält
        const save_button_container = this.Helpers.create_element('div', { 
            class_name: 'form-actions'
        });
        
        const save_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: {
                type: 'button',
                'aria-label': t('rulefile_metadata_save_page_types')
            },
            html_content: `<span>${t('rulefile_metadata_save_page_types')}</span>` + 
                          (this.Helpers.get_icon_svg ? `<span aria-hidden="true">${this.Helpers.get_icon_svg('save', ['currentColor'], 16)}</span>` : '')
        });
        
        save_button.addEventListener('click', () => {
            this.autosave_session?.flush({ should_trim: true, skip_render: true });
            if (window.DraftManager?.commitCurrentDraft) {
                window.DraftManager.commitCurrentDraft();
            }
            
            // Visa bekräftelsemeddelande
            this.NotificationComponent.show_global_message?.(
                t('rulefile_metadata_edit_saved') || 'Ändringar sparade',
                'success'
            );
            
            // Navigera tillbaka till översikten över sidtyper
            sessionStorage.setItem('focusAfterLoad', '.rulefile-sections-header h1');
            this.router('rulefile_sections', { section: 'page_types' });
        });
        
        const cancel_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: {
                type: 'button',
                'aria-label': t('rulefile_page_types_back_without_saving')
            },
            html_content: `<span>${t('rulefile_page_types_back_without_saving')}</span>`
        });
        cancel_button.addEventListener('click', () => {
            this._restore_initial_state();
            this.skip_autosave_on_destroy = true;
            this.autosave_session?.cancel_pending();
            sessionStorage.setItem('focusAfterLoad', '.rulefile-sections-header h1');
            this.router('rulefile_sections', { section: 'page_types' });
        });
        
        save_button_container.appendChild(save_button);
        save_button_container.appendChild(cancel_button);
        form.appendChild(save_button_container);

        // Form submit handler (tom för nu)
        form.addEventListener('submit', event => {
            event.preventDefault();
            // Spara-funktionalitet hanteras via knappen
        });

        return { form, workingMetadata };
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
            payload: { ruleFileContent: restoredRulefileContent, skip_render: true }
        });
    },

    render() {
        if (!this.root) return;
        const state = this.getState();

        if (!state?.ruleFileContent?.metadata) {
            return;
        }

        // Förhindra re-rendering om formuläret redan finns och är aktivt (förhindrar att autospar tömmer formuläret)
        if (this.form_element_ref && this.root.contains(this.form_element_ref) && this.root.children.length > 0) {
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
            on_save: ({ should_trim, skip_render }) => {
                this._perform_save(should_trim, skip_render);
            }
        }) || null;

        this.root.appendChild(form);
    },

    destroy() {
        if (!this.skip_autosave_on_destroy && this.form_element_ref && this.working_metadata) {
            this.autosave_session?.flush({ should_trim: true, skip_render: true });
        }
        this.autosave_session?.destroy();
        this.autosave_session = null;
        this.move_after_render = null;

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
