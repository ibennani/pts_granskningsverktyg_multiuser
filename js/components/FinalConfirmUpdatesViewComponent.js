// js/components/FinalConfirmUpdatesViewComponent.js

export const FinalConfirmUpdatesViewComponent = {
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
        
        this.plate_element_ref = null;
    },

    handle_confirm() {
        const t = this.Translation.t;
        this.dispatch({ type: this.StoreActionTypes.CONFIRM_ALL_REVIEWED_REQUIREMENTS });
        if (this.NotificationComponent) {
            this.NotificationComponent.show_global_message(t('all_updated_assessments_confirmed_toast'), 'success');
        }
        this.router('audit_overview');
    },

    handle_return_to_list() {
        this.router('confirm_updates');
    },
    
    handle_return_to_overview() {
        this.router('audit_overview');
    },

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        this.root.innerHTML = '';
        this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate' });
        this.root.appendChild(this.plate_element_ref);

        if (this.NotificationComponent?.get_global_message_element_reference) {
            const global_message_element = this.NotificationComponent.get_global_message_element_reference();
            if (global_message_element) {
                this.plate_element_ref.appendChild(global_message_element);
            }
        }

        const state = this.getState();
        const total_count = state.samples.flatMap(s => Object.values(s.requirementResults || {})).filter(r => r.needsReview === true).length;

        this.plate_element_ref.appendChild(this.Helpers.create_element('h1', { text_content: t('final_confirm_updates_title') }));
        this.plate_element_ref.appendChild(this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: t('final_confirm_updates_intro', { count: total_count }) }));
        
        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: { marginTop: '1.5rem', justifyContent: 'flex-start' } });

        const confirm_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-success'],
            text_content: t('final_confirm_updates_confirm_button')
        });
        confirm_button.addEventListener('click', () => this.handle_confirm());

        const return_list_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            text_content: t('final_confirm_updates_return_list_button')
        });
        return_list_button.addEventListener('click', () => this.handle_return_to_list());
        
        const return_overview_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-danger'],
            text_content: t('final_confirm_updates_return_overview_button')
        });
        return_overview_button.addEventListener('click', () => this.handle_return_to_overview());

        actions_div.append(confirm_button, return_list_button, return_overview_button);
        this.plate_element_ref.appendChild(actions_div);
    },

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.plate_element_ref = null;
        this.root = null;
        this.deps = null;
    }
};
