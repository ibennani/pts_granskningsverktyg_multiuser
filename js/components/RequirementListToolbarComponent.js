import { FilterPanelComponent } from './FilterPanelComponent.js';
import "../../css/components/requirement_list_toolbar_component.css";

export const RequirementListToolbarComponent = {
    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.on_change_callback = deps.on_change;
        this.component_state = deps.initial_state;
        this.Translation_t = deps.Translation.t;
        this.Helpers_create_element = deps.Helpers.create_element;
        
        // Handle config – samma beteende som högerspalten (direkt sökning, ingen debounce)
        const _config = deps.config || {};
        this.component_config = {
            showStatusFilter: _config.showStatusFilter !== false,
            sortOptions: _config.sortOptions || [],
            searchDebounceMs: _config.searchDebounceMs ?? 0,  // 0 = direkt som högerspalten
            idPrefix: _config.idPrefix || deps.idPrefix || 'requirement-list-toolbar'
        };

        this.is_dom_built = false;
        
        // Bind methods
        this.handle_search_input = this.handle_search_input.bind(this);
        this.handle_sort_change = this.handle_sort_change.bind(this);
    },

    update_and_notify(new_partial_state) {
        this.component_state = { ...this.component_state, ...new_partial_state };
        if (this.on_change_callback) {
            this.on_change_callback(this.component_state);
        }
    },

    handle_search_input(event) {
        // Direkt uppdatering som standard (samma som högerspalten)
        const debounce_ms = this.component_config?.searchDebounceMs ?? 0;
        if (debounce_ms <= 0) {
            this.update_and_notify({ searchText: event.target.value });
            return;
        }
        if (this._search_debounce_timer) {
            clearTimeout(this._search_debounce_timer);
        }
        this._search_debounce_timer = setTimeout(() => {
            this._search_debounce_timer = null;
            this.update_and_notify({ searchText: event.target.value });
        }, debounce_ms);
    },

    handle_sort_change(event) {
        this.update_and_notify({ sortBy: event.target.value });
    },
    
    initial_build() {
        this.root.innerHTML = '';
        const t = this.Translation_t;
        const toolbar = this.Helpers_create_element('div', { class_name: 'requirements-list-toolbar' });

        // Search Group
        const search_group = this.Helpers_create_element('div', { class_name: 'toolbar-group search-group' });
        const search_label = this.Helpers_create_element('label', { attributes: { for: 'req-list-search' }, text_content: t('search_in_help_texts_label') });
        search_group.appendChild(search_label);
        const search_input = this.Helpers_create_element('input', { id: 'req-list-search', class_name: 'form-control', attributes: { type: 'search' } });
        if (window.MemoryManager) {
            window.MemoryManager.addEventListener(search_input, 'input', this.handle_search_input);
        } else {
            search_input.addEventListener('input', this.handle_search_input);
        }
        search_group.appendChild(search_input);
        toolbar.appendChild(search_group);

        // Filter Group
        if (this.component_config.showStatusFilter) {
            const id_prefix = this.component_config.idPrefix;
            const filter_button_id = `${id_prefix}-filter-button`;
            const filter_group = this.Helpers_create_element('div', { class_name: 'toolbar-group status-filter-group' });
            const filter_label = this.Helpers_create_element('label', {
                attributes: { for: filter_button_id },
                text_content: t('filter_by_status_label')
            });
            filter_group.appendChild(filter_label);

            FilterPanelComponent.init({
                root: filter_group,
                deps: {
                    idPrefix: id_prefix,
                    Translation: { t: this.Translation_t },
                    Helpers: { create_element: this.Helpers_create_element },
                    onFilterChange: (newFilters) => {
                        this.update_and_notify({ status: newFilters });
                    }
                }
            });
            
            toolbar.appendChild(filter_group);
        }
        
        // Sort Group
        if (this.component_config.sortOptions && this.component_config.sortOptions.length > 0) {
            const sort_group = this.Helpers_create_element('div', { class_name: 'toolbar-group sort-group' });
            const sort_label = this.Helpers_create_element('label', { attributes: { for: 'req-list-sort' }, text_content: t('sort_by_label') });
            sort_group.appendChild(sort_label);
            const sort_select = this.Helpers_create_element('select', { id: 'req-list-sort', class_name: 'form-control' });
            
            this.component_config.sortOptions.forEach(opt => {
                sort_select.appendChild(this.Helpers_create_element('option', {
                    value: opt.value,
                    text_content: t(opt.textKey)
                }));
            });

            if (window.MemoryManager) {
                window.MemoryManager.addEventListener(sort_select, 'change', this.handle_sort_change);
            } else {
                sort_select.addEventListener('change', this.handle_sort_change);
            }
            sort_group.appendChild(sort_select);
            toolbar.appendChild(sort_group);
        }
        
        this.root.appendChild(toolbar);
        this.is_dom_built = true;
    },
    
    update_values() {
        const t = this.Translation_t;
        
        const searchInput = this.root.querySelector('#req-list-search');
        if (searchInput && !this._search_debounce_timer) {
            searchInput.value = this.component_state.searchText;
        }
        
        const sortSelect = this.root.querySelector('#req-list-sort');
        if (sortSelect) {
            sortSelect.value = this.component_state.sortBy;
        }

        if (this.component_config.showStatusFilter) {
            FilterPanelComponent.render({
                filters: this.component_state.status
            });
        }
    },

    render(new_state = null) {
        if (new_state) {
            this.component_state = new_state;
        }

        if (!this.root || !this.Helpers_create_element || !this.Translation_t || !this.component_state) {
            if (window.ConsoleManager) {
                window.ConsoleManager.error("ToolbarComponent: Cannot render, core dependencies missing.");
            }
            return;
        }

        if (!this.is_dom_built) {
            this.initial_build();
        }
        
        // Always update all text elements when rendering (for language changes)
        const t = this.Translation_t;
        
        // Update search label
        const search_label = this.root.querySelector('label[for="req-list-search"]');
        if (search_label) {
            search_label.textContent = t('search_in_help_texts_label');
        }
        
        // Update filter label
        if (this.component_config.showStatusFilter) {
            const filter_label = this.root.querySelector('.status-filter-group label');
            if (filter_label) {
                filter_label.textContent = t('filter_by_status_label');
            }
        }
        
        // Update sort label and options
        if (this.component_config.sortOptions && this.component_config.sortOptions.length > 0) {
            const sort_label = this.root.querySelector('label[for="req-list-sort"]');
            if (sort_label) {
                sort_label.textContent = t('sort_by_label');
            }
            
            const sort_select = this.root.querySelector('#req-list-sort');
            if (sort_select) {
                // Save current value
                const currentVal = sort_select.value;
                // Update sort options texts
                sort_select.innerHTML = '';
                this.component_config.sortOptions.forEach(opt => {
                    sort_select.appendChild(this.Helpers_create_element('option', {
                        value: opt.value,
                        text_content: t(opt.textKey)
                    }));
                });
                sort_select.value = currentVal;
            }
        }

        this.update_values();
    },

    destroy() {
        if (this._search_debounce_timer) {
            clearTimeout(this._search_debounce_timer);
            this._search_debounce_timer = null;
        }
        if (this.component_config && this.component_config.showStatusFilter) {
            FilterPanelComponent.destroy();
        }
        
        if (this.root) this.root.innerHTML = '';
        this.is_dom_built = false;
        this.root = null;
        this.on_change_callback = null;
        this.deps = null;
    }
};
