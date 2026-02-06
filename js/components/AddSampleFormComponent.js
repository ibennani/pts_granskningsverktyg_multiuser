import { marked } from '../utils/markdown.js';
import "../../css/components/add_sample_form_component.css";

export const AddSampleFormComponent = {
    init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.on_sample_saved_callback = deps.on_sample_saved;
        this.discard_callback = deps.discard; // Not used in render? Check usages.
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;

        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.AuditLogic = deps.AuditLogic;

        this.form_element = null;
        this.category_fieldset_element = null;
        this.sample_type_select = null;
        this.description_input = null;
        this.url_input = null;
        this.url_form_group_ref = null;
        this.content_types_container_element = null;

        this.current_editing_sample_id = null;
        this.original_content_types_on_load = [];
        this.previous_sample_type_value = "";
        this.debounceTimerFormFields = null;

        // Bind methods
        this.handle_form_submit = this.handle_form_submit.bind(this);
        this.update_description_from_sample_type = this.update_description_from_sample_type.bind(this);
        this._handleCheckboxChange = this._handleCheckboxChange.bind(this);
    },

    get_sample_categories_from_state() {
        const state = this.getState ? this.getState() : null;
        const metadata = state?.ruleFileContent?.metadata || {};
        const samples = metadata.samples || {};

        let sample_categories = Array.isArray(samples.sampleCategories) ? samples.sampleCategories : [];

        // Fallback: nyare struktur kan ha sampleCategories i vocabularies
        if (sample_categories.length === 0) {
            const vocab_sample_types = metadata.vocabularies?.sampleTypes || {};
            if (Array.isArray(vocab_sample_types.sampleCategories)) {
                sample_categories = vocab_sample_types.sampleCategories;
            }
        }

        return sample_categories;
    },

    get_t_internally() {
        return this.Translation?.t || ((key) => `**${key}**`);
    },

    update_description_from_sample_type() {
        if (!this.sample_type_select || !this.description_input) return;

        const current_description = this.description_input.value.trim();
        const new_sample_type_text = this.sample_type_select.options[this.sample_type_select.selectedIndex]?.text;

        if (new_sample_type_text && (current_description === '' || current_description === this.previous_sample_type_value)) {
            this.description_input.value = new_sample_type_text;
        }
        this.previous_sample_type_value = new_sample_type_text;
    },

    on_category_change(selected_cat_id, preselected_sample_type_id = null) {
        const sample_categories = this.get_sample_categories_from_state();
        const selected_category = sample_categories.find(c => c.id === selected_cat_id);

        if (!selected_category) return;

        // Byt kategori: bygg om dropdownen från början
        if (this.sample_type_select) {
            this.sample_type_select.innerHTML = '';
        }

        const default_option = this.Helpers.create_element('option', {
            value: '',
            text_content: this.get_t_internally()('select_option')
        });
        this.sample_type_select.appendChild(default_option);
        (selected_category.categories || []).forEach(subcat => {
            this.sample_type_select.appendChild(this.Helpers.create_element('option', { value: subcat.id, text_content: subcat.text }));
        });
        this.sample_type_select.disabled = false;

        if (preselected_sample_type_id) {
            this.sample_type_select.value = preselected_sample_type_id;
        }

        if (this.url_form_group_ref) {
            this.url_form_group_ref.style.display = selected_category.hasUrl ? '' : 'none';
            if (!selected_category.hasUrl) this.url_input.value = '';
        }
    },

    _updateParentCheckboxState(parentCheckbox) {
        const parentId = parentCheckbox.dataset.parentId;
        const children = this.content_types_container_element.querySelectorAll(`input[data-child-for="${parentId}"]`);
        if (children.length === 0) return;
        const allChecked = Array.from(children).every(child => child.checked);
        const someChecked = Array.from(children).some(child => child.checked);
        parentCheckbox.checked = allChecked;
        parentCheckbox.indeterminate = someChecked && !allChecked;
        
        // Uppdatera ARIA-attribut för skärmläsare
        if (parentCheckbox.indeterminate) {
            parentCheckbox.setAttribute('aria-checked', 'mixed');
        } else {
            parentCheckbox.setAttribute('aria-checked', parentCheckbox.checked.toString());
        }
    },

    _handleCheckboxChange(event) {
        const target = event.target;
        if (target.type !== 'checkbox') return;
        if (target.dataset.parentId) {
            const parentId = target.dataset.parentId;
            const isChecked = target.checked;
            this.content_types_container_element.querySelectorAll(`input[data-child-for="${parentId}"]`).forEach(child => child.checked = isChecked);
        } else if (target.dataset.childFor) {
            const parentId = target.dataset.childFor;
            const parentCheckbox = this.content_types_container_element.querySelector(`input[data-parent-id="${parentId}"]`);
            if (parentCheckbox) this._updateParentCheckboxState(parentCheckbox);
        }
    },

    save_form_data_immediately(is_autosave = false) {
        if (!this.current_editing_sample_id) return;

        const selected_category_radio = this.form_element?.querySelector('input[name="sampleCategory"]:checked');
        const sample_category_id = selected_category_radio ? selected_category_radio.value : null;
        const sample_type_id = this.sample_type_select?.value;
        const sanitize_input = (input) => {
            if (typeof input !== 'string') return '';
            return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        };

        const description = sanitize_input(this.description_input?.value || '');
        let url_val = sanitize_input(this.url_input?.value || '');
        const selected_content_types = Array.from(this.content_types_container_element?.querySelectorAll('input[name="selectedContentTypes"]:checked') || []).map(cb => sanitize_input(cb.value));

        if (url_val) url_val = this.Helpers.add_protocol_if_missing(url_val);

        const sample_payload_data = {
            sampleCategory: sample_category_id,
            sampleType: sample_type_id,
            description: description,
            url: url_val,
            selectedContentTypes: selected_content_types
        };

        const original_set = new Set(this.original_content_types_on_load);
        const new_set = new Set(selected_content_types);
        const are_sets_equal = original_set.size === new_set.size && [...original_set].every(value => new_set.has(value));

        if (are_sets_equal) {
            this._perform_save(sample_payload_data, is_autosave);
        } else {
            this._stage_changes_and_navigate(sample_payload_data, is_autosave);
        }
    },

    _stage_changes_and_navigate(sample_payload_data, is_autosave = false) {
        const state = this.getState();
        const rule_file = state.ruleFileContent;
        const sample_being_edited = state.samples.find(s => s.id === this.current_editing_sample_id);

        const old_relevant_reqs = new Set(
            this.AuditLogic
                .get_relevant_requirements_for_sample(rule_file, { ...sample_being_edited, selectedContentTypes: this.original_content_types_on_load })
                .map(r => r.key || r.id)
                .filter(Boolean)
        );
        const new_relevant_reqs = new Set(
            this.AuditLogic
                .get_relevant_requirements_for_sample(rule_file, sample_payload_data)
                .map(r => r.key || r.id)
                .filter(Boolean)
        );

        const added_req_ids = [...new_relevant_reqs].filter(id => !old_relevant_reqs.has(id));
        const removed_req_ids = [...old_relevant_reqs].filter(id => !new_relevant_reqs.has(id));

        const data_will_be_lost = removed_req_ids.some(id => sample_being_edited.requirementResults[id]);

        this.dispatch({
            type: this.StoreActionTypes.STAGE_SAMPLE_CHANGES,
            payload: {
                sampleId: this.current_editing_sample_id,
                updatedSampleData: sample_payload_data,
                analysis: { added_reqs: added_req_ids, removed_reqs: removed_req_ids, data_will_be_lost }
            }
        });

        if (!is_autosave) {
            this.router('confirm_sample_edit');
        }
    },

    _perform_save(sample_payload_data, is_autosave = false) {
        const t = this.get_t_internally();
        if (this.current_editing_sample_id) {
            this.dispatch({ type: this.StoreActionTypes.UPDATE_SAMPLE, payload: { sampleId: this.current_editing_sample_id, updatedSampleData: sample_payload_data } });

            // Update the baseline for content types so future changes are compared against this saved state
            if (sample_payload_data.selectedContentTypes) {
                this.original_content_types_on_load = [...sample_payload_data.selectedContentTypes];
            }

            if (!is_autosave) {
                if (window.DraftManager?.commitCurrentDraft) {
                    window.DraftManager.commitCurrentDraft();
                }
                this.NotificationComponent.show_global_message(t('sample_updated_successfully'), "success");
            }
        } else {
            const new_sample_object = { ...sample_payload_data, id: this.Helpers.generate_uuid_v4(), requirementResults: {} };
            this.dispatch({ type: this.StoreActionTypes.ADD_SAMPLE, payload: new_sample_object });
            if (!is_autosave && window.DraftManager?.commitCurrentDraft) {
                window.DraftManager.commitCurrentDraft();
            }
            this.NotificationComponent.show_global_message(t('sample_added_successfully'), "success");
        }

        if (!is_autosave && this.on_sample_saved_callback) {
            this.on_sample_saved_callback();
        }
    },

    handle_form_submit(event) {
        event.preventDefault();
        const t = this.get_t_internally();
        this.NotificationComponent.clear_global_message();

        const selected_category_radio = this.form_element.querySelector('input[name="sampleCategory"]:checked');
        const sample_category_id = selected_category_radio ? selected_category_radio.value : null;
        const sample_type_id = this.sample_type_select.value;

        const sanitize_input = (input) => {
            if (typeof input !== 'string') return '';
            return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        };

        const description = sanitize_input(this.description_input.value);
        let url_val = sanitize_input(this.url_input.value);
        const selected_content_types = Array.from(this.content_types_container_element.querySelectorAll('input[name="selectedContentTypes"]:checked')).map(cb => sanitize_input(cb.value));

        if (!sample_category_id) { this.NotificationComponent.show_global_message(t('field_is_required', { fieldName: t('sample_category_title') }), 'error'); return; }
        if (!sample_type_id) { this.NotificationComponent.show_global_message(t('field_is_required', { fieldName: t('sample_type_label') }), 'error'); this.sample_type_select.focus(); return; }
        if (!description) { this.NotificationComponent.show_global_message(t('field_is_required', { fieldName: t('description') }), 'error'); this.description_input.focus(); return; }
        if (selected_content_types.length === 0) { this.NotificationComponent.show_global_message(t('error_min_one_content_type'), 'error'); return; }
        if (url_val) url_val = this.Helpers.add_protocol_if_missing(url_val);

        const sample_payload_data = {
            sampleCategory: sample_category_id,
            sampleType: sample_type_id,
            description: description,
            url: url_val,
            selectedContentTypes: selected_content_types
        };

        if (!this.current_editing_sample_id) {
            this._perform_save(sample_payload_data);
            return;
        }

        const original_set = new Set(this.original_content_types_on_load);
        const new_set = new Set(selected_content_types);
        const are_sets_equal = original_set.size === new_set.size && [...original_set].every(value => new_set.has(value));

        if (are_sets_equal) {
            this._perform_save(sample_payload_data);
        } else {
            this._stage_changes_and_navigate(sample_payload_data);
        }
    },

    render(sample_id_to_edit = null) {
        // Prevent re-rendering (and resetting form state) if we are already editing this sample and the form is mounted.
        if (this.current_editing_sample_id === sample_id_to_edit && this.form_element && this.root && this.root.contains(this.form_element)) {
            return;
        }

        const t = this.get_t_internally();
        this.current_editing_sample_id = sample_id_to_edit;
        const current_state = this.getState();
        const sample_data = this.current_editing_sample_id ? current_state.samples.find(s => s.id === this.current_editing_sample_id) : null;
        const sample_categories = this.get_sample_categories_from_state();
        const grouped_content_types = current_state.ruleFileContent.metadata?.vocabularies?.contentTypes || current_state.ruleFileContent.metadata?.contentTypes || [];

        this.original_content_types_on_load = sample_data ? [...sample_data.selectedContentTypes] : [];

        this.root.innerHTML = '';
        this.form_element = this.Helpers.create_element('form', { class_name: 'add-sample-form' });
        this.form_element.addEventListener('submit', this.handle_form_submit);

        // --- Category Section ---
        this.form_element.appendChild(this.Helpers.create_element('h2', { text_content: t('sample_category_title') }));
        this.category_fieldset_element = this.Helpers.create_element('fieldset', { class_name: 'content-type-parent-group' });
        this.category_fieldset_element.appendChild(this.Helpers.create_element('legend', { text_content: t('sample_category_title'), class_name: 'visually-hidden' }));
        sample_categories.forEach((cat, index) => {
            const radio_id = `sample-cat-${cat.id}`;
            const radio_wrapper = this.Helpers.create_element('div', { class_name: ['form-check', 'content-type-child-item'] });
            const radio = this.Helpers.create_element('input', { id: radio_id, class_name: 'form-check-input', attributes: { type: 'radio', name: 'sampleCategory', value: cat.id, required: true } });
            if ((sample_data && sample_data.sampleCategory === cat.id) || (!sample_data && index === 0)) radio.checked = true;
            radio.addEventListener('change', () => {
                this.on_category_change(cat.id);
            });
            radio_wrapper.append(radio, this.Helpers.create_element('label', { attributes: { for: radio_id }, text_content: cat.text }));
            this.category_fieldset_element.appendChild(radio_wrapper);
        });
        this.form_element.appendChild(this.category_fieldset_element);

        // --- Sample Info Section ---
        this.form_element.appendChild(this.Helpers.create_element('h2', { text_content: t('sample_info_title') }));
        this.sample_type_select = this.Helpers.create_element('select', { id: 'sampleTypeSelect', class_name: 'form-control', attributes: { required: true, disabled: true } });
        this.sample_type_select.addEventListener('change', this.update_description_from_sample_type);
        this.description_input = this.Helpers.create_element('input', { id: 'sampleDescriptionInput', class_name: 'form-control', attributes: { type: 'text', required: true } });
        this.url_input = this.Helpers.create_element('input', { id: 'sampleUrlInput', class_name: 'form-control', attributes: { type: 'url' } });
        this.url_form_group_ref = this.Helpers.create_element('div', { class_name: 'form-group', children: [this.Helpers.create_element('label', { attributes: { for: 'sampleUrlInput' }, text_content: t('url') }), this.url_input] });
        this.form_element.append(
            this.Helpers.create_element('div', { class_name: 'form-group', children: [this.Helpers.create_element('label', { attributes: { for: 'sampleTypeSelect' }, text_content: t('sample_type_label') + '*' }), this.sample_type_select] }),
            this.Helpers.create_element('div', { class_name: 'form-group', children: [this.Helpers.create_element('label', { attributes: { for: 'sampleDescriptionInput' }, text_content: t('description') + '*' }), this.description_input] }),
            this.url_form_group_ref
        );
        this.description_input.value = sample_data?.description || "";
        this.url_input.value = sample_data?.url || "";

        // --- Content Types Section ---
        this.content_types_container_element = this.Helpers.create_element('div', { class_name: 'content-types-group' });
        this.content_types_container_element.appendChild(this.Helpers.create_element('h2', { text_content: t('content_types') }));
        this.content_types_container_element.appendChild(this.Helpers.create_element('p', { text_content: t('content_types_instruction'), style: { 'margin-top': '0', 'color': 'var(--text-color-muted)' } }));
        grouped_content_types.forEach(group => {
            const fieldset = this.Helpers.create_element('fieldset', { class_name: 'content-type-parent-group' });
            const group_children_id = `ct-children-${group.id}`;
            
            // Legend för skärmläsare (visuellt dold)
            const legend = this.Helpers.create_element('legend', { class_name: 'visually-hidden', text_content: group.text });
            fieldset.appendChild(legend);
            
            // Visuell wrapper för parent checkbox
            const parent_header = this.Helpers.create_element('div', { class_name: 'content-type-parent-header' });
            const parent_id = `ct-parent-${group.id}`;
            const parent_checkbox = this.Helpers.create_element('input', { 
                id: parent_id, 
                class_name: 'form-check-input', 
                attributes: { 
                    type: 'checkbox', 
                    'data-parent-id': group.id,
                    'aria-controls': group_children_id,
                    'aria-label': `${group.text}, välj alla`
                } 
            });
            const parent_h3 = this.Helpers.create_element('h3');
            const parent_label = this.Helpers.create_element('label', { attributes: { for: parent_id }, text_content: group.text, class_name: 'content-type-parent-label' });
            parent_h3.appendChild(parent_label);
            parent_header.append(parent_checkbox, parent_h3);
            fieldset.appendChild(parent_header);
            
            // Container för children med ID för ARIA
            const children_container = this.Helpers.create_element('div', { class_name: 'content-type-children-container', attributes: { id: group_children_id } });
            
            (group.types || []).forEach(child => {
                const child_id = `ct-child-${child.id}`;
                const child_wrapper = this.Helpers.create_element('div', { class_name: 'form-check content-type-child-item' });
                const desc_id = child.description ? `ct-desc-${child.id}` : null;
                const child_checkbox = this.Helpers.create_element('input', { 
                    id: child_id, 
                    class_name: 'form-check-input', 
                    attributes: { 
                        type: 'checkbox', 
                        name: 'selectedContentTypes', 
                        value: child.id, 
                        'data-child-for': group.id,
                        'aria-describedby': desc_id ? desc_id : null,
                        'aria-labelledby': `${child_id}-label`
                    } 
                });
                const child_label = this.Helpers.create_element('label', { 
                    attributes: { for: child_id, id: `${child_id}-label` }, 
                    text_content: child.text 
                });
                child_wrapper.append(child_checkbox, child_label);
                children_container.appendChild(child_wrapper);
                
                if (child.description) {
                    const desc_div = this.Helpers.create_element('div', { 
                        class_name: 'content-type-description markdown-content',
                        attributes: { id: desc_id }
                    });
                    if (typeof marked !== 'undefined') desc_div.innerHTML = marked.parse(child.description);
                    else desc_div.textContent = child.description;
                    children_container.appendChild(desc_div);
                }
            });
            fieldset.appendChild(children_container);
            this.content_types_container_element.appendChild(fieldset);
        });
        this.content_types_container_element.addEventListener('change', this._handleCheckboxChange);
        const all_child_checkboxes = this.content_types_container_element.querySelectorAll('input[data-child-for]');
        all_child_checkboxes.forEach(cb => { cb.checked = sample_data?.selectedContentTypes?.includes(cb.value) || false; });
        this.content_types_container_element.querySelectorAll('input[data-parent-id]').forEach(pc => this._updateParentCheckboxState(pc));
        this.form_element.appendChild(this.content_types_container_element);

        // --- Actions ---
        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions' });
        const save_button = this.Helpers.create_element('button', { class_name: ['button', 'button-primary'], attributes: { type: 'submit' } });
        const button_text = this.current_editing_sample_id ? t('save_changes_button') : t('save_sample_button');
        const button_span = this.Helpers.create_element('span', { text_content: button_text });
        save_button.appendChild(button_span);
        if (this.Helpers.get_icon_svg) {
            const icon_svg = this.Helpers.get_icon_svg(this.current_editing_sample_id ? 'save' : 'add');
            if (icon_svg) {
                save_button.insertAdjacentHTML('beforeend', icon_svg);
            }
        }
        actions_div.appendChild(save_button);
        this.form_element.appendChild(actions_div);

        this.root.appendChild(this.form_element);

        // --- Post-render initialization ---
        const selected_cat_id = sample_data?.sampleCategory || sample_categories[0]?.id;
        if (selected_cat_id) {
            this.on_category_change(selected_cat_id, sample_data?.sampleType);
        }
        this.previous_sample_type_value = sample_data?.sampleType ? this.sample_type_select.options[this.sample_type_select.selectedIndex]?.text : '';
    },

    destroy() {
        clearTimeout(this.debounceTimerFormFields);
        if (this.form_element) {
            this.form_element.removeEventListener('submit', this.handle_form_submit);
        }
        if (this.sample_type_select) {
            this.sample_type_select.removeEventListener('change', this.update_description_from_sample_type);
        }
        if (this.content_types_container_element) this.content_types_container_element.removeEventListener('change', this._handleCheckboxChange);

        this.root = null;
        this.deps = null;
        this.form_element = null;
    }
};
