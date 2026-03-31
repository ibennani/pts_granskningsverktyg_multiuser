import { RequirementListToolbarComponent } from './RequirementListToolbarComponent.js';
import {
    get_requirements_entries,
    get_reference_string_for_sort,
    get_searchable_text_for_requirement,
    sample_matches_status_filter
} from './requirements_list/requirement_list_query.js';
import { get_sort_options, sort_items } from './requirements_list/requirement_list_sort.js';
import { create_status_icons_wrapper } from './requirements_list/requirement_list_status_icons.js';
import { build_item_keys, update_items_status_only } from './requirements_list/requirement_list_incremental_dom.js';
import { create_all_requirement_list_item, create_requirement_list_item } from './requirements_list/requirement_list_list_items.js';
import { handle_mark_requirement_passed_in_all_samples } from './requirements_list/requirement_list_mark_all_modal.js';
import { apply_return_focus_if_needed } from './requirements_list/requirement_list_return_focus.js';
import { render_sample_header } from './requirements_list/requirement_list_sample_header.js';
import { build_requirements_list_dom } from './requirements_list/requirement_list_build_dom.js';
import { build_all_mode_data } from './requirements_list/requirement_list_all_mode_data.js';
import { fingerprint_item_keys, can_incremental_update } from '../utils/incremental_list_update.js';
import './all_requirements_view_component.css';
import './requirement_list_component.css';

export class RequirementsListViewComponent {
    static CSS_PATH_ALL = './all_requirements_view_component.css';
    static CSS_PATH_SAMPLE = './requirement_list_component.css';

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.mode = deps.mode || 'all'; // 'all' or 'sample'

        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.subscribe = deps.subscribe;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.AuditLogic = deps.AuditLogic;
        this.params = deps.params || {};
        this.unsubscribe_from_store = null;

        // Mode-specific state keys
        this.state_filter_key = this.mode === 'all' ? 'allRequirementsFilter' : 'requirementListFilter';
        this.action_type = this.mode === 'all' 
            ? this.StoreActionTypes.SET_ALL_REQUIREMENTS_FILTER_SETTINGS 
            : this.StoreActionTypes.SET_UI_FILTER_SETTINGS;

        // Mode-specific constants
        this.RETURN_FOCUS_SESSION_KEY = this.mode === 'sample' ? 'gv_return_focus_requirement_list_v1' : 'gv_return_focus_all_requirements_v1';

        // Filter component: samma toolbar för båda lägena
        this.filter_component_instance = RequirementListToolbarComponent;
        this.filter_container_element = null;
        this.filter_heading_ref = null;
        this.handle_filter_change = this.handle_filter_change.bind(this);
        this.handle_toolbar_change = this.handle_toolbar_change.bind(this);
        this._toolbar_inited = false;

        // DOM references
        this.is_dom_initialized = false;
        this.plate_element_ref = null;
        this.h1_element_ref = null;
        this.header_element_ref = null;
        this.results_summary_element_ref = null;
        this.empty_message_element_ref = null;
        this.list_element_ref = null;
        this.content_div_for_delegation = null;

        this._last_rendered_fingerprint = null;

        // Event handlers för både sample och all mode
        this.handle_requirement_list_click = this.handle_requirement_list_click.bind(this);
        this.handle_requirement_list_keydown = this.handle_requirement_list_keydown.bind(this);

        // Load CSS – båda lägena använder samma kompakta kravlistformat
        if (this.Helpers?.load_css) {
            if (this.constructor.CSS_PATH_SAMPLE) {
                await this.Helpers.load_css(this.constructor.CSS_PATH_SAMPLE).catch(() => {});
            }
            if (this.mode === 'all' && this.constructor.CSS_PATH_ALL) {
                await this.Helpers.load_css(this.constructor.CSS_PATH_ALL).catch(() => {});
            }
        }

        this.NotificationComponent = deps.NotificationComponent;

        if (typeof this.subscribe === 'function') {
            this.unsubscribe_from_store = this.subscribe((_new_state, listener_meta) => {
                if (listener_meta?.skip_render) return;
                if (this.root && typeof this.render === 'function') {
                    this.render();
                }
            });
        }
    }

    handle_filter_change(partial) {
        if (typeof this.dispatch !== 'function' || !this.StoreActionTypes) return;
        const state = this.getState();
        const current = state.uiSettings?.[this.state_filter_key] || {};
        const merged = { ...current, ...partial };
        this.dispatch({
            type: this.action_type,
            payload: merged,
        });
    }

    handle_toolbar_change(new_state) {
        if (typeof this.dispatch !== 'function' || !this.StoreActionTypes) return;
        this.dispatch({
            type: this.action_type,
            payload: {
                searchText: new_state.searchText,
                sortBy: new_state.sortBy,
                status: new_state.status
            }
        });
    }

    handle_requirement_list_click(event) {
        const mark_btn = event.target.closest('button[data-action="mark-requirement-passed-all"]');
        if (mark_btn) {
            event.preventDefault();
            event.stopPropagation();
            const requirement_id = mark_btn.dataset.requirementId;
            if (requirement_id) {
                handle_mark_requirement_passed_in_all_samples(requirement_id, mark_btn, {
                    getState: () => this.getState(),
                    AuditLogic: this.AuditLogic,
                    Helpers: this.Helpers,
                    Translation: this.Translation,
                    dispatch: this.dispatch,
                    StoreActionTypes: this.StoreActionTypes,
                    NotificationComponent: this.NotificationComponent,
                    rerender: () => this.render()
                });
            }
            return;
        }

        const target_link = event.target.closest('a.list-title-link[data-requirement-id]');
        if (!target_link || !this.router) return;
        const requirement_id = target_link.dataset.requirementId;
        const sample_id = this.mode === 'sample' ? this.params?.sampleId : target_link.dataset.sampleId;
        if (sample_id && requirement_id) {
            event.preventDefault();
            this.router('requirement_audit', { sampleId: sample_id, requirementId: requirement_id });
        }
    }

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
    }

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

        const dom_refs = build_requirements_list_dom({
            root: this.root,
            mode: this.mode,
            Helpers: this.Helpers,
            Translation: this.Translation,
            NotificationComponent: this.NotificationComponent,
            handle_requirement_list_click: this.handle_requirement_list_click,
            handle_requirement_list_keydown: this.handle_requirement_list_keydown
        });
        this.plate_element_ref = dom_refs.plate_element_ref;
        this.h1_element_ref = dom_refs.h1_element_ref;
        this.header_element_ref = dom_refs.header_element_ref;
        this.filter_heading_ref = dom_refs.filter_heading_ref;
        this.filter_container_element = dom_refs.filter_container_element;
        this.results_summary_element_ref = dom_refs.results_summary_element_ref;
        this.empty_message_element_ref = dom_refs.empty_message_element_ref;
        this.content_div_for_delegation = dom_refs.content_div_for_delegation;
        this.is_dom_initialized = true;
        return true;
    }

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
                plate.appendChild(this.Helpers.create_element('p', { text_content: t('error_no_sample_selected') }));
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
            entries = get_requirements_entries(rule_file_content);
            const all_data = build_all_mode_data(state, entries, this.AuditLogic);
            entries = all_data.entries;
            this.relevant_ids_by_sample = all_data.relevant_ids_by_sample;
        } else {
            // Sample mode
            current_sample_object = samples.find(s => s.id === this.params.sampleId);
            if (!current_sample_object) {
                this.root.innerHTML = '';
                const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });
                plate.appendChild(this.Helpers.create_element('h1', { text_content: t('requirement_list_title_suffix') }));
                plate.appendChild(this.Helpers.create_element('p', { text_content: t('error_sample_not_found') }));
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
            render_sample_header(state, current_sample_object, all_relevant_requirements, this.header_element_ref, this.Helpers, this.Translation, this.AuditLogic);
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
                    const ref = get_reference_string_for_sort(req);
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

        if (this.filter_component_instance?.init && this.filter_component_instance?.render) {
            if (!this._toolbar_inited) {
                const default_status = { needs_help: true, passed: true, failed: true, partially_audited: true, not_audited: true, updated: true };
                const initial_state = {
                    searchText: current_ui_settings.searchText || '',
                    sortBy: current_ui_settings.sortBy || 'ref_asc',
                    status: { ...default_status, ...(current_ui_settings.status || {}) }
                };
                await this.filter_component_instance.init({
                    root: this.filter_container_element,
                    deps: {
                        on_change: this.handle_toolbar_change,
                        initial_state,
                        Translation: this.Translation,
                        Helpers: this.Helpers,
                        config: {
                            showStatusFilter: true,
                            sortOptions: get_sort_options(this.mode),
                            idPrefix: this.state_filter_key === 'allRequirementsFilter' ? 'all-requirements-filter' : 'requirement-list-filter',
                            searchDebounceMs: 400
                        }
                    }
                });
                this._toolbar_inited = true;
            }
            const default_status = { needs_help: true, passed: true, failed: true, partially_audited: true, not_audited: true, updated: true };
            const status_from_store = current_ui_settings.status || {};
            const normalized_status = { ...default_status };
            ['needs_help', 'passed', 'failed', 'partially_audited', 'not_audited', 'updated'].forEach(key => {
                if (status_from_store[key] !== undefined) {
                    normalized_status[key] = status_from_store[key] === true;
                }
            });
            this.filter_component_instance.render({
                searchText: current_ui_settings.searchText || '',
                sortBy: current_ui_settings.sortBy || 'ref_asc',
                status: normalized_status
            });
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
                const candidates = new Set([String(req_id)]);
                if (req?.key) candidates.add(String(req.key));
                if (req?.id) candidates.add(String(req.id));

                const samples_for_req = samples.filter(sample => {
                    const sample_set = sample?.id ? this.relevant_ids_by_sample.get(sample.id) : null;
                    if (!sample_set) return false;
                    return [...candidates].some(id => sample_set.has(id));
                });

                const at_least_one_sample_matches = samples_for_req.some(sample =>
                    sample_matches_status_filter(sample, req_id, req, status_filters, has_status_filters, requirement_needs_help_fn, this.AuditLogic)
                );
                if (!at_least_one_sample_matches) return false;

                if (search_term) {
                    return get_searchable_text_for_requirement(req).includes(search_term);
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
                    return get_searchable_text_for_requirement(req).includes(search_term);
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
        const sorted_items = sort_items(this.mode, filtered_items, sort_by, current_sample_object, samples, this.relevant_ids_by_sample, this.AuditLogic, this.Helpers);

        const search_term = (current_ui_settings.searchText || '').toLowerCase().trim();
        const status_keys_for_filter = ['needs_help', 'passed', 'failed', 'partially_audited', 'not_audited', 'updated'];
        const has_search_filter = this.mode === 'all' && search_term.length > 0;
        const has_status_filter_excluding = has_status_filters && status_keys_for_filter.some(key => status_filters[key] !== true);
        const has_active_filter = has_search_filter || has_status_filter_excluding;

        // Render items eller inkrementell uppdatering
        const filter_opts = { status_filters, has_status_filters, requirement_needs_help_fn, has_active_filter };
        const item_keys = build_item_keys(this.mode, sorted_items, samples, this.relevant_ids_by_sample, filter_opts, this.AuditLogic);

        if (can_incremental_update(this._last_rendered_fingerprint, fingerprint_item_keys(item_keys))) {
            update_items_status_only(this.mode, this.content_div_for_delegation, this.relevant_ids_by_sample, sorted_items, samples, current_sample_object, filter_opts, this.AuditLogic, { Helpers: this.Helpers, Translation: this.Translation });
        } else {
            this.render_items(sorted_items, samples, current_sample_object, total_count, filtered_count, filter_opts);
        }
        this._last_rendered_fingerprint = fingerprint_item_keys(item_keys);
    }

    render_items(sorted_items, samples, current_sample_object, total_count, filtered_count, filter_opts = {}) {
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
                const hint_p = this.Helpers.create_element('p', {
                    class_name: 'view-intro-text no-match-hint',
                    text_content: t('no_requirements_match_filter_all_hint')
                });
                this.content_div_for_delegation.appendChild(hint_p);
                return;
            }

            const req_ul = this.Helpers.create_element('ul', { class_name: 'requirement-items-ul' });
            sorted_items.forEach(([req_id, req]) => {
                req_ul.appendChild(create_all_requirement_list_item(req_id, req, samples, filter_opts, this.relevant_ids_by_sample, () => this.getState(), this.AuditLogic, this.Helpers, this.Translation));
            });
            this.content_div_for_delegation.appendChild(req_ul);

            apply_return_focus_if_needed(this.content_div_for_delegation, this.RETURN_FOCUS_SESSION_KEY, this.mode, this.params?.sampleId || null);
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
                const req_ol = this.Helpers.create_element('ol', { class_name: 'requirement-items-ul' });
                sorted_items.forEach(req => {
                    req_ol.appendChild(create_requirement_list_item(req, current_sample_object, this.AuditLogic, this.Helpers, this.Translation));
                });
                if (this.content_div_for_delegation) {
                    this.content_div_for_delegation.appendChild(req_ol);
                }
            }

            // Apply return focus if needed (sample mode only)
            apply_return_focus_if_needed(this.content_div_for_delegation, this.RETURN_FOCUS_SESSION_KEY, this.mode, this.params?.sampleId || null);
        }
    }

    destroy() {
        if (typeof this.unsubscribe_from_store === 'function') {
            this.unsubscribe_from_store();
            this.unsubscribe_from_store = null;
        }
        if (this.filter_component_instance && typeof this.filter_component_instance.destroy === 'function') {
            this.filter_component_instance.destroy();
        }
        this._toolbar_inited = false;

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
    }
};
