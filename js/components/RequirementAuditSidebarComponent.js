// js/components/RequirementAuditSidebarComponent.js

import { RequirementsFilterComponent } from './RequirementsFilterComponent.js';
import { get_searchable_text_for_requirement as get_searchable_text_util } from '../utils/requirement_search_utils.js';

export const RequirementAuditSidebarComponent = {
    CSS_PATH: 'css/components/requirement_audit_sidebar_component.css',

    root: null,
    deps: null,
    router: null,
    getState: null,
    Translation: null,
    Helpers: null,
    AuditLogic: null,
    on_filters_change_callback: null,

    is_dom_initialized: false,
    selected_mode: 'sample_requirements',
    last_render_options: null,

    mode_fieldset_ref: null,
    mode_legend_ref: null,
    mode_label_refs: null,
    filter_container_ref: null,
    requirements_filter_component: null,
    list_container_ref: null,
    heading_ref: null,
    filter_heading_ref: null,
    list_heading_ref: null,

    filters_by_mode: {
        sample_requirements: {
            searchText: '',
            sortBy: 'ref_asc',
            status: { needs_help: true, passed: true, failed: true, partially_audited: true, not_audited: true, updated: true }
        },
        requirement_samples: {
            searchText: '',
            sortBy: 'creation_order',
            status: { needs_help: true, passed: true, failed: true, partially_audited: true, not_audited: true, updated: true }
        }
    },

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.AuditLogic = deps.AuditLogic;
        this.on_filters_change_callback = deps.onSidebarFiltersChange;

        this.handle_mode_change = this.handle_mode_change.bind(this);
        this.handle_link_click = this.handle_link_click.bind(this);

        // Ladda sparade inställningar från state
        this.load_settings_from_state();

        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH, 'RequirementAuditSidebarComponent').catch(() => {});
        } else if (this.Helpers?.load_css) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }
    },

    async ensure_dom_initialized() {
        if (!this.root || this.is_dom_initialized) return;

        this.root.innerHTML = '';

        const container = this.Helpers.create_element('div', { class_name: 'requirement-audit-sidebar' });
        this.heading_ref = this.Helpers.create_element('h2', { text_content: '' });
        container.appendChild(this.heading_ref);

        const fieldset = this.Helpers.create_element('fieldset', { class_name: 'requirement-audit-sidebar__mode' });
        const legend = this.Helpers.create_element('legend', { text_content: this.Translation.t('requirement_audit_sidebar_mode_label') });
        fieldset.appendChild(legend);
        this.mode_legend_ref = legend;
        this.mode_label_refs = {};

        const mode_options = [
            {
                value: 'sample_requirements',
                label_key: 'requirement_audit_sidebar_mode_sample_requirements'
            },
            {
                value: 'requirement_samples',
                label_key: 'requirement_audit_sidebar_mode_requirement_samples'
            }
        ];

        mode_options.forEach(option => {
            const option_id = `requirement-audit-sidebar-mode-${option.value}`;
            const wrapper = this.Helpers.create_element('div', { class_name: 'requirement-audit-sidebar__mode-option' });
            const input = this.Helpers.create_element('input', {
                attributes: {
                    type: 'radio',
                    id: option_id,
                    name: 'requirement_audit_sidebar_mode',
                    value: option.value
                }
            });
            input.addEventListener('change', this.handle_mode_change);

            const label = this.Helpers.create_element('label', {
                text_content: this.Translation.t(option.label_key),
                attributes: { for: option_id }
            });
            this.mode_label_refs[option.value] = label;

            wrapper.appendChild(input);
            wrapper.appendChild(label);
            fieldset.appendChild(wrapper);
        });

        container.appendChild(fieldset);
        this.mode_fieldset_ref = fieldset;

        this.filter_heading_ref = this.Helpers.create_element('h3', { text_content: '' });
        container.appendChild(this.filter_heading_ref);

        this.filter_container_ref = this.Helpers.create_element('div', { class_name: 'requirement-audit-sidebar__filters' });
        this.requirements_filter_component = RequirementsFilterComponent;
        await this.requirements_filter_component.init({
            root: this.filter_container_ref,
            deps: {
                Translation: this.Translation,
                Helpers: this.Helpers,
                idPrefix: 'requirement-audit-sidebar',
                getCurrentFilters: () => this.get_current_filters(),
                getSortOptions: () => this.get_sort_options_for_mode(this.selected_mode),
                onFilterChange: (partial) => {
                    const current = this.get_current_filters();
                    if (partial.searchText !== undefined) current.searchText = partial.searchText;
                    if (partial.sortBy !== undefined) current.sortBy = partial.sortBy;
                    if (partial.status !== undefined) current.status = partial.status;
                    this.save_settings_to_state();
                    this.render(this.last_render_options);
                    this.notify_filters_changed();
                }
            }
        });
        container.appendChild(this.filter_container_ref);

        this.list_heading_ref = this.Helpers.create_element('h3', { text_content: '' });
        container.appendChild(this.list_heading_ref);

        this.list_container_ref = this.Helpers.create_element('div', {
            class_name: 'requirement-audit-sidebar__list',
            attributes: { 'aria-live': 'polite' }
        });
        container.appendChild(this.list_container_ref);

        this.root.appendChild(container);
        this.root.addEventListener('click', this.handle_link_click);
        this.is_dom_initialized = true;
    },

    handle_mode_change(event) {
        const new_value = event?.target?.value;
        if (!new_value || new_value === this.selected_mode) return;

        this.selected_mode = new_value;
        this.save_settings_to_state();

        if (this.last_render_options) {
            this.render(this.last_render_options);
        }
    },

    handle_link_click(event) {
        const link = event.target?.closest?.('a[data-requirement-sidebar-link="true"]');
        if (!link || !this.router) return;

        const sample_id = link.getAttribute('data-sample-id');
        const requirement_id = link.getAttribute('data-requirement-id');
        if (!sample_id || !requirement_id) return;

        event.preventDefault();
        try {
            window.sessionStorage?.setItem('gv_force_focus_h1_v1', 'true');
        } catch (e) {}
        this.router('requirement_audit', { sampleId: sample_id, requirementId: requirement_id });
    },

    async render(options) {
        if (!this.root || !options) return;
        await this.ensure_dom_initialized();
        this.last_render_options = options;

        const {
            current_sample,
            current_requirement,
            rule_file_content,
            samples,
            requirement_id
        } = options;

        if (!this.mode_fieldset_ref || !this.list_container_ref) return;

        const inputs = this.mode_fieldset_ref.querySelectorAll('input[type="radio"]');
        inputs.forEach(input => {
            input.checked = input.value === this.selected_mode;
        });

        if (this.mode_legend_ref) {
            this.mode_legend_ref.textContent = this.Translation.t('requirement_audit_sidebar_mode_label');
        }
        if (this.mode_label_refs?.sample_requirements) {
            this.mode_label_refs.sample_requirements.textContent = this.Translation.t('requirement_audit_sidebar_mode_sample_requirements');
        }
        if (this.mode_label_refs?.requirement_samples) {
            this.mode_label_refs.requirement_samples.textContent = this.Translation.t('requirement_audit_sidebar_mode_requirement_samples');
        }

        this.update_filter_texts_and_values();

        this.list_container_ref.innerHTML = '';

        if (this.heading_ref) {
            const heading_key = this.selected_mode === 'sample_requirements'
                ? 'requirement_audit_sidebar_title_sample_requirements'
                : 'requirement_audit_sidebar_title_requirement_samples';
            this.heading_ref.textContent = this.Translation.t(heading_key);
        }

        if (this.filter_heading_ref) {
            const filter_heading_key = this.selected_mode === 'sample_requirements'
                ? 'requirement_audit_sidebar_filter_heading_sample_requirements'
                : 'requirement_audit_sidebar_filter_heading_requirement_samples';
            this.filter_heading_ref.textContent = this.Translation.t(filter_heading_key);
        }

        let list_item_count = 0;
        if (rule_file_content && current_sample && current_requirement) {
            if (this.selected_mode === 'sample_requirements') {
                list_item_count = this.get_filtered_requirement_items(rule_file_content, current_sample).length;
            } else {
                list_item_count = this.get_filtered_sample_items(rule_file_content, current_requirement, samples || [], requirement_id, current_sample?.id).length;
            }
        }

        if (this.list_heading_ref) {
            const list_heading_key = this.selected_mode === 'sample_requirements'
                ? 'requirement_audit_sidebar_list_heading_sample_requirements_with_count'
                : 'requirement_audit_sidebar_list_heading_requirement_samples_with_count';
            this.list_heading_ref.textContent = this.Translation.t(list_heading_key, { count: list_item_count });
        }

        if (!rule_file_content || !current_sample || !current_requirement) {
            this.list_container_ref.appendChild(this.Helpers.create_element('p', {
                class_name: 'requirement-audit-sidebar__empty',
                text_content: this.Translation.t('requirement_audit_sidebar_empty_requirements')
            }));
            return;
        }

        if (this.selected_mode === 'sample_requirements') {
            this.render_requirements_for_sample(rule_file_content, current_sample, requirement_id);
        } else {
            this.render_samples_for_requirement(rule_file_content, current_requirement, samples || [], requirement_id, current_sample?.id);
        }

        this.notify_filters_changed();
    },

    render_requirements_for_sample(rule_file_content, current_sample, requirement_id) {
        const sorted_items = this.get_filtered_requirement_items(rule_file_content, current_sample);
        if (!sorted_items.length) {
            this.list_container_ref.appendChild(this.Helpers.create_element('p', {
                class_name: 'requirement-audit-sidebar__empty',
                text_content: this.Translation.t('requirement_audit_sidebar_empty_requirements')
            }));
            return;
        }

        const list = this.Helpers.create_element('ul', { class_name: 'requirement-audit-sidebar__items' });

        sorted_items.forEach(item => {
            const { req_key, requirement, display_status } = item;
            const status_text = this.Translation.t(display_status === 'updated' ? 'status_updated' : `audit_status_${display_status}`);

            const li = this.Helpers.create_element('li', { class_name: 'requirement-audit-sidebar__item' });
            const h4 = this.Helpers.create_element('h4', { class_name: 'requirement-audit-sidebar__link-wrapper' });
            const link = this.Helpers.create_element('a', {
                class_name: 'requirement-audit-sidebar__link',
                text_content: requirement.title || this.Translation.t('unknown_value', { val: req_key }),
                attributes: {
                    href: `#requirement_audit?${new URLSearchParams({ sampleId: current_sample.id, requirementId: req_key }).toString()}`,
                    'data-requirement-sidebar-link': 'true',
                    'data-sample-id': current_sample.id,
                    'data-requirement-id': req_key
                }
            });
            h4.appendChild(link);

            if (String(req_key) === String(requirement_id)) {
                link.setAttribute('aria-current', 'page');
                link.classList.add('is-active');
                li.classList.add('is-active');
            }

            const status_icon = this.Helpers.create_element('span', {
                class_name: `requirement-audit-sidebar__status-icon status-icon status-icon-${display_status.replace('_', '-')}`,
                text_content: this.get_status_icon(display_status),
                attributes: { 'aria-hidden': 'true' }
            });
            const status_text_span = this.Helpers.create_element('span', {
                class_name: 'requirement-audit-sidebar__status-text',
                text_content: status_text
            });
            const meta = this.Helpers.create_element('span', { class_name: 'requirement-audit-sidebar__meta' });
            meta.appendChild(status_icon);
            meta.appendChild(status_text_span);

            li.appendChild(h4);
            if (requirement.standardReference?.text) {
                li.appendChild(this.Helpers.create_element('span', {
                    class_name: 'requirement-audit-sidebar__reference',
                    text_content: requirement.standardReference.text
                }));
            }
            li.appendChild(meta);
            list.appendChild(li);
        });

        this.list_container_ref.appendChild(list);
    },

    render_samples_for_requirement(rule_file_content, current_requirement, samples, requirement_id, current_sample_id) {
        const requirement_key = current_requirement?.key || requirement_id;
        const sorted_samples = this.get_filtered_sample_items(rule_file_content, current_requirement, samples, requirement_id, current_sample_id);
        if (!sorted_samples.length) {
            this.list_container_ref.appendChild(this.Helpers.create_element('p', {
                class_name: 'requirement-audit-sidebar__empty',
                text_content: this.Translation.t('requirement_audit_sidebar_empty_samples')
            }));
            return;
        }

        const list = this.Helpers.create_element('ul', { class_name: 'requirement-audit-sidebar__items' });

        sorted_samples.forEach(item => {
            const sample = item.sample;
            const display_status = item.display_status;
            const status_text = this.Translation.t(display_status === 'updated' ? 'status_updated' : `audit_status_${display_status}`);

            const li = this.Helpers.create_element('li', { class_name: 'requirement-audit-sidebar__item' });
            const h4 = this.Helpers.create_element('h4', { class_name: 'requirement-audit-sidebar__link-wrapper' });
            const link = this.Helpers.create_element('a', {
                class_name: 'requirement-audit-sidebar__link',
                text_content: sample?.description || this.Translation.t('undefined_description'),
                attributes: {
                    href: `#requirement_audit?${new URLSearchParams({ sampleId: sample.id, requirementId: requirement_key }).toString()}`,
                    'data-requirement-sidebar-link': 'true',
                    'data-sample-id': sample.id,
                    'data-requirement-id': requirement_key
                }
            });
            h4.appendChild(link);

            if (String(sample?.id) === String(current_sample_id)) {
                link.setAttribute('aria-current', 'page');
                link.classList.add('is-active');
                li.classList.add('is-active');
            }

            const status_icon = this.Helpers.create_element('span', {
                class_name: `requirement-audit-sidebar__status-icon status-icon status-icon-${display_status.replace('_', '-')}`,
                text_content: this.get_status_icon(display_status),
                attributes: { 'aria-hidden': 'true' }
            });
            const status_text_span = this.Helpers.create_element('span', {
                class_name: 'requirement-audit-sidebar__status-text',
                text_content: status_text
            });
            const meta = this.Helpers.create_element('span', { class_name: 'requirement-audit-sidebar__meta' });
            meta.appendChild(status_icon);
            meta.appendChild(status_text_span);

            li.appendChild(h4);
            // Ingen referenstext i listläget "Alla stickprov för samma krav"
            li.appendChild(meta);
            list.appendChild(li);
        });

        this.list_container_ref.appendChild(list);
    },

    get_current_filters() {
        const current = this.filters_by_mode[this.selected_mode] || this.filters_by_mode.sample_requirements;
        if (!current.status) {
            current.status = { needs_help: true, passed: true, failed: true, partially_audited: true, not_audited: true, updated: true };
        }
        return current;
    },

    get_sort_options_for_mode(mode) {
        if (mode === 'requirement_samples') {
            return [
                { value: 'creation_order', textKey: 'sort_option_creation_order' },
                { value: 'sample_asc', textKey: 'sort_option_sample_asc' },
                { value: 'sample_desc', textKey: 'sort_option_sample_desc' },
                { value: 'page_type_asc', textKey: 'sort_option_page_type_asc' },
                { value: 'page_type_desc', textKey: 'sort_option_page_type_desc' }
            ];
        }
        return [
            { value: 'ref_asc', textKey: 'sort_option_ref_asc_natural' },
            { value: 'ref_desc', textKey: 'sort_option_ref_desc_natural' },
            { value: 'title_asc', textKey: 'sort_option_title_asc' },
            { value: 'title_desc', textKey: 'sort_option_title_desc' },
            { value: 'updated_first', textKey: 'sort_option_updated_first' }
        ];
    },

    update_filter_texts_and_values() {
        const current = this.get_current_filters();
        const sort_options = this.get_sort_options_for_mode(this.selected_mode);
        const valid_sort = sort_options.some(opt => opt.value === current.sortBy);
        if (!valid_sort && sort_options.length > 0) {
            current.sortBy = sort_options[0].value;
        }

        if (this.requirements_filter_component && typeof this.requirements_filter_component.render === 'function') {
            this.requirements_filter_component.render();
        }
    },

    get_filtered_requirement_items(rule_file_content, current_sample) {
        if (!rule_file_content || !current_sample) return [];
        const ordered_keys = this.AuditLogic.get_ordered_relevant_requirement_keys(
            rule_file_content,
            current_sample,
            'default'
        );
        if (!ordered_keys || ordered_keys.length === 0) return [];

        const filters = this.filters_by_mode.sample_requirements || this.get_current_filters();
        const search_term = (filters.searchText || '').toLowerCase().trim();
        const status_filters = filters.status || {};
        const has_status_filters = Object.keys(status_filters).length > 0;

        const requirement_needs_help_fn = this.AuditLogic?.requirement_needs_help || (() => false);

        const filtered_items = ordered_keys
            .map(req_key => {
                const requirement = rule_file_content?.requirements?.[req_key];
                if (!requirement) return null;
                const req_result = current_sample.requirementResults?.[req_key];
                const display_status = this.get_display_status(requirement, req_result);
                const needs_help = requirement_needs_help_fn(req_result);
                return {
                    req_key,
                    requirement,
                    req_result,
                    display_status,
                    needs_help,
                    link_text: requirement.title || this.Translation.t('unknown_value', { val: req_key }),
                    ref_text: requirement.standardReference?.text || ''
                };
            })
            .filter(item => {
                if (!item) return false;
                const status_match = !has_status_filters || status_filters[item.display_status] === true;
                const needs_help_checked = status_filters.needs_help === true;
                const show_by_status = status_match || (needs_help_checked && item.needs_help);
                const hide_by_needs_help = status_filters.needs_help === false && item.needs_help;
                if (!show_by_status || hide_by_needs_help) return false;
                if (!search_term) return true;
                return this.get_searchable_text_for_requirement(item.requirement).includes(search_term);
            });

        return this.sort_requirement_items(filtered_items, filters.sortBy);
    },

    get_filtered_sample_items(rule_file_content, current_requirement, samples, requirement_id, current_sample_id) {
        if (!rule_file_content || !current_requirement || !Array.isArray(samples)) return [];
        const requirement_key = current_requirement?.key || requirement_id;
        const requirement_id_candidates = new Set(
            [requirement_key, current_requirement?.key, current_requirement?.id, requirement_id]
                .filter(val => val !== undefined && val !== null)
                .map(val => String(val))
        );
        const filters = this.filters_by_mode.requirement_samples || this.get_current_filters();
        const search_term = (filters.searchText || '').toLowerCase().trim();
        const status_filters = filters.status || {};
        const has_status_filters = Object.keys(status_filters).length > 0;

        // Skapa en map för att hålla koll på originalindex i samples-arrayen
        const sample_index_map = new Map();
        samples.forEach((sample, index) => {
            if (sample && sample.id) {
                sample_index_map.set(sample.id, index);
            }
        });

        const matching_samples = samples
            .filter(sample => sample)
            .filter(sample => {
                if (current_sample_id && String(sample.id) === String(current_sample_id)) {
                    return true;
                }
                const result_keys = Object.keys(sample?.requirementResults || {});
                if (result_keys.some(key => requirement_id_candidates.has(String(key)))) return true;
                if (this.is_requirement_relevant_for_sample(current_requirement, sample)) return true;
                const relevant_requirements = this.AuditLogic.get_relevant_requirements_for_sample(rule_file_content, sample);
                return (relevant_requirements || []).some(req => {
                    const req_id = req?.key || req?.id;
                    return req_id !== undefined && requirement_id_candidates.has(String(req_id));
                });
            })
            .map(sample => {
                const req_result = sample?.requirementResults?.[requirement_key]
                    || sample?.requirementResults?.[current_requirement?.key]
                    || sample?.requirementResults?.[current_requirement?.id]
                    || sample?.requirementResults?.[requirement_id];
                const display_status = this.get_display_status(current_requirement, req_result);
                const needs_help = (this.AuditLogic?.requirement_needs_help || (() => false))(req_result);
                const original_index = sample_index_map.get(sample.id) ?? Infinity;
                return {
                    sample,
                    display_status,
                    needs_help,
                    link_text: sample?.description || this.Translation.t('undefined_description'),
                    original_index
                };
            })
            .filter(item => {
                const status_match = !has_status_filters || status_filters[item.display_status] === true;
                const needs_help_checked = status_filters.needs_help === true;
                const show_by_status = status_match || (needs_help_checked && item.needs_help);
                const hide_by_needs_help = status_filters.needs_help === false && item.needs_help;
                if (!show_by_status || hide_by_needs_help) return false;
                if (!search_term) return true;
                const text = (item.sample?.description || '').toLowerCase();
                return text.includes(search_term);
            });

        return this.sort_sample_items(matching_samples, filters.sortBy, current_requirement, rule_file_content);
    },

    is_requirement_relevant_for_sample(requirement, sample) {
        if (!requirement || !sample) return false;
        const selected_types = sample.selectedContentTypes;
        if (!Array.isArray(selected_types) || selected_types.length === 0) return true;
        const req_types = requirement.contentType;
        if (!Array.isArray(req_types) || req_types.length === 0) return true;
        return req_types.some(ct => selected_types.includes(ct));
    },

    get_navigation_payload(options) {
        if (!options) return null;
        return {
            mode: this.selected_mode,
            requirement_items: this.get_filtered_requirement_items(options.rule_file_content, options.current_sample),
            sample_items: this.get_filtered_sample_items(
                options.rule_file_content,
                options.current_requirement,
                options.samples || [],
                options.requirement_id,
                options.current_sample?.id
            )
        };
    },

    notify_filters_changed() {
        if (typeof this.on_filters_change_callback !== 'function') return;
        if (!this.last_render_options) return;
        const payload = this.get_navigation_payload(this.last_render_options);
        if (payload) {
            this.on_filters_change_callback(payload);
        }
    },

    load_settings_from_state() {
        if (!this.getState) return;
        const state = this.getState();
        const sidebar_settings = state?.uiSettings?.requirementAuditSidebar;
        
        if (sidebar_settings) {
            if (sidebar_settings.selectedMode) {
                this.selected_mode = sidebar_settings.selectedMode;
            }
            if (sidebar_settings.filtersByMode) {
                // Merga sparade filter med default-värden
                if (sidebar_settings.filtersByMode.sample_requirements) {
                    this.filters_by_mode.sample_requirements = {
                        ...this.filters_by_mode.sample_requirements,
                        ...sidebar_settings.filtersByMode.sample_requirements
                    };
                }
                if (sidebar_settings.filtersByMode.requirement_samples) {
                    this.filters_by_mode.requirement_samples = {
                        ...this.filters_by_mode.requirement_samples,
                        ...sidebar_settings.filtersByMode.requirement_samples
                    };
                }
            }
        }
    },

    save_settings_to_state() {
        if (!this.dispatch || !this.StoreActionTypes) return;
        
        this.dispatch({
            type: this.StoreActionTypes.SET_REQUIREMENT_AUDIT_SIDEBAR_SETTINGS,
            payload: {
                selectedMode: this.selected_mode,
                filtersByMode: {
                    sample_requirements: { ...this.filters_by_mode.sample_requirements },
                    requirement_samples: { ...this.filters_by_mode.requirement_samples }
                }
            }
        });
    },

    get_display_status(requirement, requirement_result) {
        return requirement_result?.needsReview ? 'updated' : this.AuditLogic.calculate_requirement_status(requirement, requirement_result);
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

    get_searchable_text_for_requirement(requirement) {
        return get_searchable_text_util(requirement, { includeInfoBlocks: true });
    },

    get_active_status_filters(status_filters) {
        if (!status_filters || typeof status_filters !== 'object') return [];
        return Object.keys(status_filters).filter(key => status_filters[key]);
    },

    sort_requirement_items(items, sort_by) {
        const sorted = [...items];
        if (sort_by === 'title_asc') {
            sorted.sort((a, b) => (a.requirement.title || '').localeCompare(b.requirement.title || '', 'sv', { numeric: true, sensitivity: 'base' }));
        } else if (sort_by === 'title_desc') {
            sorted.sort((a, b) => (b.requirement.title || '').localeCompare(a.requirement.title || '', 'sv', { numeric: true, sensitivity: 'base' }));
        } else if (sort_by === 'ref_desc') {
            sorted.sort((a, b) => this.Helpers.natural_sort(b.requirement.standardReference?.text || 'Z', a.requirement.standardReference?.text || 'Z'));
        } else if (sort_by === 'updated_first') {
            sorted.sort((a, b) => {
                const a_updated = a.display_status === 'updated' ? 0 : 1;
                const b_updated = b.display_status === 'updated' ? 0 : 1;
                if (a_updated !== b_updated) return a_updated - b_updated;
                return this.Helpers.natural_sort(a.requirement.standardReference?.text || 'Z', b.requirement.standardReference?.text || 'Z');
            });
        } else {
            sorted.sort((a, b) => this.Helpers.natural_sort(a.requirement.standardReference?.text || 'Z', b.requirement.standardReference?.text || 'Z'));
        }
        return sorted;
    },

    sort_sample_items(items, sort_by, current_requirement, rule_file_content) {
        const sorted = [...items];
        
        if (sort_by === 'creation_order') {
            // Sortera efter originalindex (skapelseordning)
            sorted.sort((a, b) => {
                const index_a = a.original_index ?? Infinity;
                const index_b = b.original_index ?? Infinity;
                return index_a - index_b;
            });
        } else if (sort_by === 'sample_desc') {
            sorted.sort((a, b) => (b.sample?.description || '').localeCompare(a.sample?.description || '', 'sv', { numeric: true, sensitivity: 'base' }));
        } else if (sort_by === 'page_type_asc') {
            sorted.sort((a, b) => {
                const page_type_a = this.get_page_type_text(a.sample?.pageType, rule_file_content) || '';
                const page_type_b = this.get_page_type_text(b.sample?.pageType, rule_file_content) || '';
                if (page_type_a !== page_type_b) {
                    return page_type_a.localeCompare(page_type_b, 'sv', { numeric: true, sensitivity: 'base' });
                }
                // Om samma sidtyp, sortera efter beskrivning
                return (a.sample?.description || '').localeCompare(b.sample?.description || '', 'sv', { numeric: true, sensitivity: 'base' });
            });
        } else if (sort_by === 'page_type_desc') {
            sorted.sort((a, b) => {
                const page_type_a = this.get_page_type_text(a.sample?.pageType, rule_file_content) || '';
                const page_type_b = this.get_page_type_text(b.sample?.pageType, rule_file_content) || '';
                if (page_type_a !== page_type_b) {
                    return page_type_b.localeCompare(page_type_a, 'sv', { numeric: true, sensitivity: 'base' });
                }
                // Om samma sidtyp, sortera efter beskrivning
                return (a.sample?.description || '').localeCompare(b.sample?.description || '', 'sv', { numeric: true, sensitivity: 'base' });
            });
        } else {
            // Default: sample_asc - sortera efter beskrivning A-Ö
            sorted.sort((a, b) => (a.sample?.description || '').localeCompare(b.sample?.description || '', 'sv', { numeric: true, sensitivity: 'base' }));
        }
        return sorted;
    },

    get_page_type_text(page_type_id, rule_file_content) {
        if (!page_type_id || !rule_file_content) return '';
        const page_types = rule_file_content.metadata?.pageTypes || [];
        const page_type = page_types.find(pt => pt.id === page_type_id || pt === page_type_id);
        if (typeof page_type === 'string') return page_type;
        return page_type?.text || page_type?.id || '';
    },

    destroy() {
        if (this.root) {
            this.root.removeEventListener('click', this.handle_link_click);
            this.root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
        this.router = null;
        this.getState = null;
        this.Translation = null;
        this.Helpers = null;
        this.AuditLogic = null;
        this.on_filters_change_callback = null;
        this.is_dom_initialized = false;
        this.mode_fieldset_ref = null;
        this.mode_legend_ref = null;
        this.mode_label_refs = null;
        this.filter_container_ref = null;
        this.list_container_ref = null;
        this.heading_ref = null;
        this.filter_heading_ref = null;
        this.list_heading_ref = null;
        this.last_render_options = null;
        if (this.requirements_filter_component && typeof this.requirements_filter_component.destroy === 'function') {
            this.requirements_filter_component.destroy();
        }
        this.requirements_filter_component = null;
    }
};
