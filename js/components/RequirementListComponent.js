import { RequirementListToolbarComponent } from './RequirementListToolbarComponent.js';
import { ProgressBarComponent } from './ProgressBarComponent.js';
import "../../css/components/requirement_list_component.css";

export const RequirementListComponent = {
    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.params = deps.params;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.AuditLogic = deps.AuditLogic;

        this.RETURN_FOCUS_SESSION_KEY = 'gv_return_focus_requirement_list_v1';

        this.global_message_element_ref = null;
        this.content_div_for_delegation = null;
        this.toolbar_component_instance = null;
        this.is_dom_initialized = false;
        this.plate_element_ref = null;
        this.results_summary_element_ref = null;

        this.SORT_OPTIONS = [
            { value: 'ref_asc', textKey: 'sort_option_ref_asc_natural', defaultValue: 'Reference (Ascending)' },
            { value: 'ref_desc', textKey: 'sort_option_ref_desc_natural', defaultValue: 'Reference (Descending)' },
            { value: 'title_asc', textKey: 'sort_option_title_asc', defaultValue: 'Title (A-Z)' },
            { value: 'title_desc', textKey: 'sort_option_title_desc', defaultValue: 'Title (Z-A)' },
            { value: 'updated_first', textKey: 'sort_option_updated_first', defaultValue: 'Updated First' }
        ];

        if (this.NotificationComponent?.get_global_message_element_reference) {
            this.global_message_element_ref = this.NotificationComponent.get_global_message_element_reference();
        }

        // Bind methods
        this.handle_requirement_list_click = this.handle_requirement_list_click.bind(this);
        this.handle_requirement_list_keydown = this.handle_requirement_list_keydown.bind(this);
        this.handle_toolbar_change = this.handle_toolbar_change.bind(this);

        this.is_dom_initialized = false;
    },

    get_t_internally() {
        return this.Translation?.t || ((key) => `**${key}**`);
    },

    handle_requirement_list_click(event) {
        const target_link = event.target.closest('a.list-title-link[data-requirement-id]');
        if (target_link && this.router && this.params && this.params.sampleId) {
            event.preventDefault(); 
            const requirement_id = target_link.dataset.requirementId;
            this.router('requirement_audit', { sampleId: this.params.sampleId, requirementId: requirement_id });
        }
    },

    handle_requirement_list_keydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            const target_link = event.target.closest('a.list-title-link[data-requirement-id]');
            if (target_link && this.router && this.params && this.params.sampleId) {
                event.preventDefault();
                const requirement_id = target_link.dataset.requirementId;
                this.router('requirement_audit', { sampleId: this.params.sampleId, requirementId: requirement_id });
            }
        }
    },

    create_navigation_bar(is_bottom = false) {
        const t = this.get_t_internally();
        if (!this.Helpers.create_element || !t || !this.getState) return null;

        const nav_bar = this.Helpers.create_element('div', { class_name: 'requirements-navigation-bar' });
        if (is_bottom) nav_bar.classList.add('bottom');

        const current_global_state = this.getState();
        let target_view = (current_global_state && current_global_state.auditStatus !== 'not_started') ? 'audit_overview' : 'sample_management';
        let back_button_text_key = (target_view === 'audit_overview') ? 'back_to_audit_overview' : 'back_to_sample_management';

        const back_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            html_content: `<span>${t(back_button_text_key)}</span>` + (this.Helpers.get_icon_svg('arrow_back', ['currentColor'], 18) || '')
        });
        back_button.addEventListener('click', () => this.router(target_view));
        nav_bar.appendChild(back_button);
        return nav_bar;
    },
    
    handle_toolbar_change(new_toolbar_state) {
        this.dispatch({
            type: this.StoreActionTypes.SET_UI_FILTER_SETTINGS,
            payload: new_toolbar_state 
        });
    },

    async _initialRender() {
        this.root.innerHTML = '';
        this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate requirement-list-plate' });
        
        if (this.global_message_element_ref) {
            this.plate_element_ref.appendChild(this.global_message_element_ref);
        }

        const top_nav_bar = this.create_navigation_bar();
        if (top_nav_bar) this.plate_element_ref.appendChild(top_nav_bar);
        
        this.plate_element_ref.appendChild(this.Helpers.create_element('div', { class_name: 'requirement-list-header' }));

        const toolbar_container_element = this.Helpers.create_element('div', { id: 'requirement-list-toolbar-container' });
        this.plate_element_ref.appendChild(toolbar_container_element);
        
        this.toolbar_component_instance = RequirementListToolbarComponent;
        
        const current_state_for_init = this.getState();
        const current_ui_settings = current_state_for_init.uiSettings?.requirementListFilter || {
            searchText: '',
            sortBy: null,
            status: { passed: true, failed: true, partially_audited: true, not_audited: true, updated: true }
        };

        const initial_toolbar_state = {
            searchText: current_ui_settings.searchText || '',
            sortBy: current_ui_settings.sortBy || null,
            status: current_ui_settings.status || { passed: true, failed: true, partially_audited: true, not_audited: true, updated: true }
        };

        await this.toolbar_component_instance.init({
            root: toolbar_container_element,
            deps: {
                on_change: this.handle_toolbar_change,
                initial_state: initial_toolbar_state,
                Translation: this.Translation,
                Helpers: this.Helpers,
                config: { sortOptions: this.SORT_OPTIONS }
            }
        });

        this.results_summary_element_ref = this.Helpers.create_element('p', {
            class_name: 'results-summary',
            id: 'requirement-list-results-summary'
        });
        this.plate_element_ref.appendChild(this.results_summary_element_ref);

        this.content_div_for_delegation = this.Helpers.create_element('div', { class_name: 'requirements-list-content' });
        this.content_div_for_delegation.addEventListener('click', this.handle_requirement_list_click);
        this.content_div_for_delegation.addEventListener('keydown', this.handle_requirement_list_keydown);
        this.plate_element_ref.appendChild(this.content_div_for_delegation);

        const bottom_nav_bar = this.create_navigation_bar(true);
        if (bottom_nav_bar) this.plate_element_ref.appendChild(bottom_nav_bar);

        this.root.appendChild(this.plate_element_ref);
        this.is_dom_initialized = true;
    },

    get_status_icon(status) {
        switch (status) {
            case 'not_audited':
                return '○'; 
            case 'partially_audited':
                return '◐'; 
            case 'passed':
                return '✓'; 
            case 'failed':
                return '✗'; 
            case 'updated':
                return '↻'; 
            default:
                return '○'; 
        }
    },

    _populate_dynamic_content() {
        const t = this.get_t_internally();
        const current_global_state = this.getState();
        
        // Update nav buttons
        const top_nav_bar = this.plate_element_ref.querySelector('.requirements-navigation-bar:not(.bottom)');
        if (top_nav_bar) {
            top_nav_bar.innerHTML = '';
            let target_view = (current_global_state && current_global_state.auditStatus !== 'not_started') ? 'audit_overview' : 'sample_management';
            let back_button_text_key = (target_view === 'audit_overview') ? 'back_to_audit_overview' : 'back_to_sample_management';
            const back_button = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                html_content: `<span>${t(back_button_text_key)}</span>` + (this.Helpers.get_icon_svg('arrow_back', ['currentColor'], 18) || '')
            });
            back_button.addEventListener('click', () => this.router(target_view));
            top_nav_bar.appendChild(back_button);
        }
        
        const bottom_nav_bar = this.plate_element_ref.querySelector('.requirements-navigation-bar.bottom');
        if (bottom_nav_bar) {
            bottom_nav_bar.innerHTML = '';
            let target_view = (current_global_state && current_global_state.auditStatus !== 'not_started') ? 'audit_overview' : 'sample_management';
            let back_button_text_key = (target_view === 'audit_overview') ? 'back_to_audit_overview' : 'back_to_sample_management';
            const back_button = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                html_content: `<span>${t(back_button_text_key)}</span>` + (this.Helpers.get_icon_svg('arrow_back', ['currentColor'], 18) || '')
            });
            back_button.addEventListener('click', () => this.router(target_view));
            bottom_nav_bar.appendChild(back_button);
        }
        
        let filter_settings = current_global_state.uiSettings?.requirementListFilter;
        const current_sample_object = current_global_state.samples.find(s => s.id === this.params.sampleId);

        // Header Logic
        const header_div = this.plate_element_ref.querySelector('.requirement-list-header');
        header_div.innerHTML = '';
        
        const actor_name = current_global_state.auditMetadata?.actorName || '';
        const sample_description = current_sample_object.description || t('undefined_description');
        const title_text = (actor_name.trim() !== '') ? `${actor_name.trim()}: ${sample_description}` : sample_description;

        const h1 = this.Helpers.create_element('h1');
        if (current_sample_object.url) {
            h1.appendChild(this.Helpers.create_element('a', {
                href: this.Helpers.add_protocol_if_missing(current_sample_object.url),
                text_content: title_text,
                attributes: { target: '_blank', rel: 'noopener noreferrer' }
            }));
        } else {
            h1.textContent = title_text;
        }
        header_div.appendChild(h1);
        
        const sample_categories_map = new Map();
        (current_global_state.ruleFileContent.metadata.samples?.sampleCategories || []).forEach(cat => {
            sample_categories_map.set(cat.id, cat.text);
        });
        const category_text = sample_categories_map.get(current_sample_object.sampleCategory) || current_sample_object.sampleCategory;
        const type_info_string = `${current_sample_object.sampleType || ''} (${category_text || ''})`;
        
        const sample_type_p = this.Helpers.create_element('p', { class_name: 'sample-info-display sample-page-type' });
        const strong_element = this.Helpers.create_element('strong', { text_content: t('page_type') });
        sample_type_p.appendChild(strong_element);
        sample_type_p.appendChild(document.createTextNode(': '));
        sample_type_p.appendChild(document.createTextNode(this.Helpers.escape_html(type_info_string)));
        header_div.appendChild(sample_type_p);
        
        const all_relevant_requirements = this.AuditLogic.get_relevant_requirements_for_sample(current_global_state.ruleFileContent, current_sample_object);
        const total_relevant_requirements = all_relevant_requirements.length;
        const audited_requirements_count = all_relevant_requirements.filter(req => {
            const status = this.AuditLogic.calculate_requirement_status(req, (current_sample_object.requirementResults || {})[req.key]);
            return status === 'passed' || status === 'failed';
        }).length;
        
        const sample_audit_status_p = this.Helpers.create_element('p', { class_name: 'sample-info-display sample-audit-progress' });
        const strong_element2 = this.Helpers.create_element('strong', { text_content: t('requirements_audited_for_sample') });
        sample_audit_status_p.appendChild(strong_element2);
        sample_audit_status_p.appendChild(document.createTextNode(': '));
        sample_audit_status_p.appendChild(document.createTextNode(`${audited_requirements_count}/${total_relevant_requirements}`));
        header_div.appendChild(sample_audit_status_p);

        if (ProgressBarComponent) {
            header_div.appendChild(ProgressBarComponent.create(audited_requirements_count, total_relevant_requirements, {}));
        }

        // Automatisk val av sortering första gången: om några krav har referenstext, välj ref_asc, annars title_asc
        let effective_filter_settings = filter_settings || {};
        if (!effective_filter_settings.sortBy || effective_filter_settings.sortBy === 'default') {
            const has_any_reference = all_relevant_requirements.some(req => {
                const ref = req.standardReference?.text;
                return ref && typeof ref === 'string' && ref.trim() !== '';
            });
            const auto_sort_by = has_any_reference ? 'ref_asc' : 'title_asc';
            
            // Uppdatera state med automatiskt vald sortering
            this.dispatch({
                type: this.StoreActionTypes.SET_UI_FILTER_SETTINGS,
                payload: { ...effective_filter_settings, sortBy: auto_sort_by }
            });
            
            // Uppdatera effective_filter_settings för att använda det nya värdet
            effective_filter_settings = { ...effective_filter_settings, sortBy: auto_sort_by };
            // Uppdatera filter_settings också för toolbar
            filter_settings = effective_filter_settings;
        }
        
        // Render toolbar med korrekt filter_settings
        if (this.toolbar_component_instance) {
             this.toolbar_component_instance.render(filter_settings);
        }

        const search_term = (effective_filter_settings.searchText || '').toLowerCase();
        const active_status_filters = Object.keys(effective_filter_settings.status || {}).filter(key => effective_filter_settings.status[key]);

        const filtered_requirements = all_relevant_requirements.filter(req => {
            const result = (current_sample_object.requirementResults || {})[req.key];
            const display_status = result?.needsReview ? 'updated' : this.AuditLogic.calculate_requirement_status(req, result);
            if (!active_status_filters.includes(display_status)) return false;

            if (search_term) {
                // Build searchable content array
                const searchable_fields = [req.title, req.standardReference?.text];
                
                // Support both old format (direct fields) and new format (infoBlocks)
                const has_info_blocks = req.infoBlocks && typeof req.infoBlocks === 'object';
                
                if (has_info_blocks) {
                    // New format: extract text from all infoBlocks
                    const info_blocks_texts = Object.values(req.infoBlocks)
                        .map(block => block.text)
                        .filter(Boolean);
                    searchable_fields.push(...info_blocks_texts);
                } else {
                    // Old format: use direct fields for backward compatibility
                    searchable_fields.push(
                        req.expectedObservation,
                        req.instructions,
                        req.tips,
                        req.exceptions,
                        req.commonErrors
                    );
                }
                
                const searchable_content = searchable_fields
                    .flat()
                    .filter(Boolean)
                    .map(item => (typeof item === 'object' ? item.text : String(item)))
                    .join(' ')
                    .toLowerCase();
                return searchable_content.includes(search_term);
            }
            return true;
        });
        
        if (this.results_summary_element_ref) {
            this.results_summary_element_ref.textContent = t('results_summary_template', {
                filteredCount: filtered_requirements.length,
                totalCount: all_relevant_requirements.length
            });
        }

        const sorted_requirements = [...filtered_requirements];
        const sort_function = {
            'ref_asc': (a, b) => this.Helpers.natural_sort(a.standardReference?.text || 'Z', b.standardReference?.text || 'Z'),
            'ref_desc': (a, b) => this.Helpers.natural_sort(b.standardReference?.text || 'Z', a.standardReference?.text || 'Z'),
            'title_asc': (a, b) => (a.title || '').localeCompare(b.title || ''),
            'title_desc': (a, b) => (b.title || '').localeCompare(a.title || ''),
            'updated_first': (a, b) => {
                const resA = (current_sample_object.requirementResults || {})[a.key];
                const resB = (current_sample_object.requirementResults || {})[b.key];
                const isAUpdated = resA?.needsReview === true ? 0 : 1;
                const isBUpdated = resB?.needsReview === true ? 0 : 1;
                if (isAUpdated !== isBUpdated) {
                    return isAUpdated - isBUpdated;
                }
                return this.Helpers.natural_sort(a.standardReference?.text || 'Z', b.standardReference?.text || 'Z');
            }
        };
        const effectiveSortKey = sort_function.hasOwnProperty(effective_filter_settings.sortBy) ? effective_filter_settings.sortBy : 'ref_asc';
        sorted_requirements.sort(sort_function[effectiveSortKey]);

        this.content_div_for_delegation.innerHTML = '';
        if (sorted_requirements.length === 0) {
            this.content_div_for_delegation.appendChild(this.Helpers.create_element('p', { text_content: t('no_requirements_match_filter') }));
        } else {
            const req_ul = this.Helpers.create_element('ul', { class_name: 'requirement-items-ul' });
            sorted_requirements.forEach(req => req_ul.appendChild(this.create_requirement_list_item(req, current_sample_object)));
            this.content_div_for_delegation.appendChild(req_ul);
        }
    },

    async render() {
        const current_state = this.getState ? this.getState() : null;
        if (current_state?.auditStatus === 'rulefile_editing') {
            if (this.is_dom_initialized && this.plate_element_ref?.parentNode) {
                this.plate_element_ref.parentNode.removeChild(this.plate_element_ref);
            }
            this.destroy();
            return;
        }

        if (!this.is_dom_initialized) {
            await this._initialRender();
        }
        this._populate_dynamic_content();

        // Återställ fokus när användaren kommer tillbaka från "Granska krav" till listan
        this._apply_return_focus_if_needed();
    },

    _apply_return_focus_if_needed() {
        if (!this.content_div_for_delegation) return;
        if (!window.sessionStorage || !this.RETURN_FOCUS_SESSION_KEY) return;

        let raw = null;
        try {
            raw = window.sessionStorage.getItem(this.RETURN_FOCUS_SESSION_KEY);
        } catch (e) {
            return;
        }
        if (!raw) return;

        let focus_instruction = null;
        try {
            focus_instruction = JSON.parse(raw);
        } catch (e) {
            // Ogiltig data, rensa för att undvika loop.
            try { window.sessionStorage.removeItem(this.RETURN_FOCUS_SESSION_KEY); } catch (err) {}
            return;
        }

        const current_sample_id = this.params?.sampleId || null;
        const requirement_id = focus_instruction?.requirementId || null;
        const sample_id = focus_instruction?.sampleId || null;

        // Rensa alltid instruktionen (one-shot), oavsett utfall.
        try { window.sessionStorage.removeItem(this.RETURN_FOCUS_SESSION_KEY); } catch (e) {}

        if (!current_sample_id || !requirement_id || !sample_id) return;
        if (String(sample_id) !== String(current_sample_id)) return;

        const target_link = this.content_div_for_delegation.querySelector(
            `a.list-title-link[data-requirement-id="${CSS.escape(String(requirement_id))}"]`
        );
        if (!target_link) return;

        // Hindra generella "fokusera <h1>" i main.js från att skriva över länkfokus.
        window.customFocusApplied = true;

        // Scrolla med offset för fixed headers och sätt fokus utan att scrolla om.
        const top_action_bar = document.getElementById('global-action-bar-top');
        const top_bar_height = top_action_bar ? top_action_bar.offsetHeight : 0;

        const element_rect = target_link.getBoundingClientRect();
        const absolute_element_top = element_rect.top + window.pageYOffset;
        const scroll_position = absolute_element_top - top_bar_height;

        window.scrollTo({ top: scroll_position, behavior: 'smooth' });

        // Vänta lite så att smooth-scroll hinner starta innan fokus sätts.
        setTimeout(() => {
            try {
                target_link.focus({ preventScroll: true });
            } catch (e) {
                target_link.focus();
            }
        }, 150);
    },

    create_requirement_list_item(req, sample) {
        const t = this.get_t_internally();
        const req_result = (sample.requirementResults || {})[req.key];
        const display_status = req_result?.needsReview ? 'updated' : this.AuditLogic.calculate_requirement_status(req, req_result);

        const li = this.Helpers.create_element('li', { class_name: 'requirement-item compact-twoline' });
        
        const title_row_div = this.Helpers.create_element('div', { class_name: 'requirement-title-container' });
        const title_link = this.Helpers.create_element('a', {
            class_name: 'list-title-link',
            text_content: req.title,
            attributes: { 
                'data-requirement-id': req.key,
                'href': '#'
            }
        });
        
        title_row_div.appendChild(title_link);
        li.appendChild(title_row_div);

        const details_row_div = this.Helpers.create_element('div', { class_name: 'requirement-details-row' });
        const status_text = t(display_status === 'updated' ? 'status_updated' : `audit_status_${display_status}`);
        
        const status_span = this.Helpers.create_element('span', { 
            class_name: display_status === 'updated' ? 'status-text-updated' : '',
            text_content: status_text
        });
        
        const status_icon = this.Helpers.create_element('span', {
            class_name: `status-icon status-icon-${display_status.replace('_', '-')}`,
            text_content: this.get_status_icon(display_status),
            attributes: { 'aria-hidden': 'true' }
        });
        
        details_row_div.appendChild(status_icon);
        details_row_div.appendChild(status_span);

        const total_checks = req.checks?.length || 0;
        const audited_checks = req_result?.checkResults ? Object.values(req_result.checkResults).filter(res => res.status === 'passed' || res.status === 'failed').length : 0;
        details_row_div.appendChild(this.Helpers.create_element('span', { class_name: 'requirement-checks-info', text_content: `(${audited_checks}/${total_checks} ${t('checks_short')})` }));
        
        if (req.standardReference?.text) {
            details_row_div.appendChild(req.standardReference.url 
                ? this.Helpers.create_element('a', { class_name: 'list-reference-link', text_content: req.standardReference.text, attributes: { href: req.standardReference.url, target: '_blank', rel: 'noopener noreferrer' } })
                : this.Helpers.create_element('span', { class_name: 'list-reference-text', text_content: req.standardReference.text })
            );
        }
        
        li.appendChild(details_row_div);
        return li;
    },

    destroy() {
        if (this.content_div_for_delegation) {
            this.content_div_for_delegation.removeEventListener('click', this.handle_requirement_list_click);
            this.content_div_for_delegation.removeEventListener('keydown', this.handle_requirement_list_keydown);
            this.content_div_for_delegation = null;
        }
        if (this.toolbar_component_instance) {
            this.toolbar_component_instance.destroy();
            this.toolbar_component_instance = null;
        }

        if (this.plate_element_ref?.parentNode) {
            this.plate_element_ref.parentNode.removeChild(this.plate_element_ref);
        }
        this.is_dom_initialized = false;
        this.plate_element_ref = null;
        this.results_summary_element_ref = null;
        this.root = null;
        this.deps = null;
    }
};
