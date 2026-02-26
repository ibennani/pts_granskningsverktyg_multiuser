// js/components/EditSampleTypesSectionComponent.js

export const EditSampleTypesSectionComponent = {
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
            await this.Helpers.load_css(this.CSS_PATH).catch(err => console.warn('[EditSampleTypesSectionComponent] Failed to load CSS', err));
        }
    },

    _clone_metadata(metadata) {
        return JSON.parse(JSON.stringify(metadata || {}));
    },

    _generate_slug(value) {
        if (!value) return '';
        return value.toString().trim().toLowerCase()
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-{2,}/g, '-')
            .replace(/^-+|-+$/g, '');
    },

    _get_flattened_sample_types(metadata) {
        const samples = metadata?.samples || {};
        const vocabularies = metadata?.vocabularies || {};
        let sample_categories = samples.sampleCategories || [];
        if (!Array.isArray(sample_categories) || sample_categories.length === 0) {
            const vocab_samples = vocabularies.sampleTypes || {};
            if (Array.isArray(vocab_samples.sampleCategories)) {
                sample_categories = vocab_samples.sampleCategories;
            }
        }
        const types = [];
        sample_categories.forEach(cat => {
            // Textarean redigerar endast underkategorierna (stickprovstyperna), inte parent-kategorin
            (cat.categories || []).forEach(sub => {
                types.push(sub.text || sub.id || '');
            });
        });
        return types.filter(Boolean);
    },

    _save_form_values_to_metadata(workingMetadata, shouldTrim = false) {
        if (!this.form_element_ref) return;
        const textarea = this.form_element_ref.querySelector('textarea[name="sampleTypes"]');
        if (!textarea) return;
        const raw_value = textarea.value;
        const lines = shouldTrim && this.Helpers?.trim_textarea_preserve_lines
            ? this.Helpers.trim_textarea_preserve_lines(raw_value).split('\n').filter(line => line.length > 0)
            : shouldTrim
                ? raw_value.split('\n').map(line => line.trim()).filter(line => line.length > 0)
                : raw_value.split('\n');
        const categories = lines.map(text => {
            const trimmed = shouldTrim ? text.trim() : text;
            return { id: this._generate_slug(trimmed), text: trimmed };
        }).filter(c => c.text.length > 0);
        if (categories.length === 0) {
            categories.push({ id: 'ovrigt', text: 'Övrigt' });
        }
        const samples = workingMetadata.samples || {};
        const vocabularies = workingMetadata.vocabularies || {};
        const sample_categories = [{
            id: 'allman',
            text: 'Allmän',
            hasUrl: false,
            categories
        }];
        if (!samples.sampleCategories) samples.sampleCategories = [];
        samples.sampleCategories = sample_categories;
        if (!vocabularies.sampleTypes) vocabularies.sampleTypes = {};
        vocabularies.sampleTypes.sampleCategories = sample_categories;
    },

    _perform_save(shouldTrim, skip_render) {
        if (!this.form_element_ref) return;
        const state = this.getState();
        if (!this.working_metadata) {
            const base_metadata = state?.ruleFileContent?.metadata || {};
            this.working_metadata = this._clone_metadata(base_metadata);
        }
        this._save_form_values_to_metadata(this.working_metadata, shouldTrim);
        const currentRulefile = state?.ruleFileContent || {};
        const updatedMetadata = { ...this.working_metadata };
        if (!updatedMetadata.vocabularies) updatedMetadata.vocabularies = {};
        if (!updatedMetadata.samples) updatedMetadata.samples = {};
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
    },

    handle_autosave_input() {
        this.autosave_session?.request_autosave();
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
        const metadata = state?.ruleFileContent?.metadata || {};

        if (this.form_element_ref && this.root.contains(this.form_element_ref) && this.root.children.length > 0) {
            return;
        }

        this.initial_metadata_snapshot = this._clone_metadata(metadata);
        this.working_metadata = this._clone_metadata(metadata);

        this.root.innerHTML = '';

        const t = this.Translation.t;
        const types = this._get_flattened_sample_types(metadata);
        const initial_value = types.join('\n');

        const form = this.Helpers.create_element('form', { class_name: 'rulefile-metadata-edit-form' });

        const section = this.Helpers.create_element('section', { class_name: 'form-section' });
        const label_text = t('rulefile_sections_sample_types_textarea_label') || 'Stickprovstyper (en per rad).';
        const label = this.Helpers.create_element('label', {
            attributes: { for: 'sample-types-textarea' },
            html_content: `<strong>${this.Helpers.escape_html ? this.Helpers.escape_html(label_text) : label_text}</strong>`
        });
        const instruction_line1 = this.Helpers.create_element('p', {
            class_name: 'field-hint',
            text_content: t('rulefile_sections_sample_types_instruction_line1') || 'Skriv en stickprovstyp per rad.'
        });
        const instruction_line2 = this.Helpers.create_element('p', {
            class_name: 'field-hint',
            text_content: t('rulefile_sections_sample_types_instruction_line2') || 'Tomma rader ignoreras vid sparning.'
        });
        const textarea = this.Helpers.create_element('textarea', {
            class_name: 'form-control',
            attributes: {
                id: 'sample-types-textarea',
                name: 'sampleTypes',
                rows: '4'
            }
        });
        textarea.value = initial_value;
        textarea.addEventListener('input', this.handle_autosave_input);
        this.Helpers.init_auto_resize_for_textarea?.(textarea);

        section.appendChild(label);
        section.appendChild(instruction_line1);
        section.appendChild(instruction_line2);
        section.appendChild(textarea);
        form.appendChild(section);

        const save_button_container = this.Helpers.create_element('div', { class_name: 'form-actions' });
        const save_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: {
                type: 'button',
                'aria-label': t('rulefile_metadata_save_sample_types') || 'Spara stickprovstyper'
            },
            html_content: `<span>${t('rulefile_metadata_save_sample_types') || 'Spara stickprovstyper'}</span>` +
                (this.Helpers.get_icon_svg ? `<span aria-hidden="true">${this.Helpers.get_icon_svg('save', ['currentColor'], 16)}</span>` : '')
        });
        save_button.addEventListener('click', () => {
            this.autosave_session?.flush?.({ should_trim: true, skip_render: true });
            if (window.DraftManager?.commitCurrentDraft) {
                window.DraftManager.commitCurrentDraft();
            }
            this.NotificationComponent.show_global_message?.(
                t('rulefile_sections_sample_types_saved') || 'Stickprovstyper sparade',
                'success'
            );
            sessionStorage.setItem('focusAfterLoad', '.rulefile-sections-header h2');
            this.router('rulefile_sections', { section: 'sample_types' });
        });

        const cancel_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: {
                type: 'button',
                'aria-label': t('rulefile_sample_types_back_without_saving') || 'Tillbaka till stickprov utan att spara'
            },
            html_content: `<span>${t('rulefile_sample_types_back_without_saving') || 'Tillbaka till stickprov utan att spara'}</span>`
        });
        cancel_button.addEventListener('click', () => {
            this._restore_initial_state();
            this.skip_autosave_on_destroy = true;
            this.autosave_session?.cancel_pending?.();
            sessionStorage.setItem('focusAfterLoad', '.rulefile-sections-header h2');
            this.router('rulefile_sections', { section: 'sample_types' });
        });

        save_button_container.appendChild(save_button);
        save_button_container.appendChild(cancel_button);
        form.appendChild(save_button_container);

        form.addEventListener('submit', (event) => {
            event.preventDefault();
        });

        this.form_element_ref = form;

        this.autosave_session?.destroy?.();
        this.autosave_session = this.AutosaveService?.create_session?.({
            form_element: form,
            focus_root: form,
            debounce_ms: 250,
            on_save: ({ should_trim = false, skip_render = false } = {}) => {
                this._perform_save(should_trim, skip_render);
            }
        }) || null;

        this.root.appendChild(form);
    },

    destroy() {
        if (!this.skip_autosave_on_destroy && this.form_element_ref && this.working_metadata) {
            this.autosave_session?.flush?.({ should_trim: true, skip_render: true });
        }
        this.autosave_session?.destroy?.();
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
