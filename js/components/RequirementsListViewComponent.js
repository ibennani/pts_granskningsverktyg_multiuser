import { RequirementsFilterComponent } from './RequirementsFilterComponent.js';
import { get_searchable_text_for_requirement as get_searchable_text_util } from '../utils/requirement_search_utils.js';
import { ProgressBarComponent } from './ProgressBarComponent.js';

export const RequirementsListViewComponent = {
    CSS_PATH_ALL: 'css/components/all_requirements_view_component.css',
    CSS_PATH_SAMPLE: 'css/components/requirement_list_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.mode = deps.mode || 'all'; // 'all' or 'sample'

        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.AuditLogic = deps.AuditLogic;
        this.params = deps.params || {};

        // Mode-specific state keys
        this.state_filter_key = this.mode === 'all' ? 'allRequirementsFilter' : 'requirementListFilter';
        this.action_type = this.mode === 'all' 
            ? this.StoreActionTypes.SET_ALL_REQUIREMENTS_FILTER_SETTINGS 
            : this.StoreActionTypes.SET_UI_FILTER_SETTINGS;

        // Mode-specific constants
        this.RETURN_FOCUS_SESSION_KEY = this.mode === 'sample' ? 'gv_return_focus_requirement_list_v1' : 'gv_return_focus_all_requirements_v1';

        // Filter component (samma som högerspalten)
        this.filter_component_instance = RequirementsFilterComponent;
        this.filter_container_element = null;
        this.filter_heading_ref = null;
        this.handle_filter_change = this.handle_filter_change.bind(this);

        // DOM references
        this.is_dom_initialized = false;
        this.plate_element_ref = null;
        this.h1_element_ref = null;
        this.header_element_ref = null;
        this.results_summary_element_ref = null;
        this.empty_message_element_ref = null;
        this.list_element_ref = null;
        this.content_div_for_delegation = null;
        this.global_message_element_ref = null;

        // Event handlers för både sample och all mode
        this.handle_requirement_list_click = this.handle_requirement_list_click.bind(this);
        this.handle_requirement_list_keydown = this.handle_requirement_list_keydown.bind(this);

        // Load CSS – båda lägena använder samma kompakta kravlistformat
        if (this.Helpers?.load_css) {
            if (this.CSS_PATH_SAMPLE) {
                await this.Helpers.load_css(this.CSS_PATH_SAMPLE).catch(() => {});
            }
            if (this.mode === 'all' && this.CSS_PATH_ALL) {
                await this.Helpers.load_css(this.CSS_PATH_ALL).catch(() => {});
            }
        }

        // Get global message element reference (only for sample mode)
        this.NotificationComponent = deps.NotificationComponent;
        if (this.mode === 'sample' && this.NotificationComponent?.get_global_message_element_reference) {
            this.global_message_element_ref = this.NotificationComponent.get_global_message_element_reference();
        }
    },

    handle_filter_change(partial) {
        if (typeof this.dispatch !== 'function' || !this.StoreActionTypes) return;
        const state = this.getState();
        const current = state.uiSettings?.[this.state_filter_key] || {};
        const merged = { ...current, ...partial };
        this.dispatch({
            type: this.action_type,
            payload: merged,
        });
    },

    handle_requirement_list_click(event) {
        const target_link = event.target.closest('a.list-title-link[data-requirement-id]');
        if (!target_link || !this.router) return;
        const requirement_id = target_link.dataset.requirementId;
        const sample_id = this.mode === 'sample' ? this.params?.sampleId : target_link.dataset.sampleId;
        if (sample_id && requirement_id) {
            event.preventDefault();
            this.router('requirement_audit', { sampleId: sample_id, requirementId: requirement_id });
        }
    },

    handle_requirement_list_keydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            const target_link = event.target.closest('a.list-title-link[data-requirement-id]');
            if (!target_link || !this.router) return;
            const requirement_id = target_link.dataset.requirementId;
            const sample_id = this.mode === 'sample' ? this.params?.sampleId : target_link.dataset.sampleId;
            if (sample_id && requirement_id) {
                event.preventDefault();
                this.router('requirement_audit', { sampleId: sample_id, requirementId: requirement_id });
            }
        }
    },

    create_navigation_bar(is_bottom = false) {
        if (this.mode !== 'sample') return null;
        const t = this.Translation.t;
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

    get_sort_options() {
        if (this.mode === 'all') {
            return [
                { value: 'ref_asc', textKey: 'sort_option_ref_asc_natural' },
                { value: 'ref_desc', textKey: 'sort_option_ref_desc_natural' },
                { value: 'title_asc', textKey: 'sort_option_title_asc' },
                { value: 'title_desc', textKey: 'sort_option_title_desc' },
                { value: 'updated_first', textKey: 'sort_option_updated_first' }
            ];
        } else {
            return [
                { value: 'ref_asc', textKey: 'sort_option_ref_asc_natural', defaultValue: 'Reference (Ascending)' },
                { value: 'ref_desc', textKey: 'sort_option_ref_desc_natural', defaultValue: 'Reference (Descending)' },
                { value: 'title_asc', textKey: 'sort_option_title_asc', defaultValue: 'Title (A-Z)' },
                { value: 'title_desc', textKey: 'sort_option_title_desc', defaultValue: 'Title (Z-A)' },
                { value: 'updated_first', textKey: 'sort_option_updated_first', defaultValue: 'Updated First' }
            ];
        }
    },

    get_requirements_entries(rule_file_content) {
        const requirements = rule_file_content?.requirements;
        if (!requirements) return [];

        if (Array.isArray(requirements)) {
            return requirements.map((req, idx) => [req?.id || String(idx), req]);
        }

        if (typeof requirements === 'object') {
            return Object.entries(requirements);
        }

        return [];
    },

    get_searchable_text_for_requirement(req) {
        return get_searchable_text_util(req, { includeInfoBlocks: true });
    },

    get_reference_string_for_sort(req) {
        if (typeof req?.standardReference?.text === 'string' && req.standardReference.text.trim() !== '') {
            return req.standardReference.text.trim();
        }
        if (typeof req?.reference === 'string' && req.reference.trim() !== '') {
            return req.reference.trim();
        }
        return '';
    },

    compare_strings_locale(a, b) {
        const a_str = (a || '').toString();
        const b_str = (b || '').toString();
        return a_str.localeCompare(b_str, 'sv', { numeric: true, sensitivity: 'base' });
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
            case 'needs_help':
                return '✗';
            case 'updated':
                return '↻';
            default:
                return '○';
        }
    },

    get_aggregated_display_status_for_requirement(req_id, req, samples) {
        const candidates = new Set([String(req_id)]);
        if (req?.key) candidates.add(String(req.key));
        if (req?.id) candidates.add(String(req.id));

        const matching_samples = samples.filter(sample => {
            const sample_set = sample?.id ? this.relevant_ids_by_sample.get(sample.id) : null;
            if (!sample_set) return false;
            return [...candidates].some(id => sample_set.has(id));
        });

        const req_key = req?.key || req?.id || req_id;
        let display_status = 'not_audited';

        const requirement_needs_help_fn = this.AuditLogic?.requirement_needs_help || (() => false);
        for (const sample of matching_samples) {
            const req_result = (sample.requirementResults || {})[req_key];
            if (!req_result) continue;
            if (requirement_needs_help_fn(req_result)) return 'needs_help';
            const status = req_result.needsReview ? 'updated' : this.AuditLogic.calculate_requirement_status(req, req_result);
            if (status === 'failed') return 'failed';
            if (status === 'updated') display_status = 'updated';
            if (status === 'partially_audited' && display_status !== 'updated') display_status = 'partially_audited';
            if (status === 'passed' && display_status === 'not_audited') display_status = 'passed';
        }
        return display_status;
    },

    ensure_dom_initialized() {
        if (!this.root) return false;

        if (
            this.is_dom_initialized &&
            this.plate_element_ref &&
            this.root.contains(this.plate_element_ref)
        ) {
            return true;
        }

        this.root.innerHTML = '';

        // Create plate – samma styling för båda lägena (kompakt kravlista)
        const plate_class = 'content-plate requirement-list-plate';
        this.plate_element_ref = this.Helpers.create_element('div', { class_name: plate_class });

        // Global message element (sample mode only)
        if (this.mode === 'sample' && this.global_message_element_ref) {
            this.plate_element_ref.appendChild(this.global_message_element_ref);
        }

        // Navigation bars (sample mode only)
        if (this.mode === 'sample') {
            const top_nav_bar = this.create_navigation_bar();
            if (top_nav_bar) this.plate_element_ref.appendChild(top_nav_bar);
        }

        // Header container
        if (this.mode === 'sample') {
            this.header_element_ref = this.Helpers.create_element('div', { class_name: 'requirement-list-header' });
            this.plate_element_ref.appendChild(this.header_element_ref);
        } else {
            this.h1_element_ref = this.Helpers.create_element('h1', { text_content: '' });
            this.plate_element_ref.appendChild(this.h1_element_ref);
        }

        // Filter section (samma som högerspalten)
        const filter_section_id = this.mode === 'all' ? 'all-requirements-filter-container' : 'requirement-list-filter-container';
        const filter_wrapper = this.Helpers.create_element('div', {
            id: filter_section_id,
            class_name: 'requirements-list-filter-section'
        });
        this.filter_heading_ref = this.Helpers.create_element('h2', {
            text_content: this.Translation.t('requirement_audit_sidebar_filter_heading_sample_requirements')
        });
        filter_wrapper.appendChild(this.filter_heading_ref);
        this.filter_container_element = this.Helpers.create_element('div', { class_name: 'requirement-audit-sidebar__filters-wrapper' });
        filter_wrapper.appendChild(this.filter_container_element);
        this.plate_element_ref.appendChild(filter_wrapper);

        // Results summary
        const summary_id = this.mode === 'all' ? 'all-requirements-results-summary' : 'requirement-list-results-summary';
        this.results_summary_element_ref = this.Helpers.create_element('h2', {
            class_name: 'results-summary',
            id: summary_id,
            text_content: '',
        });
        this.plate_element_ref.appendChild(this.results_summary_element_ref);

        // Empty message (all mode only)
        if (this.mode === 'all') {
            this.empty_message_element_ref = this.Helpers.create_element('p', {
                class_name: 'view-intro-text',
                text_content: '',
            });
            this.empty_message_element_ref.style.display = 'none';
            this.plate_element_ref.appendChild(this.empty_message_element_ref);
        }

        // Content container – samma struktur för båda lägena (kompakt kravlista)
        this.content_div_for_delegation = this.Helpers.create_element('div', { class_name: 'requirements-list-content' });
        this.content_div_for_delegation.addEventListener('click', this.handle_requirement_list_click);
        this.content_div_for_delegation.addEventListener('keydown', this.handle_requirement_list_keydown);
        this.plate_element_ref.appendChild(this.content_div_for_delegation);

        // Bottom navigation bar (sample mode only)
        if (this.mode === 'sample') {
            const bottom_nav_bar = this.create_navigation_bar(true);
            if (bottom_nav_bar) this.plate_element_ref.appendChild(bottom_nav_bar);
        }

        this.root.appendChild(this.plate_element_ref);
        this.is_dom_initialized = true;
        return true;
    },

    async render() {
        if (!this.root) return;
        const t = this.Translation.t;

        const state = this.getState();
        const rule_file_content = state?.ruleFileContent;
        const samples = state?.samples || [];

        if (!rule_file_content) {
            this.root.innerHTML = '';
            const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });
            const title_key = this.mode === 'all' ? 'left_menu_all_requirements' : 'requirement_list_title_suffix';
            plate.appendChild(this.Helpers.create_element('h1', { text_content: t(title_key) }));
            plate.appendChild(this.Helpers.create_element('p', { text_content: t('error_no_active_audit') }));
            this.root.appendChild(plate);
            this.is_dom_initialized = false;
            return;
        }

        // Handle sample mode specific checks
        if (this.mode === 'sample') {
            if (state?.auditStatus === 'rulefile_editing') {
                if (this.is_dom_initialized && this.plate_element_ref?.parentNode) {
                    this.plate_element_ref.parentNode.removeChild(this.plate_element_ref);
                }
                this.destroy();
                return;
            }

            if (!this.params?.sampleId) {
                this.root.innerHTML = '';
                const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });
                plate.appendChild(this.Helpers.create_element('h1', { text_content: t('requirement_list_title_suffix') }));
                plate.appendChild(this.Helpers.create_element('p', { text_content: t('error_no_sample_selected') || 'No sample selected' }));
                this.root.appendChild(plate);
                this.is_dom_initialized = false;
                return;
            }
        }

        if (!this.ensure_dom_initialized()) return;

        // Get requirements based on mode
        let entries = [];
        let all_relevant_requirements = [];
        let current_sample_object = null;

        if (this.mode === 'all') {
            entries = this.get_requirements_entries(rule_file_content);

            // Only show requirements that are relevant for at least one sample
            const can_use_audit_logic = Boolean(
                this.AuditLogic &&
                typeof this.AuditLogic.get_relevant_requirements_for_sample === 'function' &&
                rule_file_content
            );

            const relevant_ids_by_sample = new Map();
            samples.forEach(sample => {
                const set_for_sample = new Set();

                if (can_use_audit_logic) {
                    const relevant_reqs = this.AuditLogic.get_relevant_requirements_for_sample(rule_file_content, sample);
                    (relevant_reqs || []).forEach(req => {
                        const req_id = req?.key || req?.id;
                        if (req_id) set_for_sample.add(String(req_id));
                    });
                } else {
                    const req_results = sample?.requirementResults;
                    if (req_results && typeof req_results === 'object') {
                        Object.keys(req_results).forEach(req_id => set_for_sample.add(String(req_id)));
                    }
                }

                if (sample?.id) {
                    relevant_ids_by_sample.set(sample.id, set_for_sample);
                }
            });

            const requirement_ids_in_samples = new Set();
            relevant_ids_by_sample.forEach(set_for_sample => {
                set_for_sample.forEach(req_id => requirement_ids_in_samples.add(req_id));
            });

            const entry_matches_any_sample = (req_id, req) => {
                const candidates = new Set([String(req_id)]);
                if (req?.key) candidates.add(String(req.key));
                if (req?.id) candidates.add(String(req.id));
                return [...candidates].some(id => requirement_ids_in_samples.has(id));
            };

            entries = entries.filter(([req_id, req]) => entry_matches_any_sample(req_id, req));
            this.relevant_ids_by_sample = relevant_ids_by_sample;
        } else {
            // Sample mode
            current_sample_object = samples.find(s => s.id === this.params.sampleId);
            if (!current_sample_object) {
                this.root.innerHTML = '';
                const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });
                plate.appendChild(this.Helpers.create_element('h1', { text_content: t('requirement_list_title_suffix') }));
                plate.appendChild(this.Helpers.create_element('p', { text_content: t('error_sample_not_found') || 'Sample not found' }));
                this.root.appendChild(plate);
                this.is_dom_initialized = false;
                return;
            }

            all_relevant_requirements = this.AuditLogic.get_relevant_requirements_for_sample(rule_file_content, current_sample_object);
            this.current_sample_object = current_sample_object;
        }

        // Render header based on mode
        if (this.mode === 'all') {
            const total_count = entries.length;
            this.h1_element_ref.textContent = t('all_requirements_title_audit_with_count', { count: total_count });
        } else {
            this.render_sample_header(state, current_sample_object, all_relevant_requirements);
        }

        // Get filter settings
        let current_ui_settings = state.uiSettings?.[this.state_filter_key] || {};
        
        // Default statusfilter (samma som högerspalten), används vid sessionStorage-återladdning utan status
        const default_status = { needs_help: true, passed: true, failed: true, partially_audited: true, not_audited: true, updated: true };
        if (!current_ui_settings.status || Object.keys(current_ui_settings.status).length === 0) {
            current_ui_settings = { ...current_ui_settings, status: default_status };
        }

        // Automatisk val av sortering första gången
        if (!current_ui_settings.sortBy || current_ui_settings.sortBy === 'default') {
            const requirements_to_check = this.mode === 'all' ? entries : all_relevant_requirements;
            const has_any_reference = requirements_to_check.some((item) => {
                if (this.mode === 'all') {
                    const [, req] = item;
                    const ref = this.get_reference_string_for_sort(req);
                    return ref && ref.trim() !== '';
                } else {
                    const ref = item.standardReference?.text;
                    return ref && typeof ref === 'string' && ref.trim() !== '';
                }
            });
            const auto_sort_by = has_any_reference ? 'ref_asc' : 'title_asc';
            
            this.dispatch({
                type: this.action_type,
                payload: { ...current_ui_settings, sortBy: auto_sort_by }
            });
            
            current_ui_settings = { ...current_ui_settings, sortBy: auto_sort_by };
        }

        // Initialize filter (samma som högerspalten)
        const get_current_filters = () => {
            const s = this.getState();
            let ui = s.uiSettings?.[this.state_filter_key] || {};
            if (!ui.status || Object.keys(ui.status).length === 0) {
                ui = { ...ui, status: { needs_help: true, passed: true, failed: true, partially_audited: true, not_audited: true, updated: true } };
            }
            return ui;
        };

        if (this.filter_component_instance?.init && this.filter_component_instance?.render) {
            if (!this.filter_component_instance._filter_container_ref) {
                await this.filter_component_instance.init({
                    root: this.filter_container_element,
                    deps: {
                        Translation: this.Translation,
                        Helpers: this.Helpers,
                        idPrefix: this.mode === 'all' ? 'all-requirements-filter' : 'requirement-list-filter',
                        getCurrentFilters: get_current_filters,
                        getSortOptions: () => this.get_sort_options(),
                        onFilterChange: this.handle_filter_change,
                    },
                });
            }
            this.filter_component_instance.render();
        }

        // Update navigation bars (sample mode only)
        if (this.mode === 'sample') {
            this.update_navigation_bars(state);
        }

        // Filter and sort requirements
        let filtered_items = [];
        let total_count = 0;

        // Samma filterlogik som högerspalten: status_filters[display_status] === true
        const status_filters = current_ui_settings.status || {};
        const has_status_filters = Object.keys(status_filters).length > 0;

        const requirement_needs_help_fn = this.AuditLogic?.requirement_needs_help || (() => false);

        if (this.mode === 'all') {
            total_count = entries.length;
            const search_term = (current_ui_settings.searchText || '').toLowerCase().trim();

            filtered_items = entries.filter(([req_id, req]) => {
                const agg_status = this.get_aggregated_display_status_for_requirement(req_id, req, samples);
                const any_sample_needs_help = samples.some(s => requirement_needs_help_fn((s.requirementResults || {})[req_id]));
                const status_match = !has_status_filters || status_filters[agg_status] === true;
                const needs_help_checked = status_filters.needs_help === true;
                const show_by_status = status_match || (needs_help_checked && any_sample_needs_help);
                const hide_by_needs_help = status_filters.needs_help === false && any_sample_needs_help;
                if (!show_by_status || hide_by_needs_help) return false;

                if (search_term) {
                    return this.get_searchable_text_for_requirement(req).includes(search_term);
                }
                return true;
            });
        } else {
            total_count = all_relevant_requirements.length;
            const search_term = (current_ui_settings.searchText || '').toLowerCase();

            filtered_items = all_relevant_requirements.filter(req => {
                const result = (current_sample_object.requirementResults || {})[req.key];
                const display_status = result?.needsReview ? 'updated' : this.AuditLogic.calculate_requirement_status(req, result);
                const needs_help = requirement_needs_help_fn(result);
                const status_match = !has_status_filters || status_filters[display_status] === true;
                const needs_help_checked = status_filters.needs_help === true;
                const show_by_status = status_match || (needs_help_checked && needs_help);
                const hide_by_needs_help = status_filters.needs_help === false && needs_help;
                if (!show_by_status || hide_by_needs_help) return false;

                if (search_term) {
                    return this.get_searchable_text_for_requirement(req).includes(search_term);
                }
                return true;
            });
        }

        const filtered_count = filtered_items.length;

        // Update results summary
        this.results_summary_element_ref.textContent = t('results_summary_template', {
            filteredCount: filtered_count,
            totalCount: total_count
        });

        // Sort items
        const sort_by = current_ui_settings.sortBy || 'ref_asc';
        const sorted_items = this.sort_items(filtered_items, sort_by, current_sample_object, samples);

        // Render items
        this.render_items(sorted_items, samples, current_sample_object, total_count, filtered_count);
    },

    render_sample_header(state, current_sample_object, all_relevant_requirements) {
        const t = this.Translation.t;
        if (!this.header_element_ref) return;

        this.header_element_ref.innerHTML = '';

        const actor_name = state.auditMetadata?.actorName || '';
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
        this.header_element_ref.appendChild(h1);

        const sample_categories_map = new Map();
        (state.ruleFileContent.metadata.samples?.sampleCategories || []).forEach(cat => {
            sample_categories_map.set(cat.id, cat.text);
        });
        const category_text = sample_categories_map.get(current_sample_object.sampleCategory) || current_sample_object.sampleCategory;
        const type_info_string = `${current_sample_object.sampleType || ''} (${category_text || ''})`;

        const sample_type_p = this.Helpers.create_element('p', { class_name: 'sample-info-display sample-page-type' });
        const strong_element = this.Helpers.create_element('strong', { text_content: t('page_type') });
        sample_type_p.appendChild(strong_element);
        sample_type_p.appendChild(document.createTextNode(': '));
        sample_type_p.appendChild(document.createTextNode(this.Helpers.escape_html(type_info_string)));
        this.header_element_ref.appendChild(sample_type_p);

        const audited_requirements_count = all_relevant_requirements.filter(req => {
            const status = this.AuditLogic.calculate_requirement_status(req, (current_sample_object.requirementResults || {})[req.key]);
            return status === 'passed' || status === 'failed';
        }).length;

        const sample_audit_status_p = this.Helpers.create_element('p', { class_name: 'sample-info-display sample-audit-progress' });
        const strong_element2 = this.Helpers.create_element('strong', { text_content: t('requirements_audited_for_sample') });
        sample_audit_status_p.appendChild(strong_element2);
        sample_audit_status_p.appendChild(document.createTextNode(': '));
        sample_audit_status_p.appendChild(document.createTextNode(`${audited_requirements_count}/${all_relevant_requirements.length}`));
        this.header_element_ref.appendChild(sample_audit_status_p);

        if (ProgressBarComponent) {
            this.header_element_ref.appendChild(ProgressBarComponent.create(audited_requirements_count, all_relevant_requirements.length, {}));
        }
    },

    update_navigation_bars(state) {
        const t = this.Translation.t;
        const current_global_state = state;
        
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
    },

    sort_items(items, sort_by, current_sample_object, samples = []) {
        const sorted = [...items];

        if (this.mode === 'all') {
            if (sort_by === 'title_asc') {
                sorted.sort((a, b) => this.compare_strings_locale(a?.[1]?.title, b?.[1]?.title));
            } else if (sort_by === 'title_desc') {
                sorted.sort((a, b) => this.compare_strings_locale(b?.[1]?.title, a?.[1]?.title));
            } else if (sort_by === 'ref_asc') {
                sorted.sort((a, b) => {
                    const ref_a = this.get_reference_string_for_sort(a?.[1]);
                    const ref_b = this.get_reference_string_for_sort(b?.[1]);
                    if (this.Helpers?.natural_sort) {
                        return this.Helpers.natural_sort(ref_a || 'Z', ref_b || 'Z');
                    }
                    return this.compare_strings_locale(ref_a, ref_b);
                });
            } else if (sort_by === 'ref_desc') {
                sorted.sort((a, b) => {
                    const ref_a = this.get_reference_string_for_sort(a?.[1]);
                    const ref_b = this.get_reference_string_for_sort(b?.[1]);
                    if (this.Helpers?.natural_sort) {
                        return this.Helpers.natural_sort(ref_b || 'Z', ref_a || 'Z');
                    }
                    return this.compare_strings_locale(ref_b, ref_a);
                });
            } else if (sort_by === 'updated_first') {
                sorted.sort((a, b) => {
                    const status_a = this.get_aggregated_display_status_for_requirement(a?.[0], a?.[1], samples);
                    const status_b = this.get_aggregated_display_status_for_requirement(b?.[0], b?.[1], samples);
                    const a_updated = status_a === 'updated' ? 0 : 1;
                    const b_updated = status_b === 'updated' ? 0 : 1;
                    if (a_updated !== b_updated) return a_updated - b_updated;
                    const ref_a = this.get_reference_string_for_sort(a?.[1]);
                    const ref_b = this.get_reference_string_for_sort(b?.[1]);
                    return this.Helpers?.natural_sort(ref_a || 'Z', ref_b || 'Z') || 0;
                });
            }
        } else {
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
            const effectiveSortKey = sort_function.hasOwnProperty(sort_by) ? sort_by : 'ref_asc';
            sorted.sort(sort_function[effectiveSortKey]);
        }

        return sorted;
    },

    render_items(sorted_items, samples, current_sample_object, total_count, filtered_count) {
        const t = this.Translation.t;

        if (this.content_div_for_delegation) {
            this.content_div_for_delegation.innerHTML = '';
        }

        if (this.mode === 'all') {
            if (this.empty_message_element_ref) {
                this.empty_message_element_ref.style.display = 'none';
            }

            if (total_count === 0) {
                if (this.empty_message_element_ref) {
                    this.empty_message_element_ref.textContent = t('all_requirements_empty_no_samples') || t('all_requirements_empty');
                    this.empty_message_element_ref.style.display = '';
                }
                return;
            }

            if (filtered_count === 0) {
                return;
            }

            const req_ul = this.Helpers.create_element('ul', { class_name: 'requirement-items-ul' });
            sorted_items.forEach(([req_id, req]) => {
                req_ul.appendChild(this.create_all_requirement_list_item(req_id, req, samples));
            });
            this.content_div_for_delegation.appendChild(req_ul);

            this._apply_return_focus_if_needed();
        } else {
            // Sample mode
            if (this.content_div_for_delegation) {
                this.content_div_for_delegation.innerHTML = '';
            }

            if (sorted_items.length === 0) {
                if (this.content_div_for_delegation) {
                    this.content_div_for_delegation.appendChild(this.Helpers.create_element('p', { text_content: t('no_requirements_match_filter') }));
                }
            } else {
                const req_ul = this.Helpers.create_element('ul', { class_name: 'requirement-items-ul' });
                sorted_items.forEach(req => {
                    req_ul.appendChild(this.create_requirement_list_item(req, current_sample_object));
                });
                if (this.content_div_for_delegation) {
                    this.content_div_for_delegation.appendChild(req_ul);
                }
            }

            // Apply return focus if needed (sample mode only)
            this._apply_return_focus_if_needed();
        }
    },

    create_all_requirement_list_item(req_id, req, samples) {
        const t = this.Translation.t;
        const candidates = new Set([String(req_id)]);
        if (req?.key) candidates.add(String(req.key));
        if (req?.id) candidates.add(String(req.id));

        const matching_samples = samples.filter(sample => {
            const sample_set = sample?.id ? this.relevant_ids_by_sample.get(sample.id) : null;
            if (!sample_set) return false;
            return [...candidates].some(id => sample_set.has(id));
        });

        const req_key = req?.key || req?.id || req_id;
        const requirement_id = req_key;

        const ref_text = req?.standardReference?.text || (typeof req?.reference === 'string' && req.reference.trim() !== '' ? req.reference : '');
        const sub_lines = [ref_text, t('all_requirements_occurs_in_samples', { count: matching_samples.length })].filter(Boolean);

        const li = this.Helpers.create_element('li', { class_name: 'requirement-item compact-twoline' });

        const h3 = this.Helpers.create_element('h3', {
            class_name: 'requirement-header-nested',
            text_content: req?.title || t('unknown_value', { val: req_id })
        });
        li.appendChild(h3);

        if (sub_lines.length > 0) {
            const sub_text = this.Helpers.create_element('div', {
                class_name: 'requirement-header-sub',
                text_content: sub_lines.join('\n')
            });
            li.appendChild(sub_text);
        }

        const samples_ol = this.Helpers.create_element('ol', { class_name: 'requirement-samples-list' });

        const requirement_needs_help_fn = this.AuditLogic?.requirement_needs_help || (() => false);
        for (const sample of matching_samples) {
            const req_result = (sample.requirementResults || {})[req_key];
            const base_status = req_result?.needsReview ? 'updated' : this.AuditLogic.calculate_requirement_status(req, req_result);
            const needs_help = requirement_needs_help_fn(req_result);
            const status_text = t(base_status === 'updated' ? 'status_updated' : `audit_status_${base_status}`) +
                (needs_help ? ` (${t('filter_option_needs_help')})` : '');

            const sample_name = sample?.description || t('undefined_description');
            const sample_li = this.Helpers.create_element('li', { class_name: 'requirement-sample-item' });
            const status_tooltip_text = t(base_status === 'updated' ? 'status_updated' : `audit_status_${base_status}`);
            const icons_wrapper = this.Helpers.create_element('span', { class_name: 'status-icons-wrapper' });
            const status_icon_wrapper = this.Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
            const status_icon = this.Helpers.create_element('span', {
                class_name: `status-icon status-icon-${base_status.replace('_', '-')}`,
                text_content: this.get_status_icon(base_status),
                attributes: { 'aria-hidden': 'true' }
            });
            const status_tooltip = this.Helpers.create_element('span', {
                class_name: 'status-icon-tooltip',
                text_content: status_tooltip_text,
                attributes: { 'aria-hidden': 'true' }
            });
            status_icon_wrapper.appendChild(status_icon);
            status_icon_wrapper.appendChild(status_tooltip);
            icons_wrapper.appendChild(status_icon_wrapper);
            if (needs_help) {
                const warning_svg = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('warning', ['currentColor'], 14) : '';
                const needs_help_wrapper = this.Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
                const needs_help_icon = this.Helpers.create_element('span', {
                    class_name: 'status-icon status-icon-needs-help-indicator',
                    html_content: warning_svg,
                    attributes: { 'aria-hidden': 'true' }
                });
                const needs_help_tooltip = this.Helpers.create_element('span', {
                    class_name: 'status-icon-tooltip',
                    text_content: t('filter_option_needs_help'),
                    attributes: { 'aria-hidden': 'true' }
                });
                needs_help_wrapper.appendChild(needs_help_icon);
                needs_help_wrapper.appendChild(needs_help_tooltip);
                icons_wrapper.appendChild(needs_help_wrapper);
            }
            const sample_link = this.Helpers.create_element('a', {
                class_name: 'list-title-link',
                text_content: sample_name,
                attributes: {
                    'data-requirement-id': requirement_id,
                    'data-sample-id': sample?.id || '',
                    href: '#',
                    'aria-label': `${sample_name} – ${status_text}`
                }
            });
            sample_li.appendChild(icons_wrapper);
            sample_li.appendChild(sample_link);
            samples_ol.appendChild(sample_li);
        }

        li.appendChild(samples_ol);
        return li;
    },

    create_requirement_list_item(req, sample) {
        const t = this.Translation.t;
        const req_result = (sample.requirementResults || {})[req.key];
        const requirement_needs_help_fn = this.AuditLogic?.requirement_needs_help || (() => false);
        const base_status = req_result?.needsReview ? 'updated' : this.AuditLogic.calculate_requirement_status(req, req_result);
        const needs_help = requirement_needs_help_fn(req_result);

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
        const status_text = t(base_status === 'updated' ? 'status_updated' : `audit_status_${base_status}`) +
            (needs_help ? ` (${t('filter_option_needs_help')})` : '');
        
        const status_span = this.Helpers.create_element('span', { 
            class_name: base_status === 'updated' ? 'status-text-updated' : needs_help ? 'status-text-needs-help' : '',
            text_content: status_text
        });
        
        const status_tooltip_text = t(base_status === 'updated' ? 'status_updated' : `audit_status_${base_status}`);
        const icons_wrapper = this.Helpers.create_element('span', { class_name: 'status-icons-wrapper' });
        const status_icon_wrapper = this.Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
        const status_icon = this.Helpers.create_element('span', {
            class_name: `status-icon status-icon-${base_status.replace('_', '-')}`,
            text_content: this.get_status_icon(base_status),
            attributes: { 'aria-hidden': 'true' }
        });
        const status_tooltip = this.Helpers.create_element('span', {
            class_name: 'status-icon-tooltip',
            text_content: status_tooltip_text,
            attributes: { 'aria-hidden': 'true' }
        });
        status_icon_wrapper.appendChild(status_icon);
        status_icon_wrapper.appendChild(status_tooltip);
        icons_wrapper.appendChild(status_icon_wrapper);
        if (needs_help) {
            const warning_svg = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('warning', ['currentColor'], 14) : '';
            const needs_help_wrapper = this.Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
            const needs_help_icon = this.Helpers.create_element('span', {
                class_name: 'status-icon status-icon-needs-help-indicator',
                html_content: warning_svg,
                attributes: { 'aria-hidden': 'true' }
            });
            const needs_help_tooltip = this.Helpers.create_element('span', {
                class_name: 'status-icon-tooltip',
                text_content: t('filter_option_needs_help'),
                attributes: { 'aria-hidden': 'true' }
            });
            needs_help_wrapper.appendChild(needs_help_icon);
            needs_help_wrapper.appendChild(needs_help_tooltip);
            icons_wrapper.appendChild(needs_help_wrapper);
        }
        
        details_row_div.appendChild(icons_wrapper);
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
            try { window.sessionStorage.removeItem(this.RETURN_FOCUS_SESSION_KEY); } catch (err) {}
            return;
        }

        const requirement_id = focus_instruction?.requirementId || null;
        const sample_id = focus_instruction?.sampleId || null;

        try { window.sessionStorage.removeItem(this.RETURN_FOCUS_SESSION_KEY); } catch (e) {}

        if (!requirement_id || !sample_id) return;

        let target_link = null;
        if (this.mode === 'all') {
            target_link = this.content_div_for_delegation.querySelector(
                `a.list-title-link[data-requirement-id="${CSS.escape(String(requirement_id))}"][data-sample-id="${CSS.escape(String(sample_id))}"]`
            );
        } else {
            const current_sample_id = this.params?.sampleId || null;
            if (String(sample_id) !== String(current_sample_id)) return;
            target_link = this.content_div_for_delegation.querySelector(
                `a.list-title-link[data-requirement-id="${CSS.escape(String(requirement_id))}"]`
            );
        }
        if (!target_link) return;

        window.customFocusApplied = true;

        const top_action_bar = document.getElementById('global-action-bar-top');
        const top_bar_height = top_action_bar ? top_action_bar.offsetHeight : 0;

        const element_rect = target_link.getBoundingClientRect();
        const absolute_element_top = element_rect.top + window.pageYOffset;
        const scroll_position = absolute_element_top - top_bar_height;

        window.scrollTo({ top: scroll_position, behavior: 'smooth' });

        setTimeout(() => {
            try {
                target_link.focus({ preventScroll: true });
            } catch (e) {
                target_link.focus();
            }
        }, 150);
    },

    destroy() {
        if (this.filter_component_instance && typeof this.filter_component_instance.destroy === 'function') {
            this.filter_component_instance.destroy();
        }
        
        if (this.content_div_for_delegation) {
            this.content_div_for_delegation.removeEventListener('click', this.handle_requirement_list_click);
            this.content_div_for_delegation.removeEventListener('keydown', this.handle_requirement_list_keydown);
            this.content_div_for_delegation = null;
        }

        if (this.root) this.root.innerHTML = '';
        
        this.root = null;
        this.deps = null;
        this.filter_container_element = null;
        this.filter_heading_ref = null;
        this.is_dom_initialized = false;
        this.plate_element_ref = null;
        this.h1_element_ref = null;
        this.header_element_ref = null;
        this.results_summary_element_ref = null;
        this.empty_message_element_ref = null;
        this.list_element_ref = null;
        this.global_message_element_ref = null;
    }
};
