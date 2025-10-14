// js/components/RequirementListToolbarComponent.js
export const RequirementListToolbarComponent = (function () {
    'use-strict';

    const CSS_PATH = 'css/components/requirement_list_toolbar_component.css';
    let container_ref;
    
    let on_change_callback;
    let component_state;
    let Translation_t;
    let Helpers_create_element;
    let Helpers_load_css;

    let component_config;

    let search_debounce_timer;

    let filter_button_ref;
    let filter_panel_ref;
    
    let handle_panel_keydown_ref = null;
    let close_on_outside_click_ref = null;
    
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
                console.warn("Failed to load CSS for RequirementListToolbarComponent:", error);
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
        clearTimeout(search_debounce_timer);
        search_debounce_timer = setTimeout(() => {
            update_and_notify({ searchText: event.target.value });
        }, 300);
    }

    function handle_status_filter_change(event) {
        const new_status_filters = { ...component_state.status };
        const all_checkbox = filter_panel_ref.querySelector('input[data-status="all"]');
        const status_checkboxes = filter_panel_ref.querySelectorAll('input[data-status]:not([data-status="all"])');

        if (event.target === all_checkbox) {
            const is_checked = all_checkbox.checked;
            status_checkboxes.forEach(cb => { new_status_filters[cb.dataset.status] = is_checked; });
        } else {
            new_status_filters[event.target.dataset.status] = event.target.checked;
        }
        
        update_and_notify({ status: new_status_filters });
    }

    function handle_sort_change(event) {
        update_and_notify({ sortBy: event.target.value });
    }
    
    function close_filter_panel(focus_button = true) {
        if (filter_panel_ref && filter_panel_ref.classList.contains('is-visible')) {
            filter_panel_ref.classList.remove('is-visible');
            
            if (handle_panel_keydown_ref) {
                document.removeEventListener('keydown', handle_panel_keydown_ref);
                handle_panel_keydown_ref = null;
            }
            if (close_on_outside_click_ref) {
                document.removeEventListener('click', close_on_outside_click_ref);
                close_on_outside_click_ref = null;
            }
            if (focus_button && filter_button_ref) {
                filter_button_ref.focus();
            }
        }
    }

    function open_filter_panel() {
        if (filter_panel_ref && !filter_panel_ref.classList.contains('is-visible')) {
            filter_panel_ref.classList.add('is-visible');
            const first_checkbox = filter_panel_ref.querySelector('input[type="checkbox"]');
            first_checkbox?.focus();
            
            handle_panel_keydown_ref = (e) => handle_panel_keydown(e);
            close_on_outside_click_ref = (e) => {
                if (!filter_panel_ref.contains(e.target) && !filter_button_ref.contains(e.target)) {
                    close_filter_panel();
                }
            };
            document.addEventListener('keydown', handle_panel_keydown_ref);
            document.addEventListener('click', close_on_outside_click_ref, { capture: true });
        }
    }

    function toggle_filter_panel(event) {
        event.stopPropagation();
        if (filter_panel_ref?.classList.contains('is-visible')) {
            close_filter_panel();
        } else {
            open_filter_panel();
        }
    }

    function handle_panel_keydown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            close_filter_panel();
            return;
        }

        if (event.key === 'Tab' && filter_panel_ref) {
            const focusable_elements = Array.from(filter_panel_ref.querySelectorAll('input[type="checkbox"]'));
            if (focusable_elements.length === 0) return;

            const first_element = focusable_elements[0];
            const last_element = focusable_elements[focusable_elements.length - 1];

            if (event.shiftKey && document.activeElement === first_element) {
                close_filter_panel(false); 
            } else if (!event.shiftKey && document.activeElement === last_element) {
                close_filter_panel(false);
            }
        }
    }

    function initial_build() {
        container_ref.innerHTML = '';
        const t = Translation_t;
        const toolbar = Helpers_create_element('div', { class_name: 'requirements-list-toolbar' });

        const search_group = Helpers_create_element('div', { class_name: 'toolbar-group search-group' });
        const search_label = Helpers_create_element('label', { attributes: { for: 'req-list-search' }, text_content: t('search_in_help_texts_label') });
        search_group.appendChild(search_label);
        const search_input = Helpers_create_element('input', { id: 'req-list-search', class_name: 'form-control', attributes: { type: 'search' } });
        search_input.addEventListener('input', handle_search_input);
        search_group.appendChild(search_input);
        toolbar.appendChild(search_group);

        if (component_config.showStatusFilter) {
            const filter_group = Helpers_create_element('div', { class_name: 'toolbar-group status-filter-group' });
            const filter_label = Helpers_create_element('label', { text_content: t('filter_by_status_label') });
            filter_group.appendChild(filter_label);
            filter_button_ref = Helpers_create_element('button', { id: 'status-filter-toggle-btn', class_name: 'button button-default' });
            filter_button_ref.addEventListener('click', toggle_filter_panel);
            filter_panel_ref = Helpers_create_element('div', { id: 'status-filter-panel-smv', class_name: 'status-filter-panel' });
            filter_panel_ref.addEventListener('change', handle_status_filter_change);
            filter_group.append(filter_button_ref, filter_panel_ref);
            toolbar.appendChild(filter_group);
        }
        
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

            sort_select.addEventListener('change', handle_sort_change);
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

        if (component_config.showStatusFilter && filter_panel_ref && filter_button_ref) {
            filter_button_ref.textContent = t('status_filter_button_text');

            const status_types = ['passed', 'failed', 'partially_audited', 'not_audited', 'updated'];
            const all_individual_checked = status_types.every(status => component_state.status[status]);

            if (filter_panel_ref.querySelector('#status-filter-all')) {
                filter_panel_ref.querySelector('#status-filter-all').checked = all_individual_checked;
                status_types.forEach(status => {
                    if (filter_panel_ref.querySelector(`#status-filter-${status}`)) {
                        filter_panel_ref.querySelector(`#status-filter-${status}`).checked = component_state.status[status];
                    }
                });
            }
        }
    }

    // --- START OF CHANGE: render can now accept new state ---
    function render(new_state = null) {
        if (new_state) {
            component_state = new_state;
        }
        // --- END OF CHANGE ---

        if (!container_ref || !Helpers_create_element || !Translation_t || !component_state) {
            console.error("ToolbarComponent: Cannot render, core dependencies missing.");
            return;
        }

        if (!is_dom_built) {
            initial_build();
            const t = Translation_t;
            
            if (component_config.showStatusFilter && filter_panel_ref) {
                filter_panel_ref.innerHTML = `
                    <div class="form-check all-check">
                        <input id="status-filter-all" class="form-check-input" type="checkbox" data-status="all">
                        <label for="status-filter-all">${t('show_all')}</label>
                    </div>
                    <hr>
                    <div class="form-check">
                        <input id="status-filter-passed" class="form-check-input" type="checkbox" data-status="passed">
                        <label for="status-filter-passed">${t('audit_status_passed')}</label>
                    </div>
                    <div class="form-check">
                        <input id="status-filter-failed" class="form-check-input" type="checkbox" data-status="failed">
                        <label for="status-filter-failed">${t('audit_status_failed')}</label>
                    </div>
                    <div class="form-check">
                        <input id="status-filter-partially_audited" class="form-check-input" type="checkbox" data-status="partially_audited">
                        <label for="status-filter-partially_audited">${t('audit_status_partially_audited')}</label>
                    </div>
                    <div class="form-check">
                        <input id="status-filter-not_audited" class="form-check-input" type="checkbox" data-status="not_audited">
                        <label for="status-filter-not_audited">${t('audit_status_not_audited')}</label>
                    </div>
                    <div class="form-check">
                        <input id="status-filter-updated" class="form-check-input" type="checkbox" data-status="updated">
                        <label for="status-filter-updated">${t('filter_option_updated')}</label>
                    </div>
                `;
            }
        }

        update_values();
    }

    function destroy() {
        clearTimeout(search_debounce_timer);
        close_filter_panel();
        
        // Rensa document-level event listeners
        if (handle_panel_keydown_ref) {
            document.removeEventListener('keydown', handle_panel_keydown_ref);
            handle_panel_keydown_ref = null;
        }
        if (close_on_outside_click_ref) {
            document.removeEventListener('click', close_on_outside_click_ref, { capture: true });
            close_on_outside_click_ref = null;
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
