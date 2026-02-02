export const EditRulefileMainViewComponent = {
    init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
    },

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        this.root.innerHTML = '';
        const plate_element = this.Helpers.create_element('div', { class_name: 'content-plate' });
        
        const global_message_element = this.NotificationComponent.get_global_message_element_reference();
        if (global_message_element) {
            plate_element.appendChild(global_message_element);
        }

        const current_state = this.getState();
        const rulefile_title = current_state?.ruleFileContent?.metadata?.title || t('unknown_rulefile');

        plate_element.appendChild(this.Helpers.create_element('h1', { text_content: t('edit_rulefile_title') }));
        plate_element.appendChild(this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: t('edit_rulefile_intro', { rulefileTitle: rulefile_title }) }));

        const button_group = this.Helpers.create_element('div', { class_name: 'button-group', style: 'flex-direction: column; align-items: flex-start; gap: 1rem;' });
        
        const edit_reqs_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'button' },
            html_content: `<span>${t('edit_rulefile_requirements_button')}</span>` + this.Helpers.get_icon_svg('list')
        });
        edit_reqs_button.addEventListener('click', () => this.router('rulefile_requirements'));
        
        const view_sections_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'button' },
            html_content: `<span>${t('view_rulefile_sections_button') || 'Visa regelfilsektioner'}</span>` + this.Helpers.get_icon_svg('view_list')
        });
        view_sections_button.addEventListener('click', () => this.router('rulefile_sections', { section: 'general' }));
        
        const edit_meta_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-secondary'],
            attributes: { type: 'button' },
            html_content: `<span>${t('edit_rulefile_metadata_button')}</span>` + this.Helpers.get_icon_svg('edit')
        });
        edit_meta_button.addEventListener('click', () => this.router('rulefile_metadata'));

        button_group.append(edit_reqs_button, view_sections_button, edit_meta_button);
        plate_element.appendChild(button_group);

        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: 'margin-top: 3rem;' });

        const back_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            html_content: `<span>${t('back_to_start_view')}</span>` + this.Helpers.get_icon_svg('arrow_back')
        });
        back_button.addEventListener('click', () => this.router('upload'));
        
        actions_div.append(back_button);
        plate_element.appendChild(actions_div);

        this.root.appendChild(plate_element);
    },

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
    }
};
