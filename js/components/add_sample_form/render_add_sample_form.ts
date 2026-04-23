import { marked } from '../../utils/markdown.js';

export function render_add_sample_form(component: any, sample_id_to_edit: string | null = null) {
    // Prevent re-rendering (and resetting form state) only when editing the same existing sample and the form is mounted.
    // For "add new sample" (null) we always re-render so that checkboxes start unchecked.
    // Kräv isConnected: annars kan contain() vara sant för en frånkopplad subträd efter att värden
    // (t.ex. parent.innerHTML) tagit bort noden från dokumentet — då måste formuläret byggas om från state.
    if (sample_id_to_edit !== null &&
        component.current_editing_sample_id === sample_id_to_edit &&
        component.form_element &&
        component.root &&
        component.root.isConnected &&
        component.root.contains(component.form_element)) {
        return;
    }

    const t = component.get_t_internally();
    component.current_editing_sample_id = sample_id_to_edit;
    const current_state = component.getState();
    const sample_data = component.current_editing_sample_id
        ? current_state.samples.find((s: any) => s.id === component.current_editing_sample_id)
        : null;
    const draft = current_state?.sampleEditDraft
        && component.current_editing_sample_id
        && String(current_state.sampleEditDraft.sampleId) === String(component.current_editing_sample_id)
        ? current_state.sampleEditDraft
        : null;
    const effective_sample_data = draft?.updatedSampleData ? draft.updatedSampleData : sample_data;

    // Spara ursprungsläget när vyn laddas (endast för redigering)
    if (sample_data) {
        component.initial_sample_snapshot = JSON.parse(JSON.stringify(sample_data));
    } else {
        component.initial_sample_snapshot = null;
    }

    const sample_categories = component.get_sample_categories_from_state();
    const grouped_content_types =
        current_state.ruleFileContent.metadata?.vocabularies?.contentTypes ||
        current_state.ruleFileContent.metadata?.contentTypes ||
        [];

    component.original_content_types_on_load = sample_data ? [...(sample_data.selectedContentTypes || [])] : [];

    component.root.innerHTML = '';
    component.form_element = component.Helpers.create_element('form', { class_name: 'add-sample-form' });
    component.form_element.addEventListener('submit', component.handle_form_submit);

    // --- Category Section ---
    component.form_element.appendChild(component.Helpers.create_element('h2', { text_content: t('sample_category_title') }));
    component.category_fieldset_element = component.Helpers.create_element('fieldset', { class_name: 'content-type-parent-group' });
    component.category_fieldset_element.appendChild(component.Helpers.create_element('legend', { text_content: t('sample_category_title'), class_name: 'visually-hidden' }));
    sample_categories.forEach((cat: any, index: number) => {
        const radio_id = `sample-cat-${cat.id}`;
        const radio_wrapper = component.Helpers.create_element('div', { class_name: ['form-check', 'content-type-child-item'] });
        const radio = component.Helpers.create_element('input', { id: radio_id, class_name: 'form-check-input', attributes: { type: 'radio', name: 'sampleCategory', value: cat.id, required: true } });
        if ((effective_sample_data && effective_sample_data.sampleCategory === cat.id) || (!effective_sample_data && index === 0)) radio.checked = true;
        radio.addEventListener('change', () => {
            component.on_category_change(cat.id);
            // Variant B: kategoriändring ska direkt uppdatera utkastet (utan att trimma).
            component.save_form_data_immediately(true, false, true);
        });
        radio_wrapper.append(radio, component.Helpers.create_element('label', { attributes: { for: radio_id }, text_content: cat.text }));
        component.category_fieldset_element.appendChild(radio_wrapper);
    });
    component.form_element.appendChild(component.category_fieldset_element);

    // --- Sample Info Section ---
    component.form_element.appendChild(component.Helpers.create_element('h2', { text_content: t('sample_info_title') }));
    component.sample_type_container = component.Helpers.create_element('div', { class_name: 'form-group' });
    component.description_input = component.Helpers.create_element('input', { id: 'sampleDescriptionInput', class_name: 'form-control', attributes: { type: 'text', required: true } });
    component.description_input.addEventListener('input', component.handle_autosave_input);
    component.url_input = component.Helpers.create_element('input', { id: 'sampleUrlInput', class_name: 'form-control', attributes: { type: 'url' } });
    component.url_input.addEventListener('input', component.handle_autosave_input);
    component.url_input.addEventListener('blur', () => {
        const val = (component.url_input?.value || '').trim();
        if (val && component.Helpers?.add_protocol_if_missing) {
            const fixed = component.Helpers.add_protocol_if_missing(val);
            if (fixed !== val) {
                component.url_input.value = fixed;
            }
        }
    });
    component.url_form_group_ref = component.Helpers.create_element('div', {
        class_name: 'form-group',
        children: [
            component.Helpers.create_element('label', { attributes: { for: 'sampleUrlInput' }, text_content: t('url') }),
            component.url_input
        ]
    });
    component.form_element.append(
        component.sample_type_container,
        component.Helpers.create_element('div', { class_name: 'form-group', children: [component.Helpers.create_element('label', { attributes: { for: 'sampleDescriptionInput' }, text_content: t('description') + '*' }), component.description_input] }),
        component.url_form_group_ref
    );
    component.description_input.value = effective_sample_data?.description || "";
    component.url_input.value = effective_sample_data?.url || "";

    // --- Content Types Section ---
    component.content_types_container_element = component.Helpers.create_element('div', { class_name: 'content-types-group' });
    component.content_types_container_element.appendChild(component.Helpers.create_element('h2', { text_content: t('content_types') }));
    component.content_types_container_element.appendChild(component.Helpers.create_element('p', { text_content: t('content_types_instruction'), style: { 'margin-top': '0', 'color': 'var(--text-color-muted)' } }));
    grouped_content_types.forEach((group: any) => {
        const fieldset = component.Helpers.create_element('fieldset', { class_name: 'content-type-parent-group' });
        const group_children_id = `ct-children-${group.id}`;

        const legend = component.Helpers.create_element('legend', { class_name: 'visually-hidden', text_content: group.text });
        fieldset.appendChild(legend);

        const parent_header = component.Helpers.create_element('div', { class_name: 'content-type-parent-header' });
        const parent_id = `ct-parent-${group.id}`;
        const parent_checkbox = component.Helpers.create_element('input', {
            id: parent_id,
            class_name: 'form-check-input',
            attributes: {
                type: 'checkbox',
                'data-parent-id': group.id,
                'aria-controls': group_children_id,
                'aria-label': `${group.text}, välj alla`
            }
        });
        const parent_h3 = component.Helpers.create_element('h3');
        const parent_label = component.Helpers.create_element('label', { attributes: { for: parent_id }, text_content: group.text, class_name: 'content-type-parent-label' });
        parent_h3.appendChild(parent_label);
        parent_header.append(parent_checkbox, parent_h3);
        fieldset.appendChild(parent_header);

        const children_container = component.Helpers.create_element('div', { class_name: 'content-type-children-container', attributes: { id: group_children_id } });

        (group.types || []).forEach((child: any) => {
            const child_id = `ct-child-${child.id}`;
            const child_wrapper = component.Helpers.create_element('div', { class_name: 'form-check content-type-child-item' });
            const desc_id = child.description ? `ct-desc-${child.id}` : null;
            const child_checkbox = component.Helpers.create_element('input', {
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
            const child_label = component.Helpers.create_element('label', {
                attributes: { for: child_id, id: `${child_id}-label` },
                text_content: child.text
            });
            child_wrapper.append(child_checkbox, child_label);
            children_container.appendChild(child_wrapper);

            if (child.description) {
                const desc_div = component.Helpers.create_element('div', {
                    class_name: 'content-type-description markdown-content',
                    attributes: { id: desc_id }
                });
                if (typeof marked !== 'undefined') {
                    const raw_html = marked.parse(child.description);
                    desc_div.innerHTML = component.Helpers.sanitize_html
                        ? component.Helpers.sanitize_html(raw_html)
                        : raw_html;
                } else {
                    desc_div.textContent = child.description;
                }
                children_container.appendChild(desc_div);
            }
        });
        fieldset.appendChild(children_container);
        component.content_types_container_element.appendChild(fieldset);
    });
    component.content_types_container_element.addEventListener('change', component.handle_content_type_change);
    const all_child_checkboxes = component.content_types_container_element.querySelectorAll('input[data-child-for]');
    all_child_checkboxes.forEach((cb: any) => {
        cb.checked = effective_sample_data
            ? (effective_sample_data.selectedContentTypes?.includes(cb.value) || false)
            : false;
    });
    const all_parent_checkboxes = component.content_types_container_element.querySelectorAll('input[data-parent-id]');
    if (effective_sample_data) {
        all_parent_checkboxes.forEach((pc: any) => component._updateParentCheckboxState(pc));
    } else {
        all_parent_checkboxes.forEach((pc: any) => {
            pc.checked = false;
            pc.indeterminate = false;
            pc.setAttribute('aria-checked', 'false');
        });
    }
    component.form_element.appendChild(component.content_types_container_element);

    // --- Actions ---
    const actions_div = component.Helpers.create_element('div', { class_name: 'form-actions' });
    const save_button = component.Helpers.create_element('button', { class_name: ['button', 'button-primary'], attributes: { type: 'submit' } });
    const button_text = component.current_editing_sample_id ? t('save_changes_button') : t('save_sample_button');
    const button_span = component.Helpers.create_element('span', { text_content: button_text });
    save_button.appendChild(button_span);
    if (component.Helpers.get_icon_svg) {
        const icon_svg = component.Helpers.get_icon_svg(component.current_editing_sample_id ? 'save' : 'add');
        if (icon_svg) {
            save_button.insertAdjacentHTML('beforeend', icon_svg);
        }
    }
    actions_div.appendChild(save_button);
    component.form_element.appendChild(actions_div);

    component.root.appendChild(component.form_element);

    component.autosave_session?.destroy();
    component.autosave_session = null;
    if (component.current_editing_sample_id && component.AutosaveService) {
        component.autosave_session = component.AutosaveService.create_session({
            form_element: component.form_element,
            focus_root: component.form_element,
            debounce_ms: 250,
            on_save: ({ is_autosave, skip_render }: any) => {
                component.save_form_data_immediately(is_autosave, !is_autosave, skip_render);
            }
        });
    }

    // --- Post-render initialization ---
    const selected_cat_id = effective_sample_data?.sampleCategory || sample_categories[0]?.id;
    if (selected_cat_id) {
        component.on_category_change(selected_cat_id, effective_sample_data?.sampleType);
    }
    component.previous_sample_type_value = effective_sample_data?.sampleType
        ? component.sample_type_select.options[component.sample_type_select.selectedIndex]?.text
        : '';
}

