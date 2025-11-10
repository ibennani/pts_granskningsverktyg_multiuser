// js/components/AddSampleFormComponent.js

import { marked } from '../utils/markdown.js';

export const AddSampleFormComponent = (function () {
    'use-strict';

    const CSS_PATH = 'css/components/add_sample_form_component.css';
    let form_container_ref;
    let on_sample_saved_callback;
    
    let local_getState;
    let local_dispatch;
    let local_StoreActionTypes;

    let Translation_t;
    let Helpers;
    let NotificationComponent;
    let AuditLogic;

    let form_element;
    let category_fieldset_element;
    let sample_type_select, description_input, url_input, url_form_group_ref;
    let content_types_container_element;
    
    let current_editing_sample_id = null;
    let original_content_types_on_load = [];
    let router_ref_internal;
    let previous_sample_type_value = "";
    let debounceTimerFormFields = null;

    function get_t_internally() {
        return Translation_t || ((key) => `**${key}**`);
    }

    async function init(_form_container, _on_sample_saved_cb, _discard_cb, _getState, _dispatch, _StoreActionTypes, _router_ref) {
        form_container_ref = _form_container;
        on_sample_saved_callback = _on_sample_saved_cb;
        local_getState = _getState;
        local_dispatch = _dispatch;
        local_StoreActionTypes = _StoreActionTypes;
        router_ref_internal = _router_ref;
        
        Translation_t = window.Translation?.t;
        Helpers = window.Helpers;
        NotificationComponent = window.NotificationComponent;
        AuditLogic = window.AuditLogic;

        await Helpers.load_css(CSS_PATH);
    }
    
    function update_description_from_sample_type() {
        if (!sample_type_select || !description_input) return;
        
        const current_description = description_input.value.trim();
        const new_sample_type_text = sample_type_select.options[sample_type_select.selectedIndex]?.text;

        if (new_sample_type_text && (current_description === '' || current_description === previous_sample_type_value)) {
            description_input.value = new_sample_type_text;
        }
        previous_sample_type_value = new_sample_type_text;
    }

    function on_category_change(selected_cat_id, preselected_sample_type_id = null) {
        const sample_categories = local_getState().ruleFileContent.metadata.samples.sampleCategories;
        const selected_category = sample_categories.find(c => c.id === selected_cat_id);

        if (!selected_category) return;

        const default_option = Helpers.create_element('option', { 
            value: '', 
            text_content: get_t_internally()('select_option') 
        });
        sample_type_select.appendChild(default_option);
        (selected_category.categories || []).forEach(subcat => {
            sample_type_select.appendChild(Helpers.create_element('option', { value: subcat.id, text_content: subcat.text }));
        });
        sample_type_select.disabled = false;
        
        if (preselected_sample_type_id) {
            sample_type_select.value = preselected_sample_type_id;
        }

        if (url_form_group_ref) {
            url_form_group_ref.style.display = selected_category.hasUrl ? '' : 'none';
            if (!selected_category.hasUrl) url_input.value = '';
        }
    }

    function _updateParentCheckboxState(parentCheckbox) {
        const parentId = parentCheckbox.dataset.parentId;
        const children = content_types_container_element.querySelectorAll(`input[data-child-for="${parentId}"]`);
        if (children.length === 0) return;
        const allChecked = Array.from(children).every(child => child.checked);
        const someChecked = Array.from(children).some(child => child.checked);
        parentCheckbox.checked = allChecked;
        parentCheckbox.indeterminate = someChecked && !allChecked;
    }

    function _handleCheckboxChange(event) {
        const target = event.target;
        if (target.type !== 'checkbox') return;
        if (target.dataset.parentId) {
            const parentId = target.dataset.parentId;
            const isChecked = target.checked;
            content_types_container_element.querySelectorAll(`input[data-child-for="${parentId}"]`).forEach(child => child.checked = isChecked);
        } else if (target.dataset.childFor) {
            const parentId = target.dataset.childFor;
            const parentCheckbox = content_types_container_element.querySelector(`input[data-parent-id="${parentId}"]`);
            if (parentCheckbox) _updateParentCheckboxState(parentCheckbox);
        }
        // Trigger autosave för checkboxes
        if (current_editing_sample_id) {
            debounced_autosave_form();
        }
    }

    function save_form_data_immediately() {
        if (!current_editing_sample_id) return; // Bara spara om vi redigerar ett befintligt sample
        
        const selected_category_radio = form_element?.querySelector('input[name="sampleCategory"]:checked');
        const sample_category_id = selected_category_radio ? selected_category_radio.value : null;
        const sample_type_id = sample_type_select?.value;
        const sanitize_input = (input) => {
            if (typeof input !== 'string') return '';
            return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        };

        const description = sanitize_input(description_input?.value || '');
        let url_val = sanitize_input(url_input?.value || '');
        const selected_content_types = Array.from(content_types_container_element?.querySelectorAll('input[name="selectedContentTypes"]:checked') || []).map(cb => sanitize_input(cb.value));

        if (url_val) url_val = Helpers.add_protocol_if_missing(url_val);

        const sample_payload_data = {
            sampleCategory: sample_category_id,
            sampleType: sample_type_id,
            description: description,
            url: url_val,
            selectedContentTypes: selected_content_types
        };

        // Använd samma logik som vid submit, men utan validering
        const original_set = new Set(original_content_types_on_load);
        const new_set = new Set(selected_content_types);
        const are_sets_equal = original_set.size === new_set.size && [...original_set].every(value => new_set.has(value));

        if (are_sets_equal) {
            _perform_save(sample_payload_data);
        } else {
            _stage_changes_and_navigate(sample_payload_data);
        }
    }

    function debounced_autosave_form() {
        if (!current_editing_sample_id) return; // Bara spara om vi redigerar ett befintligt sample
        
        clearTimeout(debounceTimerFormFields);
        debounceTimerFormFields = setTimeout(() => {
            save_form_data_immediately();
        }, 3000);
    }

    function handle_button_click(event) {
        // Spara formulärdata när en knapp klickas (utom submit-knappar som redan hanterar sparning)
        const button = event.target.closest('button');
        if (button && button.type !== 'submit' && current_editing_sample_id) {
            save_form_data_immediately();
        }
    }
    
    function _stage_changes_and_navigate(sample_payload_data) {
        const state = local_getState();
        const rule_file = state.ruleFileContent;
        const sample_being_edited = state.samples.find(s => s.id === current_editing_sample_id);

        const old_relevant_reqs = new Set(AuditLogic.get_relevant_requirements_for_sample(rule_file, { ...sample_being_edited, selectedContentTypes: original_content_types_on_load }).map(r => r.id));
        const new_relevant_reqs = new Set(AuditLogic.get_relevant_requirements_for_sample(rule_file, sample_payload_data).map(r => r.id));

        const added_req_ids = [...new_relevant_reqs].filter(id => !old_relevant_reqs.has(id));
        const removed_req_ids = [...old_relevant_reqs].filter(id => !new_relevant_reqs.has(id));

        const data_will_be_lost = removed_req_ids.some(id => sample_being_edited.requirementResults[id]);

        local_dispatch({
            type: local_StoreActionTypes.STAGE_SAMPLE_CHANGES,
            payload: {
                sampleId: current_editing_sample_id,
                updatedSampleData: sample_payload_data,
                analysis: { added_reqs: added_req_ids, removed_reqs: removed_req_ids, data_will_be_lost }
            }
        });

        router_ref_internal('confirm_sample_edit');
    }

    function _perform_save(sample_payload_data) {
        const t = get_t_internally();
        if (current_editing_sample_id) {
            local_dispatch({ type: local_StoreActionTypes.UPDATE_SAMPLE, payload: { sampleId: current_editing_sample_id, updatedSampleData: sample_payload_data } });
            NotificationComponent.show_global_message(t('sample_updated_successfully'), "success");
        } else {
            const new_sample_object = { ...sample_payload_data, id: Helpers.generate_uuid_v4(), requirementResults: {} };
            local_dispatch({ type: local_StoreActionTypes.ADD_SAMPLE, payload: new_sample_object });
            NotificationComponent.show_global_message(t('sample_added_successfully'), "success");
        }
        on_sample_saved_callback();
    }

    function handle_form_submit(event) {
        event.preventDefault();
        const t = get_t_internally();
        NotificationComponent.clear_global_message();
        
        const selected_category_radio = form_element.querySelector('input[name="sampleCategory"]:checked');
        const sample_category_id = selected_category_radio ? selected_category_radio.value : null;
        const sample_type_id = sample_type_select.value;
        const sample_type_text = sample_type_select.options[sample_type_select.selectedIndex]?.text;
        // Sanitize inputs to prevent XSS
        const sanitize_input = (input) => {
            if (typeof input !== 'string') return '';
            return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        };

        const description = sanitize_input(description_input.value);
        let url_val = sanitize_input(url_input.value);
        const selected_content_types = Array.from(content_types_container_element.querySelectorAll('input[name="selectedContentTypes"]:checked')).map(cb => sanitize_input(cb.value));

        if (!sample_category_id) { NotificationComponent.show_global_message(t('field_is_required', {fieldName: t('sample_category_title')}), 'error'); return; }
        if (!sample_type_id) { NotificationComponent.show_global_message(t('field_is_required', {fieldName: t('sample_type_label')}), 'error'); sample_type_select.focus(); return; }
        if (!description) { NotificationComponent.show_global_message(t('field_is_required', {fieldName: t('description')}), 'error'); description_input.focus(); return; }
        if (selected_content_types.length === 0) { NotificationComponent.show_global_message(t('error_min_one_content_type'), 'error'); return; }
        if (url_val) url_val = Helpers.add_protocol_if_missing(url_val);

        const sample_payload_data = {
            sampleCategory: sample_category_id,
            sampleType: sample_type_id,
            description: description,
            url: url_val,
            selectedContentTypes: selected_content_types
        };

        if (!current_editing_sample_id) {
            _perform_save(sample_payload_data);
            return;
        }

        const original_set = new Set(original_content_types_on_load);
        const new_set = new Set(selected_content_types);
        const are_sets_equal = original_set.size === new_set.size && [...original_set].every(value => new_set.has(value));

        if (are_sets_equal) {
            _perform_save(sample_payload_data);
        } else {
            _stage_changes_and_navigate(sample_payload_data);
        }
    }
    
    function render(sample_id_to_edit = null) {
        const t = get_t_internally();
        current_editing_sample_id = sample_id_to_edit;
        const current_state = local_getState();
        const sample_data = current_editing_sample_id ? current_state.samples.find(s => s.id === current_editing_sample_id) : null;
        const sample_config = current_state.ruleFileContent.metadata.samples || {};
        const sample_categories = sample_config.sampleCategories || [];
        const grouped_content_types = current_state.ruleFileContent.metadata.contentTypes || [];

        original_content_types_on_load = sample_data ? [...sample_data.selectedContentTypes] : [];

        form_container_ref.innerHTML = '';
        form_element = Helpers.create_element('form', { class_name: 'add-sample-form' });
        form_element.addEventListener('submit', handle_form_submit);
        form_element.addEventListener('click', handle_button_click);

        // --- Category Section ---
        form_element.appendChild(Helpers.create_element('h2', { text_content: t('sample_category_title') }));
        category_fieldset_element = Helpers.create_element('fieldset', { class_name: 'content-type-parent-group' });
        category_fieldset_element.appendChild(Helpers.create_element('legend', { text_content: t('sample_category_title'), class_name: 'visually-hidden' }));
        sample_categories.forEach((cat, index) => {
            const radio_id = `sample-cat-${cat.id}`;
            const radio_wrapper = Helpers.create_element('div', { class_name: ['form-check', 'content-type-child-item'] });
            const radio = Helpers.create_element('input', { id: radio_id, class_name: 'form-check-input', attributes: { type: 'radio', name: 'sampleCategory', value: cat.id, required: true }});
            if ((sample_data && sample_data.sampleCategory === cat.id) || (!sample_data && index === 0)) radio.checked = true;
            radio.addEventListener('change', () => {
                on_category_change(cat.id);
                if (current_editing_sample_id) debounced_autosave_form();
            });
            radio_wrapper.append(radio, Helpers.create_element('label', { attributes: { for: radio_id }, text_content: cat.text }));
            category_fieldset_element.appendChild(radio_wrapper);
        });
        form_element.appendChild(category_fieldset_element);

        // --- Sample Info Section ---
        form_element.appendChild(Helpers.create_element('h2', { text_content: t('sample_info_title')}));
        sample_type_select = Helpers.create_element('select', { id: 'sampleTypeSelect', class_name: 'form-control', attributes: { required: true, disabled: true }});
        sample_type_select.addEventListener('change', update_description_from_sample_type);
        sample_type_select.addEventListener('change', () => { if (current_editing_sample_id) debounced_autosave_form(); });
        description_input = Helpers.create_element('input', { id: 'sampleDescriptionInput', class_name: 'form-control', attributes: { type: 'text', required: true }});
        description_input.addEventListener('input', () => { if (current_editing_sample_id) debounced_autosave_form(); });
        description_input.addEventListener('blur', () => { if (current_editing_sample_id) debounced_autosave_form(); });
        url_input = Helpers.create_element('input', { id: 'sampleUrlInput', class_name: 'form-control', attributes: { type: 'url' }});
        url_input.addEventListener('input', () => { if (current_editing_sample_id) debounced_autosave_form(); });
        url_input.addEventListener('blur', () => { if (current_editing_sample_id) debounced_autosave_form(); });
        url_form_group_ref = Helpers.create_element('div', { class_name: 'form-group', children: [Helpers.create_element('label', { attributes: {for: 'sampleUrlInput'}, text_content: t('url') }), url_input]});
        form_element.append(
            Helpers.create_element('div', { class_name: 'form-group', children: [Helpers.create_element('label', { attributes: {for: 'sampleTypeSelect'}, text_content: t('sample_type_label') + '*' }), sample_type_select]}),
            Helpers.create_element('div', { class_name: 'form-group', children: [Helpers.create_element('label', { attributes: {for: 'sampleDescriptionInput'}, text_content: t('description') + '*' }), description_input]}),
            url_form_group_ref
        );
        description_input.value = sample_data?.description || "";
        url_input.value = sample_data?.url || "";

        // --- Content Types Section ---
        content_types_container_element = Helpers.create_element('div', { class_name: 'content-types-group' });
        content_types_container_element.appendChild(Helpers.create_element('h2', { text_content: t('content_types')}));
        content_types_container_element.appendChild(Helpers.create_element('p', { text_content: t('content_types_instruction'), style: { 'margin-top': '0', 'color': 'var(--text-color-muted)' } }));
        grouped_content_types.forEach(group => {
            const fieldset = Helpers.create_element('fieldset', { class_name: 'content-type-parent-group' });
            const legend = Helpers.create_element('legend');
            const parent_id = `ct-parent-${group.id}`;
            const parent_checkbox = Helpers.create_element('input', { id: parent_id, class_name: 'form-check-input', attributes: { type: 'checkbox', 'data-parent-id': group.id } });
            legend.append(parent_checkbox, Helpers.create_element('label', { attributes: { for: parent_id }, text_content: group.text }));
            fieldset.appendChild(legend);
            (group.types || []).forEach(child => {
                const child_id = `ct-child-${child.id}`;
                const child_wrapper = Helpers.create_element('div', { class_name: 'form-check content-type-child-item' });
                const child_checkbox = Helpers.create_element('input', { id: child_id, class_name: 'form-check-input', attributes: { type: 'checkbox', name: 'selectedContentTypes', value: child.id, 'data-child-for': group.id } });
                child_wrapper.append(child_checkbox, Helpers.create_element('label', { attributes: { for: child_id }, text_content: child.text }));
                fieldset.appendChild(child_wrapper);
                if (child.description) {
                    const desc_div = Helpers.create_element('div', { class_name: 'content-type-description markdown-content' });
                    if (typeof marked !== 'undefined') desc_div.innerHTML = marked.parse(child.description);
                    else desc_div.textContent = child.description;
                    fieldset.appendChild(desc_div);
                }
            });
            content_types_container_element.appendChild(fieldset);
        });
        content_types_container_element.addEventListener('change', _handleCheckboxChange);
        const all_child_checkboxes = content_types_container_element.querySelectorAll('input[data-child-for]');
        all_child_checkboxes.forEach(cb => { cb.checked = sample_data?.selectedContentTypes?.includes(cb.value) || false; });
        content_types_container_element.querySelectorAll('input[data-parent-id]').forEach(_updateParentCheckboxState);
        form_element.appendChild(content_types_container_element);

        // --- Actions ---
        const actions_div = Helpers.create_element('div', { class_name: 'form-actions' });
        const save_button = Helpers.create_element('button', { class_name: ['button', 'button-primary'], attributes: { type: 'submit' }});
        const button_text = current_editing_sample_id ? t('save_changes_button') : t('save_sample_button');
        const button_span = Helpers.create_element('span', { text_content: button_text });
        save_button.appendChild(button_span);
        if (Helpers.get_icon_svg) {
            const icon_svg = Helpers.get_icon_svg(current_editing_sample_id ? 'save' : 'add');
            if (icon_svg) {
                save_button.insertAdjacentHTML('beforeend', icon_svg);
            }
        }
        actions_div.appendChild(save_button);
        form_element.appendChild(actions_div);
        
        form_container_ref.appendChild(form_element);

        // --- Post-render initialization ---
        const selected_cat_id = sample_data?.sampleCategory || sample_categories[0]?.id;
        if (selected_cat_id) {
            on_category_change(selected_cat_id, sample_data?.sampleType);
        }
        previous_sample_type_value = sample_data?.sampleType ? sample_type_select.options[sample_type_select.selectedIndex]?.text : '';
    }

    function destroy() {
        clearTimeout(debounceTimerFormFields);
        if (form_element) {
            form_element.removeEventListener('submit', handle_form_submit);
            form_element.removeEventListener('click', handle_button_click);
        }
        if (sample_type_select) {
            sample_type_select.removeEventListener('change', update_description_from_sample_type);
            sample_type_select.removeEventListener('change', debounced_autosave_form);
        }
        if (description_input) {
            description_input.removeEventListener('input', debounced_autosave_form);
            description_input.removeEventListener('blur', debounced_autosave_form);
        }
        if (url_input) {
            url_input.removeEventListener('input', debounced_autosave_form);
            url_input.removeEventListener('blur', debounced_autosave_form);
        }
        if (content_types_container_element) content_types_container_element.removeEventListener('change', _handleCheckboxChange);
    }

    return { init, render, destroy };
})();
