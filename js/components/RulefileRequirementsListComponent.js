// js/components/RulefileRequirementsListComponent.js
import { RequirementListToolbarComponent } from './RequirementListToolbarComponent.js';

export const RulefileRequirementsListComponent = {
    CSS_PATH: 'css/components/rulefile_requirements_list_component.css',
    SORT_OPTIONS: [
        { value: 'ref_asc', textKey: 'sort_option_ref_asc_natural' },
        { value: 'ref_desc', textKey: 'sort_option_ref_desc_natural' },
        { value: 'title_asc', textKey: 'sort_option_title_asc' },
        { value: 'title_desc', textKey: 'sort_option_title_desc' }
    ],

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.subscribe = deps.subscribe;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        
        this.global_message_element_ref = null;
        if (this.NotificationComponent.get_global_message_element_reference) {
            this.global_message_element_ref = this.NotificationComponent.get_global_message_element_reference();
        }

        this.content_div_for_delegation = null;
        this.toolbar_component_instance = RequirementListToolbarComponent;
        this.is_dom_initialized = false;
        this.plate_element_ref = null;
        this.unsubscribe_from_store_function = null;
        this.results_summary_element = null;

        // Bind methods
        this.handle_list_click = this.handle_list_click.bind(this);
        this.handle_list_keydown = this.handle_list_keydown.bind(this);
        this.handle_toolbar_change = this.handle_toolbar_change.bind(this);
        this.handle_state_update = this.handle_state_update.bind(this);
        
        await this.Helpers.load_css(this.CSS_PATH).catch(e => console.warn(e));
        
        if (typeof this.subscribe === 'function') {
            this.unsubscribe_from_store_function = this.subscribe(this.handle_state_update);
        }
        
        this.is_dom_initialized = false;
    },

    handle_list_click(event) {
        const action_element = event.target.closest('[data-action]');
        if (!action_element) return;

        if (action_element.tagName === 'A') {
            event.preventDefault();
        }

        const requirementId = action_element.dataset.requirementId;
        const action = action_element.dataset.action;

        switch (action) {
            case 'view-req':
                this.router('rulefile_view_requirement', { id: requirementId });
                break;
            case 'edit-req':
                this.router('rulefile_edit_requirement', { id: requirementId });
                break;
            case 'delete-req':
                this.router('confirm_delete', { type: 'requirement', reqId: requirementId });
                break;
            case 'add-req':
                this.router('rulefile_add_requirement', { id: 'new' });
                break;
        }
    },

    handle_list_keydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            const action_element = event.target.closest('[data-action]');
            if (!action_element) return;

            event.preventDefault();
            this.handle_list_click(event);
        }
    },

    handle_toolbar_change(new_toolbar_state) {
        console.log('[RulefileRequirementsListComponent] toolbar change received:', JSON.stringify(new_toolbar_state));
        const current_state_snapshot = this.getState();
        console.log('[RulefileRequirementsListComponent] current state snapshot filter:', JSON.stringify(current_state_snapshot.uiSettings?.requirementListFilter));
        const existing_status_state = current_state_snapshot.uiSettings?.requirementListFilter?.status || {
            passed: true,
            failed: true,
            partially_audited: true,
            not_audited: true,
            updated: true
        };

        const payload = {
            ...new_toolbar_state,
            status: new_toolbar_state.status && Object.keys(new_toolbar_state.status).length > 0
                ? new_toolbar_state.status
                : existing_status_state
        };

        this.dispatch({
            type: this.StoreActionTypes.SET_UI_FILTER_SETTINGS,
            payload
        });
        console.log('[RulefileRequirementsListComponent] dispatched payload:', JSON.stringify(payload));
        // Note: render is triggered by subscription, but explicit render call in old code existed.
        // The subscription handler calls _populate_dynamic_content, so we might not need full render.
        // But original code called render(), so let's call it to be safe, though it might be redundant with subscription.
        this.render();
    },

    handle_state_update() {
        if (this.is_dom_initialized) {
            this._populate_dynamic_content();
        }
    },

    async _initialRender() {
        const t = this.Translation.t;
        this.root.innerHTML = '';
        this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate' });
        
        if (this.global_message_element_ref) {
            this.plate_element_ref.appendChild(this.global_message_element_ref);
        }

        // Skapa header-container med H1 och knapp på samma rad
        const header_container = this.Helpers.create_element('div', { class_name: 'page-header-container', style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;' });
        
        const h1_element = this.Helpers.create_element('h1', { id: 'rulefile-list-h1', attributes: { tabindex: '-1' }, text_content: t('rulefile_edit_requirements_title') });
        const add_requirement_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            html_content: `<span>${t('add_new_requirement_button')}</span>` + this.Helpers.get_icon_svg('add'),
            attributes: { 'data-action': 'add-req', 'aria-label': t('add_new_requirement_button') }
        });
        
        header_container.appendChild(h1_element);
        header_container.appendChild(add_requirement_button);
        this.plate_element_ref.appendChild(header_container);
        
        this.plate_element_ref.appendChild(this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: t('rulefile_edit_requirements_intro') }));

        const toolbar_container_element = this.Helpers.create_element('div', { id: 'rulefile-list-toolbar-container' });
        this.plate_element_ref.appendChild(toolbar_container_element);

        this.results_summary_element = this.Helpers.create_element('p', { id: 'rulefile-list-results-summary', class_name: 'results-summary' });
        this.plate_element_ref.appendChild(this.results_summary_element);
        
        let current_state_for_init = this.getState();
        let current_ui_settings = current_state_for_init.uiSettings?.requirementListFilter || {};
        
        const valid_sort_values = this.SORT_OPTIONS.map(opt => opt.value);
        if (!current_ui_settings.sortBy || !valid_sort_values.includes(current_ui_settings.sortBy)) {
            this.dispatch({
                type: this.StoreActionTypes.SET_UI_FILTER_SETTINGS,
                payload: { sortBy: 'ref_asc' }
            });
            current_state_for_init = this.getState();
            current_ui_settings = current_state_for_init.uiSettings.requirementListFilter;
        }

        const default_status_state = current_ui_settings.status || {
            passed: true,
            failed: true,
            partially_audited: true,
            not_audited: true,
            updated: true
        };

        const initial_toolbar_state = {
            searchText: current_ui_settings.searchText || '',
            sortBy: current_ui_settings.sortBy,
            status: { ...default_status_state }
        };

        await this.toolbar_component_instance.init({
            root: toolbar_container_element,
            deps: {
                on_change: this.handle_toolbar_change,
                initial_state: initial_toolbar_state,
                Translation: { t: t },
                Helpers: { create_element: this.Helpers.create_element, load_css: this.Helpers.load_css },
                config: { showStatusFilter: false, sortOptions: this.SORT_OPTIONS }
            }
        });

        this.content_div_for_delegation = this.Helpers.create_element('div', { class_name: 'requirements-list-content' });
        this.plate_element_ref.appendChild(this.content_div_for_delegation);
        
        // Flytta event delegation till plate_element_ref så den fångar alla klick inklusive header-knappen
        this.plate_element_ref.addEventListener('click', this.handle_list_click);
        // Add keyboard support for accessibility
        this.plate_element_ref.addEventListener('keydown', this.handle_list_keydown);

        const bottom_actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: 'margin-top: 2rem; justify-content: flex-start;' });
        const return_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            html_content: `<span>${t('back_to_edit_options')}</span>` + this.Helpers.get_icon_svg('arrow_back')
        });
        return_button.addEventListener('click', () => this.router('edit_rulefile_main'));
        bottom_actions_div.appendChild(return_button);
        this.plate_element_ref.appendChild(bottom_actions_div);

        this.root.appendChild(this.plate_element_ref);
        this.is_dom_initialized = true;
    },

    extractSearchableText(value) {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) {
            return value.map(item => this.extractSearchableText(item)).join(' ');
        }
        if (typeof value === 'object') {
            const candidateKeys = ['text', 'value', 'label', 'description', 'content'];
            for (const key of candidateKeys) {
                if (value[key]) {
                    return this.extractSearchableText(value[key]);
                }
            }
            return Object.values(value).map(item => this.extractSearchableText(item)).join(' ');
        }
        return String(value);
    },

    _populate_dynamic_content(filter_settings_override = null) {
        console.log('[RulefileRequirementsListComponent] populate list start. Override:', JSON.stringify(filter_settings_override));
        const t = this.Translation.t;
        const current_global_state = this.getState();
        console.log('[RulefileRequirementsListComponent] current state filter:', JSON.stringify(current_global_state.uiSettings?.requirementListFilter));

        if (this.root && this.plate_element_ref) {
            const siblings = Array.from(this.root.children);
            const removed = siblings.filter(child => child !== this.plate_element_ref);
            if (removed.length > 0) {
                console.warn('[RulefileRequirementsListComponent] Removing sibling content plates:', removed.length);
                removed.forEach(node => node.remove());
            }
        }

        if (!current_global_state || !current_global_state.ruleFileContent) {
            const error_p = this.Helpers.create_element('p', { text_content: t('error_no_rulefile_loaded_for_metadata') });
            this.content_div_for_delegation.appendChild(error_p);
            return;
        }

        if (this.plate_element_ref) {
            Array.from(this.plate_element_ref.querySelectorAll('.item-list')).forEach(listElement => {
                if (!this.content_div_for_delegation.contains(listElement)) {
                    listElement.remove();
                }
            });
        }

        const filter_settings = filter_settings_override || current_global_state.uiSettings?.requirementListFilter;

        if (this.toolbar_component_instance) {
             this.toolbar_component_instance.render(filter_settings);
        }

        const search_term = (filter_settings.searchText || '').toLowerCase();
        
        const all_requirements = Object.values(current_global_state.ruleFileContent.requirements);

        const filtered_requirements = all_requirements.filter(req => {
            if (!search_term) return true;

            const normalized_content = this.extractSearchableText([
                req.title,
                req.expectedObservation,
                req.instructions,
                req.tips,
                req.exceptions,
                req.commonErrors,
                req.standardReference?.text,
                req.standardReference?.description,
                req.metadata?.mainCategory?.text,
                req.metadata?.subCategory?.text,
                req.examples,
                req.classifications,
                req.contentType,
                req.checks
            ]).toLowerCase();

            return normalized_content.includes(search_term);
        });
        console.log('[RulefileRequirementsListComponent] filtered count:', filtered_requirements.length, 'of', all_requirements.length);
        if (this.results_summary_element) {
            this.results_summary_element.textContent = t('rulefile_requirements_summary', {
                filteredCount: filtered_requirements.length,
                totalCount: all_requirements.length
            });
        }

        const sorted_requirements = [...filtered_requirements];
        const sort_function = {
            'ref_asc': (a, b) => this.Helpers.natural_sort(a.standardReference?.text || 'Z', b.standardReference?.text || 'Z'),
            'ref_desc': (a, b) => this.Helpers.natural_sort(b.standardReference?.text || 'Z', a.standardReference?.text || 'Z'),
            'title_asc': (a, b) => (a.title || '').localeCompare(b.title || ''),
            'title_desc': (a, b) => (b.title || '').localeCompare(a.title || '')
        };
        sorted_requirements.sort(sort_function[filter_settings.sortBy] || sort_function['ref_asc']);

        this.content_div_for_delegation.innerHTML = '';
        if (sorted_requirements.length === 0) {
            this.content_div_for_delegation.appendChild(this.Helpers.create_element('p', { text_content: t('no_requirements_match_filter') }));
        } else {
            const req_ul = this.Helpers.create_element('ul', { class_name: 'item-list', style: 'list-style: none; padding: 0;' });
            sorted_requirements.forEach(req => req_ul.appendChild(this._create_requirement_list_item(req)));
            this.content_div_for_delegation.appendChild(req_ul);
        }
        
        // Ensure focus logic remains
        const focusSelector = sessionStorage.getItem('focusAfterLoad');
        if (focusSelector) {
            sessionStorage.removeItem('focusAfterLoad');
            const elementToFocus = this.plate_element_ref.querySelector(focusSelector);
            if (elementToFocus) {
                elementToFocus.focus();
                window.customFocusApplied = true;
            }
        } else if (sessionStorage.getItem('focusOnH1AfterLoad')) {
            sessionStorage.removeItem('focusOnH1AfterLoad');
            this.plate_element_ref.querySelector('#rulefile-list-h1')?.focus();
        }
    },
    
    _create_requirement_list_item(req) {
        const t = this.Translation.t;
        const li = this.Helpers.create_element('li', { class_name: 'item-list-item', style: 'flex-direction: row; justify-content: space-between; align-items: center;' });

        const text_div = this.Helpers.create_element('div', { style: 'margin-right: 1rem; flex-grow: 1; min-width: 0;' });
        
        // Skapa H3-container för titel-knappen
        const title_container = this.Helpers.create_element('h3', { 
            style: 'font-size: 1.1rem; margin-bottom: 0.25rem; margin: 0; padding: 0;'
        });
        
        // Skapa klickbar titel-knapp
        const title_button = this.Helpers.create_element('a', {
            class_name: 'requirement-list-title-button',
            text_content: req.title,
            attributes: { 
                href: '#',
                'data-action': 'view-req',
                'data-requirement-id': req.key,
                'aria-label': `${t('view_prefix')} ${req.title}`
            }
        });
        
        title_container.appendChild(title_button);
        text_div.appendChild(title_container);
        text_div.appendChild(this.Helpers.create_element('p', { style: 'font-size: 0.9rem; color: var(--text-color-muted); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;', text_content: req.standardReference?.text || '' }));

        const button_group = this.Helpers.create_element('div', { class_name: 'sample-actions-main', style: 'flex-shrink: 0;' });

        const view_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'button-small'],
            attributes: { 'data-action': 'view-req', 'data-requirement-id': req.key, 'aria-label': `${t('view_prefix')} ${req.title}` },
            html_content: `<span>${t('view_prefix')}</span>` + this.Helpers.get_icon_svg('visibility', [], 16)
        });

        const edit_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-secondary', 'button-small'],
            attributes: { 'data-action': 'edit-req', 'data-requirement-id': req.key, 'aria-label': `${t('edit_prefix')} ${req.title}` },
            html_content: `<span>${t('edit_prefix')}</span>` + this.Helpers.get_icon_svg('edit', [], 16)
        });
        
        const delete_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-danger', 'button-small'],
            attributes: { 'data-action': 'delete-req', 'data-requirement-id': req.key, 'aria-label': `${t('delete_prefix')} ${req.title}` },
            html_content: `<span>${t('delete_prefix')}</span>` + this.Helpers.get_icon_svg('delete', [], 16)
        });

        button_group.append(view_button, edit_button, delete_button);
        li.append(text_div, button_group);
        return li;
    },

    async render() {
        if (!this.root) return;
        
        if (!this.is_dom_initialized) {
            await this._initialRender();
        }
        this._populate_dynamic_content();
    },

    destroy() {
        if (typeof this.unsubscribe_from_store_function === 'function') {
            this.unsubscribe_from_store_function();
            this.unsubscribe_from_store_function = null;
        }

        if (this.plate_element_ref) {
            this.plate_element_ref.removeEventListener('click', this.handle_list_click);
            this.plate_element_ref.removeEventListener('keydown', this.handle_list_keydown);
        }
        this.content_div_for_delegation = null;
        if (this.toolbar_component_instance) {
            this.toolbar_component_instance.destroy();
            this.toolbar_component_instance = null;
        }
        this.is_dom_initialized = false;
        this.plate_element_ref = null;
        this.root = null;
        this.deps = null;
    }
};
