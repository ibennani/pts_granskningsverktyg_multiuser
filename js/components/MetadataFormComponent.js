export const MetadataFormComponent = {
    init({ root, deps, options = {} }) {
        this.root = root;
        this.deps = deps;
        
        // Callbacks from options
        this.on_submit_callback = options.onSubmit;
        this.on_cancel_callback = options.onCancel;

        // Dependencies
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        
        // Internal state
        this.case_number_input = null;
        this.actor_name_input = null;
        this.actor_link_input = null;
        this.auditor_name_input = null;
        this.case_handler_input = null;
        this.internal_comment_input = null;
        this.form_element_ref = null;

        // Load CSS if possible
        const CSS_PATH = 'css/components/metadata_form_component.css';
        if (this.Helpers && this.Helpers.load_css) {
            this.Helpers.load_css(CSS_PATH);
        }
    },

    handle_form_submit(event) {
        event.preventDefault();
        
        const actor_name_value = this.actor_name_input.value.trim();
        const t = this.Translation.t;

        if (!actor_name_value) {
            if (this.NotificationComponent) {
                this.NotificationComponent.show_global_message(t('field_is_required', { fieldName: t('actor_name') }), 'error');
            }
            this.actor_name_input.focus();
            this.actor_name_input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        let actor_link_value = this.actor_link_input.value.trim();
        if (actor_link_value && this.Helpers.add_protocol_if_missing) {
            actor_link_value = this.Helpers.add_protocol_if_missing(actor_link_value);
        }

        const sanitize_input = (input) => {
            if (typeof input !== 'string') return '';
            return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        };

        const form_data = {
            caseNumber: sanitize_input(this.case_number_input.value),
            actorName: sanitize_input(actor_name_value),
            actorLink: sanitize_input(actor_link_value),
            auditorName: sanitize_input(this.auditor_name_input.value),
            caseHandler: sanitize_input(this.case_handler_input.value),
            internalComment: sanitize_input(this.internal_comment_input.value)
        };

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
        const {
            initialData = {},
            submitButtonText = 'Submit',
            cancelButtonText = null
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

        const actor_field = this.create_form_field('actorName', 'actor_name', 'text', initialData.actorName, true);
        this.actor_name_input = actor_field.input_element;
        this.form_element_ref.appendChild(actor_field.form_group);

        const actor_link_field = this.create_form_field('actorLink', 'actor_link', 'url', initialData.actorLink);
        this.actor_link_input = actor_link_field.input_element;
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

        const form_actions_wrapper = this.Helpers.create_element('div', { class_name: 'form-actions' });
        
        if (cancelButtonText && typeof this.on_cancel_callback === 'function') {
            const cancel_button = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                attributes: { type: 'button' },
                text_content: cancelButtonText
            });
            cancel_button.addEventListener('click', this.on_cancel_callback);
            form_actions_wrapper.appendChild(cancel_button);
        }

        const submit_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'submit' },
            html_content: `<span>${submitButtonText}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('arrow_forward') : '')
        });
        form_actions_wrapper.appendChild(submit_button);

        this.form_element_ref.appendChild(form_actions_wrapper);
        form_wrapper.appendChild(this.form_element_ref);
        this.root.appendChild(form_wrapper);
    },

    destroy() {
        if (this.form_element_ref) {
            this.form_element_ref.removeEventListener('submit', this.handle_form_submit);
        }
        
        // No strict need to remove other listeners as we are clearing innerHTML and dropping references, 
        // but for completeness one could track them.
        
        if (this.root) this.root.innerHTML = '';
        this.form_element_ref = null;
        this.on_submit_callback = null;
        this.on_cancel_callback = null;
        this.root = null;
        this.deps = null;
    }
};
