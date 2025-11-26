// js/components/RequirementListToolbarComponent.js
import { FilterPanelComponent } from './FilterPanelComponent.js';

export const RequirementListToolbarComponent = (function () {
    'use-strict';

    const CSS_PATH = './css/components/requirement_list_toolbar_component.css';
    let container_ref;
    
    let on_change_callback;
    let component_state;
    let Translation_t;
    let Helpers_create_element;
    let Helpers_load_css;

    let component_config;

    let search_debounce_timer;
    
    let is_dom_built = false;

    async function init(_container, _on_change_cb, _initial_state, _Translation, _Helpers, _config = {}) {
        container_ref = _container;
        on_change_callback = _on_change_cb;
        component_state = _initial_state;
        
        Translation_t = _Translation.t;
        Helpers_create_element = _Helpers.create_element;
        Helpers_load_css = _Helpers.load_css;

        component_config = {
            showStatusFilter: _config.showStatusFilter !== false,
            sortOptions: _config.sortOptions || []
        };

        is_dom_built = false;

        if (Helpers_load_css && CSS_PATH) {
            try {
                const link_tag = document.querySelector(`link[href="${CSS_PATH}"]`);
                if (!link_tag) await Helpers_load_css(CSS_PATH);
            } catch (error) {
                if (window.ConsoleManager) {
                    window.ConsoleManager.warn("Failed to load CSS for RequirementListToolbarComponent:", error);
                }
            }
        }
    }

    function update_and_notify(new_partial_state) {
        component_state = { ...component_state, ...new_partial_state };
        if (on_change_callback) {
            on_change_callback(component_state);
        }
    }

    function handle_search_input(event) {
        if (window.MemoryManager) {
            window.MemoryManager.clearTimeout(search_debounce_timer);
            search_debounce_timer = window.MemoryManager.setTimeout(() => {
                update_and_notify({ searchText: event.target.value });
            }, 300);
        } else {
            clearTimeout(search_debounce_timer);
            search_debounce_timer = setTimeout(() => {
                update_and_notify({ searchText: event.target.value });
            }, 300);
        }
    }

    function handle_sort_change(event) {
        update_and_notify({ sortBy: event.target.value });
    }
    
    function initial_build() {
        container_ref.innerHTML = '';
        const t = Translation_t;
        const toolbar = Helpers_create_element('div', { class_name: 'requirements-list-toolbar' });

        // Search Group
        const search_group = Helpers_create_element('div', { class_name: 'toolbar-group search-group' });
        const search_label = Helpers_create_element('label', { attributes: { for: 'req-list-search' }, text_content: t('search_in_help_texts_label') });
        search_group.appendChild(search_label);
        const search_input = Helpers_create_element('input', { id: 'req-list-search', class_name: 'form-control', attributes: { type: 'search' } });
        if (window.MemoryManager) {
            window.MemoryManager.addEventListener(search_input, 'input', handle_search_input);
        } else {
            search_input.addEventListener('input', handle_search_input);
        }
        search_group.appendChild(search_input);
        toolbar.appendChild(search_group);

        // Filter Group
        if (component_config.showStatusFilter) {
            const filter_group = Helpers_create_element('div', { class_name: 'toolbar-group status-filter-group' });
            const filter_label = Helpers_create_element('label', { text_content: t('filter_by_status_label') });
            filter_group.appendChild(filter_label);
            
            // Initialize FilterPanelComponent attached to filter_group
            FilterPanelComponent.init({
                root: filter_group,
                deps: {
                    Translation: { t: Translation_t },
                    Helpers: { create_element: Helpers_create_element },
                    onFilterChange: (newFilters) => {
                        update_and_notify({ status: newFilters });
                    }
                }
            });
            
            toolbar.appendChild(filter_group);
        }
        
        // Sort Group
        if (component_config.sortOptions && component_config.sortOptions.length > 0) {
            const sort_group = Helpers_create_element('div', { class_name: 'toolbar-group sort-group' });
            const sort_label = Helpers_create_element('label', { attributes: { for: 'req-list-sort' }, text_content: t('sort_by_label') });
            sort_group.appendChild(sort_label);
            const sort_select = Helpers_create_element('select', { id: 'req-list-sort', class_name: 'form-control' });
            
            component_config.sortOptions.forEach(opt => {
                sort_select.appendChild(Helpers_create_element('option', {
                    value: opt.value,
                    text_content: t(opt.textKey)
                }));
            });

            if (window.MemoryManager) {
                window.MemoryManager.addEventListener(sort_select, 'change', handle_sort_change);
            } else {
                sort_select.addEventListener('change', handle_sort_change);
            }
            sort_group.appendChild(sort_select);
            toolbar.appendChild(sort_group);
        }
        
        container_ref.appendChild(toolbar);
        is_dom_built = true;
    }
    
    function update_values() {
        const t = Translation_t;
        
        container_ref.querySelector('#req-list-search').value = component_state.searchText;
        
        const sortSelect = container_ref.querySelector('#req-list-sort');
        if (sortSelect) {
            sortSelect.value = component_state.sortBy;
        }

        if (component_config.showStatusFilter) {
            FilterPanelComponent.render({
                filters: component_state.status
            });
        }
    }

    function render(new_state = null) {
        if (new_state) {
            component_state = new_state;
        }

        if (!container_ref || !Helpers_create_element || !Translation_t || !component_state) {
            if (window.ConsoleManager) {
                window.ConsoleManager.error("ToolbarComponent: Cannot render, core dependencies missing.");
            }
            return;
        }

        if (!is_dom_built) {
            initial_build();
        }
        
        // Always update all text elements when rendering (for language changes)
        const t = Translation_t;
        
        // Update search label
        const search_label = container_ref.querySelector('label[for="req-list-search"]');
        if (search_label) {
            search_label.textContent = t('search_in_help_texts_label');
        }
        
        // Update filter label
        if (component_config.showStatusFilter) {
            const filter_label = container_ref.querySelector('.status-filter-group label');
            if (filter_label) {
                filter_label.textContent = t('filter_by_status_label');
            }
            // FilterPanelComponent handles its own text updates in its render
        }
        
        // Update sort label and options
        if (component_config.sortOptions && component_config.sortOptions.length > 0) {
            const sort_label = container_ref.querySelector('label[for="req-list-sort"]');
            if (sort_label) {
                sort_label.textContent = t('sort_by_label');
            }
            
            const sort_select = container_ref.querySelector('#req-list-sort');
            if (sort_select) {
                // Save current value
                const currentVal = sort_select.value;
                // Update sort options texts
                sort_select.innerHTML = '';
                component_config.sortOptions.forEach(opt => {
                    sort_select.appendChild(Helpers_create_element('option', {
                        value: opt.value,
                        text_content: t(opt.textKey)
                    }));
                });
                sort_select.value = currentVal;
            }
        }

        update_values();
    }

    function destroy() {
        clearTimeout(search_debounce_timer);
        
        if (component_config.showStatusFilter) {
            FilterPanelComponent.destroy();
        }
        
        if (container_ref) container_ref.innerHTML = '';
        is_dom_built = false;
        container_ref = null;
        on_change_callback = null;
    }

    return {
        init,
        render,
        destroy
    };
})();
