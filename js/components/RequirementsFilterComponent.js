// js/components/RequirementsFilterComponent.js
// Gemensam filterkomponent – samma som i högerspalten (Filtrera relaterade krav)

import { FilterPanelComponent } from './FilterPanelComponent.js';

export const RequirementsFilterComponent = {
    CSS_PATH: 'css/components/requirement_audit_sidebar_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.Translation = deps.Translation;
        this._search_debounce_timer = null;
        this.Helpers = deps.Helpers;
        this.get_current_filters = deps.getCurrentFilters;
        this.on_filter_change = deps.onFilterChange;
        this.get_sort_options = deps.getSortOptions || (() => deps.sortOptions || []);
        this.id_prefix = deps.idPrefix || 'requirements-filter';

        this._filter_container_ref = null;
        this._search_input_ref = null;
        this._sort_select_ref = null;

        this._handle_search_input = this._handle_search_input.bind(this);
        this._handle_sort_change = this._handle_sort_change.bind(this);

        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH, 'RequirementsFilterComponent').catch(() => {});
        } else if (this.Helpers?.load_css) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }

        this._build_dom();
    },

    _build_dom() {
        if (!this.root || !this.Helpers) return;

        this.root.innerHTML = '';
        const t = this.Translation.t;
        const search_id = `${this.id_prefix}-search`;
        const sort_id = `${this.id_prefix}-sort`;

        this._filter_container_ref = this.Helpers.create_element('div', { class_name: 'requirement-audit-sidebar__filters' });

        const search_group = this.Helpers.create_element('div', { class_name: 'requirement-audit-sidebar__filter-group' });
        const search_label = this.Helpers.create_element('label', {
            attributes: { for: search_id },
            text_content: t('requirement_audit_sidebar_search_label')
        });
        this._search_input_ref = this.Helpers.create_element('input', {
            id: search_id,
            class_name: 'form-control',
            attributes: { type: 'search' }
        });
        this._search_input_ref.addEventListener('input', this._handle_search_input);
        search_group.appendChild(search_label);
        search_group.appendChild(this._search_input_ref);
        this._filter_container_ref.appendChild(search_group);

        const status_group = this.Helpers.create_element('div', { class_name: 'requirement-audit-sidebar__filter-group' });
        const filter_button_id = `${this.id_prefix}-filter-button`;
        const status_label = this.Helpers.create_element('label', {
            attributes: { for: filter_button_id },
            text_content: t('filter_by_status_label')
        });
        status_group.appendChild(status_label);

        const current = this.get_current_filters ? this.get_current_filters() : {};
        FilterPanelComponent.init({
            root: status_group,
            deps: {
                idPrefix: this.id_prefix,
                Translation: { t: this.Translation.t },
                Helpers: { create_element: this.Helpers.create_element },
                onFilterChange: (new_filters) => {
                    if (this.on_filter_change) {
                        this.on_filter_change({ status: new_filters });
                    }
                }
            }
        });
        FilterPanelComponent.render({ filters: current.status || {} });
        this._filter_container_ref.appendChild(status_group);

        const sort_group = this.Helpers.create_element('div', { class_name: 'requirement-audit-sidebar__filter-group' });
        const sort_label = this.Helpers.create_element('label', {
            attributes: { for: sort_id },
            text_content: t('requirement_audit_sidebar_sort_label')
        });
        this._sort_select_ref = this.Helpers.create_element('select', {
            id: sort_id,
            class_name: 'form-control'
        });
        this._sort_select_ref.addEventListener('change', this._handle_sort_change);
        const sort_options = typeof this.get_sort_options === 'function' ? this.get_sort_options() : [];
        sort_options.forEach(opt => {
            this._sort_select_ref.appendChild(this.Helpers.create_element('option', {
                value: opt.value,
                text_content: t(opt.textKey)
            }));
        });
        sort_group.appendChild(sort_label);
        sort_group.appendChild(this._sort_select_ref);
        this._filter_container_ref.appendChild(sort_group);

        this.root.appendChild(this._filter_container_ref);
    },

    _handle_search_input(event) {
        const value = event?.target?.value || '';
        if (this._search_debounce_timer) {
            clearTimeout(this._search_debounce_timer);
        }
        this._search_debounce_timer = setTimeout(() => {
            this._search_debounce_timer = null;
            if (this.on_filter_change) {
                this.on_filter_change({ searchText: value });
            }
        }, 400);
    },

    _handle_sort_change(event) {
        const value = event?.target?.value || '';
        if (this.on_filter_change) {
            this.on_filter_change({ sortBy: value });
        }
    },

    render() {
        if (!this.root || !this._filter_container_ref) return;

        const t = this.Translation.t;
        const current = this.get_current_filters ? this.get_current_filters() : {};
        const sort_options = typeof this.get_sort_options === 'function' ? this.get_sort_options() : [];
        const valid_sort = sort_options.some(opt => opt.value === current.sortBy);
        const sort_by = valid_sort ? current.sortBy : (sort_options[0]?.value || '');

        if (this._search_input_ref) {
            if (!this._search_debounce_timer) {
                this._search_input_ref.value = current.searchText || '';
            }
        }
        if (this._sort_select_ref) {
            this._sort_select_ref.innerHTML = '';
            sort_options.forEach(opt => {
                this._sort_select_ref.appendChild(this.Helpers.create_element('option', {
                    value: opt.value,
                    text_content: t(opt.textKey)
                }));
            });
            this._sort_select_ref.value = sort_by;
        }

        FilterPanelComponent.render({ filters: current.status || {} });
    },

    destroy() {
        if (this._search_debounce_timer) {
            clearTimeout(this._search_debounce_timer);
            this._search_debounce_timer = null;
        }
        if (this._search_input_ref) {
            this._search_input_ref.removeEventListener('input', this._handle_search_input);
            this._search_input_ref = null;
        }
        if (this._sort_select_ref) {
            this._sort_select_ref.removeEventListener('change', this._handle_sort_change);
            this._sort_select_ref = null;
        }
        FilterPanelComponent.destroy();
        if (this.root && this._filter_container_ref) {
            this.root.innerHTML = '';
        }
        this._filter_container_ref = null;
        this.root = null;
        this.deps = null;
    }
};
