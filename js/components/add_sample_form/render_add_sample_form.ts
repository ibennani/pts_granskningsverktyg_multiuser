import { render_content_types_section_accordion } from './content_type_accordion.js';
import { handle_sample_attach_media_click, render_sample_screenshot_section } from './sample_attach_media.js';
import { sync_sample_auto_screenshot_state_from_data } from './sample_url_auto_screenshot.js';
import { update_content_type_analyze_visibility } from './content_type_detection.js';
import { create_sample_url_analyze_button } from './sample_url_analyze_status.js';
import { resolve_content_types } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';

type ContentTypeGroupOption = {
    id: string;
    text: string;
    types?: Array<{ id: string; text: string; description?: string }>;
};

export function render_add_sample_form(component: any, sample_id_to_edit: string | null = null) {
    // Undvik omrendering när samma vy redan är monterad — annars avbryts t.ex. pågående sidanalys.
    // Kräv isConnected: annars kan contain() vara sant för en frånkopplad subträd efter att värden
    // (t.ex. parent.innerHTML) tagit bort noden från dokumentet — då måste formuläret byggas om från state.
    const form_already_mounted =
        component.form_element &&
        component.root &&
        component.root.isConnected &&
        component.root.contains(component.form_element);
    if (form_already_mounted) {
        if (
            sample_id_to_edit !== null &&
            component.current_editing_sample_id === sample_id_to_edit
        ) {
            return;
        }
        if (sample_id_to_edit === null && component.current_editing_sample_id === null) {
            return;
        }
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
    const new_sample_draft = !component.current_editing_sample_id && typeof component.load_new_sample_draft_for_form === 'function'
        ? component.load_new_sample_draft_for_form()
        : null;
    const effective_sample_data = draft?.updatedSampleData
        ? draft.updatedSampleData
        : (sample_data || new_sample_draft);

    // Spara ursprungsläget när vyn laddas (endast för redigering)
    if (sample_data) {
        component.initial_sample_snapshot = JSON.parse(JSON.stringify(sample_data));
    } else {
        component.initial_sample_snapshot = null;
    }

    const sample_categories = component.get_sample_categories_from_state();
    const grouped_content_types = resolve_content_types(current_state.ruleFileContent.metadata) as ContentTypeGroupOption[];

    component.original_content_types_on_load = sample_data ? [...(sample_data.selectedContentTypes || [])] : [];

    component.root.innerHTML = '';
    component.page_title_label_loading_count = 0;
    component.form_element = component.Helpers.create_element('form', { class_name: 'add-sample-form' });
    // Ny granskningsdel: ignorera DraftManager (samma route-nyckel som tidigare partiellt ifyllt formulär)
    // annars återställs kryssrutor/radio/text från localStorage/sessionStorage efter render.
    if (sample_id_to_edit === null) {
        component.form_element.setAttribute('data-draft-ignore', 'true');
    }
    component.form_element.addEventListener('submit', component.handle_form_submit);

    // --- Category Section ---
    component.form_element.appendChild(component.Helpers.create_element('h2', { text_content: t('sample_category_title') }));
    component.category_fieldset_element = component.Helpers.create_element('fieldset', { class_name: 'content-type-parent-group' });
    component.category_fieldset_element.appendChild(component.Helpers.create_element('legend', { text_content: t('sample_category_title'), class_name: 'visually-hidden' }));
    sample_categories.forEach((cat: any) => {
        const radio_id = `sample-cat-${cat.id}`;
        const radio_wrapper = component.Helpers.create_element('div', { class_name: ['form-check', 'content-type-child-item'] });
        const radio = component.Helpers.create_element('input', { id: radio_id, class_name: 'form-check-input', attributes: { type: 'radio', name: 'sampleCategory', value: cat.id } });
        if (effective_sample_data && effective_sample_data.sampleCategory === cat.id) radio.checked = true;
        radio.addEventListener('change', () => {
            component.on_category_change(cat.id);
            component.save_form_data_immediately(true, false, true);
        });
        radio_wrapper.append(radio, component.Helpers.create_element('label', { attributes: { for: radio_id }, text_content: cat.text }));
        component.category_fieldset_element.appendChild(radio_wrapper);
    });
    component.form_element.appendChild(component.category_fieldset_element);

    // --- Sample Info Section ---
    component.form_element.appendChild(component.Helpers.create_element('h2', { text_content: t('sample_info_title') }));
    component.sample_type_container = component.Helpers.create_element('div', { class_name: 'form-group' });
    component.description_input = component.Helpers.create_element('input', { id: 'sampleDescriptionInput', class_name: 'form-control', attributes: { type: 'text' } });
    component.description_input.addEventListener('input', component.handle_autosave_input);
    component.description_label_element = component.Helpers.create_element('label', {
        class_name: 'sample-description-label',
        attributes: { for: 'sampleDescriptionInput' }
    });
    component.description_label_element.appendChild(component.Helpers.create_element('span', {
        class_name: 'sample-description-label__text',
        text_content: t('description')
    }));
    component.url_input = component.Helpers.create_element('input', { id: 'sampleUrlInput', class_name: 'form-control', attributes: { type: 'url' } });
    component.url_input.addEventListener('input', () => {
        component.handle_autosave_input();
        update_content_type_analyze_visibility(component);
    });
    const url_analyze_parts = create_sample_url_analyze_button(component.Helpers, t);
    component.url_analyze_button_parts = url_analyze_parts;
    component.url_analyze_btn = url_analyze_parts.button;
    component.url_analyze_btn.addEventListener('click', () => {
        if (typeof component.handle_analyze_url_page_click === 'function') {
            component.handle_analyze_url_page_click();
        }
    });
    const url_input_row = component.Helpers.create_element('div', {
        class_name: 'sample-url-input-row',
        children: [component.url_input, url_analyze_parts.wrapper]
    });
    component.url_form_group_ref = component.Helpers.create_element('div', {
        class_name: 'form-group',
        children: [
            component.Helpers.create_element('label', { attributes: { for: 'sampleUrlInput' }, text_content: t('url') }),
            url_input_row
        ]
    });
    component.form_element.append(
        component.sample_type_container,
        component.url_form_group_ref,
        component.Helpers.create_element('div', {
            class_name: 'form-group',
            children: [component.description_label_element, component.description_input]
        })
    );
    component.description_input.value = effective_sample_data?.description || "";
    component.url_input.value = effective_sample_data?.url || "";
    update_content_type_analyze_visibility(component);

    // --- Content Types Section ---
    // Vid redigering kommer kryssrutorna från state/utkast i Redux. DraftManager.restoreIntoDom körs
    // efter render och skrev annars över barnrutor från session-/localStorage-utkast utan att
    // förälderkryssor räknas om → urkryssad förälder men ikryssade barn.
    const content_types_group_options: { class_name: string; attributes?: Record<string, string> } = {
        class_name: 'content-types-group'
    };
    if (sample_id_to_edit !== null) {
        content_types_group_options.attributes = { 'data-draft-ignore': 'true' };
    }
    component.content_types_container_element = component.Helpers.create_element('div', content_types_group_options);
    sync_sample_auto_screenshot_state_from_data(component, effective_sample_data);
    const sample_screenshot_section = render_sample_screenshot_section(component, effective_sample_data);
    component.sample_attach_media_btn.addEventListener('click', (event: Event) => {
        handle_sample_attach_media_click(component, event);
    });
    component.content_types_container_element.appendChild(sample_screenshot_section);
    render_content_types_section_accordion(component, grouped_content_types, effective_sample_data);
    component.content_types_container_element.addEventListener('change', component.handle_content_type_change);
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

    if (component.show_back_to_samples_button && typeof component.discard_callback === 'function') {
        const return_button = component.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: { type: 'button' },
            html_content:
                `<span>${t('back_to_sample_management')}</span>` +
                (component.Helpers.get_icon_svg ? component.Helpers.get_icon_svg('arrow_back') : '')
        });
        return_button.addEventListener('click', (event: Event) => {
            event.preventDefault();
            component.discard_callback();
        });
        actions_div.appendChild(return_button);
    }

    component.form_element.appendChild(actions_div);

    component.root.appendChild(component.form_element);

    component.autosave_session?.destroy();
    component.autosave_session = null;
    if (component.AutosaveService) {
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
    const selected_cat_id = effective_sample_data?.sampleCategory ?? null;
    if (selected_cat_id) {
        component.on_category_change(selected_cat_id, effective_sample_data?.sampleType ?? null);
    } else if (sample_id_to_edit === null) {
        // Ny granskningsdel: ingen förvald kategori — typväljaren visas efter att användaren valt kategori.
        component.sample_type_container.innerHTML = '';
        const hint = component.Helpers.create_element('p', {
            class_name: 'add-sample-category-hint',
            text_content: t('add_sample_select_category_before_type'),
            style: { margin: '0', color: 'var(--text-color-muted)' }
        });
        component.sample_type_container.appendChild(hint);
        component.sample_type_select = null;
        if (component.url_form_group_ref) {
            component.url_form_group_ref.style.display = 'none';
            if (component.url_input) component.url_input.value = '';
        }
    }
    component.previous_sample_type_value =
        component.sample_type_select && effective_sample_data?.sampleType
            ? component.sample_type_select.options[component.sample_type_select.selectedIndex]?.text
            : '';
}

