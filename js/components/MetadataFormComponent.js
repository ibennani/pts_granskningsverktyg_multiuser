import './metadata_form_component.css';

export const MetadataFormComponent = {
    init({ root, deps, options = {} }) {
        this.root = root;
        this.deps = deps;
        
        // Callbacks from options
        this.on_submit_callback = options.onSubmit;
        this.on_cancel_callback = options.onCancel;
        this.on_go_to_list_callback = options.onGoToList;

        // Dependencies
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.AutosaveService = deps.AutosaveService;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;

        // Internal state
        this.autosave_session = null;
        this.skip_autosave_on_destroy = false;
        this.case_number_input = null;
        this.actor_name_input = null;
        this.actor_link_input = null;
        this.auditor_name_input = null;
        this.case_handler_input = null;
        this.internal_comment_input = null;
        this.form_element_ref = null;

        // Load CSS if possible
        const CSS_PATH = './metadata_form_component.css';
        if (this.Helpers && this.Helpers.load_css) {
            this.Helpers.load_css(CSS_PATH);
        }

        this.handle_autosave_input = this.handle_autosave_input.bind(this);
    },

    _get_form_data(should_trim, trim_text) {
        const sanitize_input = (val) => {
            const value = val ?? '';
            if (this.Helpers?.sanitize_plain_input) {
                return this.Helpers.sanitize_plain_input(value, { trim: should_trim });
            }
            if (!should_trim || typeof value !== 'string') {
                return value;
            }
            return value.trim();
        };

        const sanitize_comment = (val) => {
            const raw_value = val ?? '';
            if (should_trim && typeof trim_text === 'function') {
                return trim_text(raw_value);
            }
            if (this.Helpers?.sanitize_plain_input) {
                return this.Helpers.sanitize_plain_input(raw_value, { trim: should_trim });
            }
            if (!should_trim || typeof raw_value !== 'string') {
                return raw_value;
            }
            return raw_value.trim();
        };

        let actor_link_value_raw = this.actor_link_input?.value ?? '';
        let actor_link_sanitized = sanitize_input(actor_link_value_raw);
        if (should_trim && actor_link_sanitized && this.Helpers?.add_protocol_if_missing) {
            actor_link_sanitized = this.Helpers.add_protocol_if_missing(actor_link_sanitized);
        }

        const raw_comment = this.internal_comment_input?.value ?? '';
        const internal_comment = sanitize_comment(raw_comment);

        return {
            caseNumber: sanitize_input(this.case_number_input?.value ?? ''),
            actorName: sanitize_input(this.actor_name_input?.value ?? ''),
            actorLink: actor_link_sanitized,
            auditorName: sanitize_input(this.auditor_name_input?.value ?? ''),
            caseHandler: sanitize_input(this.case_handler_input?.value ?? ''),
            internalComment: internal_comment
        };
    },

    handle_autosave_input() {
        this.autosave_session?.request_autosave();
    },

    handle_go_to_list_click() {
        const trim_text_fn = this.AutosaveService?.trim_text_preserve_lines;
        const form_data = this._get_form_data(true, trim_text_fn);
        if (typeof this.on_go_to_list_callback === 'function') {
            this.on_go_to_list_callback(form_data);
        }
    },

    handle_cancel_click() {
        this.skip_autosave_on_destroy = true;
        this.autosave_session?.cancel_pending();
        if (typeof this.on_cancel_callback === 'function') {
            this.on_cancel_callback();
        }
    },

    handle_form_submit(event) {
        event.preventDefault();
        this.autosave_session?.flush({ should_trim: true, skip_render: true });

        const trim_text_fn = this.AutosaveService?.trim_text_preserve_lines;
        const form_data = this._get_form_data(true, trim_text_fn);

        if (typeof this.on_submit_callback === 'function') {
            this.on_submit_callback(form_data);
        }
    },

    create_form_field(id, label_key, type = 'text', current_value = '', is_required = false) {
        const t = this.Translation.t;
        const form_group = this.Helpers.create_element('div', { class_name: 'form-group' });
        const label = this.Helpers.create_element('label', {
            attributes: { for: id },
            text_content: t(label_key)
        });

        let input_element;
        const attributes = { type: type };
        if (is_required) {
            attributes.required = true;
        }

        // Bind for event listeners
        if (type === 'textarea') {
            input_element = this.Helpers.create_element('textarea', {
                id: id, class_name: 'form-control', attributes: { rows: '4', ...attributes }
            });
            input_element.value = current_value;
        } else {
            input_element = this.Helpers.create_element('input', {
                id: id, class_name: 'form-control', attributes: attributes
            });
            input_element.value = current_value;
        }

        form_group.appendChild(label);
        form_group.appendChild(input_element);
        return { form_group, input_element };
    },

    render(options = {}) {
        const t = this.Translation?.t || (k => k);
        const {
            initialData = {},
            submitButtonText = t('metadata_form_submit'),
            cancelButtonText = null,
            goToListButtonText = null
        } = options;

        this.root.innerHTML = '';
        const form_wrapper = this.Helpers.create_element('div', { class_name: 'metadata-form-container' });

        this.form_element_ref = this.Helpers.create_element('form');
        this.form_element_ref.setAttribute('novalidate', ''); 
        
        // Bind methods
        this.handle_form_submit = this.handle_form_submit.bind(this);
        this.form_element_ref.addEventListener('submit', this.handle_form_submit);

        const case_field = this.create_form_field('caseNumber', 'case_number', 'text', initialData.caseNumber);
        this.case_number_input = case_field.input_element;
        this.form_element_ref.appendChild(case_field.form_group);

        const actor_field = this.create_form_field('actorName', 'actor_name', 'text', initialData.actorName);
        this.actor_name_input = actor_field.input_element;
        this.form_element_ref.appendChild(actor_field.form_group);

        const actor_link_field = this.create_form_field('actorLink', 'actor_link', 'url', initialData.actorLink);
        this.actor_link_input = actor_link_field.input_element;
        this.actor_link_input.addEventListener('blur', () => {
            const val = (this.actor_link_input?.value || '').trim();
            if (val && this.Helpers?.add_protocol_if_missing) {
                const fixed = this.Helpers.add_protocol_if_missing(val);
                if (fixed !== val) {
                    this.actor_link_input.value = fixed;
                }
            }
        });
        this.form_element_ref.appendChild(actor_link_field.form_group);

        const auditor_field = this.create_form_field('auditorName', 'auditor_name', 'text', initialData.auditorName);
        this.auditor_name_input = auditor_field.input_element;
        this.form_element_ref.appendChild(auditor_field.form_group);
        
        const case_handler_field = this.create_form_field('caseHandler', 'case_handler', 'text', initialData.caseHandler);
        this.case_handler_input = case_handler_field.input_element;
        this.form_element_ref.appendChild(case_handler_field.form_group);

        const comment_field = this.create_form_field('internalComment', 'internal_comment', 'textarea', initialData.internalComment);
        this.internal_comment_input = comment_field.input_element;
        this.form_element_ref.appendChild(comment_field.form_group);
        
        if (this.Helpers.init_auto_resize_for_textarea) {
            this.Helpers.init_auto_resize_for_textarea(this.internal_comment_input);
        }

        this.autosave_session?.destroy();
        this.autosave_session = null;
        if (this.AutosaveService && this.dispatch && this.StoreActionTypes) {
            this.autosave_session = this.AutosaveService.create_session({
                form_element: this.form_element_ref,
                focus_root: this.form_element_ref,
                debounce_ms: 250,
                on_save: ({ is_autosave, should_trim, skip_render, trim_text }) => {
                    const payload = this._get_form_data(should_trim, trim_text);
                    this.dispatch({
                        type: this.StoreActionTypes.UPDATE_METADATA,
                        payload: {
                            ...payload,
                            skip_render: skip_render === true
                        }
                    });
                }
            });
        }

        const inputs_for_autosave = [
            this.case_number_input,
            this.actor_name_input,
            this.actor_link_input,
            this.auditor_name_input,
            this.case_handler_input,
            this.internal_comment_input
        ];
        inputs_for_autosave.forEach((el) => {
            if (el) el.addEventListener('input', this.handle_autosave_input);
        });

        const form_actions_wrapper = this.Helpers.create_element('div', { class_name: 'form-actions' });

        const submit_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'submit' },
            html_content: `<span>${submitButtonText}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('arrow_forward') : '')
        });
        form_actions_wrapper.appendChild(submit_button);

        if (goToListButtonText && typeof this.on_go_to_list_callback === 'function') {
            const go_to_list_button = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                attributes: { type: 'button' },
                text_content: goToListButtonText
            });
            go_to_list_button.addEventListener('click', () => this.handle_go_to_list_click());
            form_actions_wrapper.appendChild(go_to_list_button);
        }

        if (cancelButtonText && typeof this.on_cancel_callback === 'function') {
            const cancel_button = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                attributes: { type: 'button' },
                text_content: cancelButtonText
            });
            cancel_button.addEventListener('click', () => this.handle_cancel_click());
            form_actions_wrapper.appendChild(cancel_button);
        }

        this.form_element_ref.appendChild(form_actions_wrapper);
        form_wrapper.appendChild(this.form_element_ref);
        this.root.appendChild(form_wrapper);
    },

    destroy() {
        if (!this.skip_autosave_on_destroy && this.form_element_ref && this.AutosaveService) {
            this.autosave_session?.flush({ should_trim: true, skip_render: true });
        }
        this.autosave_session?.destroy();
        this.autosave_session = null;

        if (this.form_element_ref) {
            this.form_element_ref.removeEventListener('submit', this.handle_form_submit);
        }

        if (this.root) this.root.innerHTML = '';
        this.form_element_ref = null;
        this.on_submit_callback = null;
        this.on_cancel_callback = null;
        this.on_go_to_list_callback = null;
        this.root = null;
        this.deps = null;
    }
};
