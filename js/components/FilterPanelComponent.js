import "./FilterPanelComponent.css";

export const FilterPanelComponent = {
    init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.state = {
            isOpen: false,
            filters: {}
        };
        
        // Setup internal references
        this._elements = {
            wrapper: null,
            button: null,
            panel: null,
            checkboxes: {}
        };

        this._boundHandlers = {
            onToggle: this._handleToggle.bind(this),
            onDocumentClick: this._handleDocumentClick.bind(this),
            onDocumentKeydown: this._handleDocumentKeydown.bind(this),
            onFilterChange: this._handleFilterChange.bind(this)
        };

        // Initial DOM setup
        this._buildDom();
    },

    render(state) {
        if (state) {
            // Update internal state if provided
            this.state = { ...this.state, ...state };
        }

        const { t } = this.deps.Translation;

        // Update Button Text
        if (this._elements.button) {
            this._elements.button.textContent = t('status_filter_button_text');
            this._elements.button.setAttribute('aria-expanded', this.state.isOpen);
        }

        // Update Panel Visibility
        if (this._elements.panel) {
            if (this.state.isOpen) {
                this._elements.panel.classList.add('FilterPanelComponent__panel--visible');
                // Add global listeners when open
                document.addEventListener('click', this._boundHandlers.onDocumentClick, true);
                document.addEventListener('keydown', this._boundHandlers.onDocumentKeydown);
            } else {
                this._elements.panel.classList.remove('FilterPanelComponent__panel--visible');
                // Remove global listeners when closed
                document.removeEventListener('click', this._boundHandlers.onDocumentClick, true);
                document.removeEventListener('keydown', this._boundHandlers.onDocumentKeydown);
            }
        }

        // Update Checkboxes
        this._updateCheckboxes();
    },

    destroy() {
        // Remove global listeners
        document.removeEventListener('click', this._boundHandlers.onDocumentClick, true);
        document.removeEventListener('keydown', this._boundHandlers.onDocumentKeydown);

        // Remove DOM events (handled by GC if we remove elements, but good practice to be explicit if we stored references)
        // Since we bound them to elements which we are removing, it should be fine.
        
        if (this.root && this._elements.wrapper) {
            this.root.removeChild(this._elements.wrapper);
        }

        this._elements = {};
        this._boundHandlers = {};
        this.root = null;
        this.deps = null;
    },

    _buildDom() {
        const { Helpers, Translation } = this.deps;
        const t = Translation.t;

        // Wrapper
        this._elements.wrapper = Helpers.create_element('div', { 
            class_name: 'FilterPanelComponent' 
        });

        // Label (optional, maybe outside? RequirementListToolbar had it outside)
        // But for accessibility it's good to have it.
        // The toolbar had a label separate from the button group. I'll stick to what the toolbar expects: just the button and panel.
        
        // Toggle Button
        this._elements.button = Helpers.create_element('button', { 
            class_name: 'button button-default FilterPanelComponent__toggle',
            attributes: { 
                'aria-haspopup': 'true',
                'aria-expanded': 'false'
            },
            text_content: t('status_filter_button_text')
        });
        this._elements.button.addEventListener('click', this._boundHandlers.onToggle);
        this._elements.wrapper.appendChild(this._elements.button);

        // Panel
        this._elements.panel = Helpers.create_element('div', { 
            class_name: 'FilterPanelComponent__panel'
        });
        
        // Build Checkboxes content
        this._buildPanelContent();
        
        this._elements.wrapper.appendChild(this._elements.panel);
        
        if (this.root) {
            this.root.appendChild(this._elements.wrapper);
        }
    },

    _buildPanelContent() {
        const { Helpers, Translation } = this.deps;
        const t = Translation.t;
        const panel = this._elements.panel;

        // "Show All" Checkbox
        const allWrapper = Helpers.create_element('div', { class_name: 'form-check FilterPanelComponent__item FilterPanelComponent__item--all' });
        const allInput = Helpers.create_element('input', { 
            class_name: 'form-check-input', 
            id: 'filter-panel-all',
            attributes: { type: 'checkbox', 'data-status': 'all' } 
        });
        const allLabel = Helpers.create_element('label', { 
            attributes: { for: 'filter-panel-all' },
            text_content: t('show_all')
        });
        allWrapper.append(allInput, allLabel);
        panel.appendChild(allWrapper);
        this._elements.checkboxes['all'] = allInput;

        // Separator
        panel.appendChild(Helpers.create_element('hr', { class_name: 'FilterPanelComponent__separator' }));

        // Individual Statuses
        const statuses = ['passed', 'failed', 'partially_audited', 'not_audited', 'updated'];
        
        statuses.forEach(status => {
            const wrapper = Helpers.create_element('div', { class_name: 'form-check FilterPanelComponent__item' });
            const input = Helpers.create_element('input', { 
                class_name: 'form-check-input', 
                id: `filter-panel-${status}`,
                attributes: { type: 'checkbox', 'data-status': status } 
            });
            
            // Get text key based on status
            let textKey = `audit_status_${status}`;
            if (status === 'updated') textKey = 'filter_option_updated';
            
            const label = Helpers.create_element('label', { 
                attributes: { for: `filter-panel-${status}` },
                text_content: t(textKey)
            });
            wrapper.append(input, label);
            panel.appendChild(wrapper);
            this._elements.checkboxes[status] = input;
        });

        // Delegate change event
        panel.addEventListener('change', this._boundHandlers.onFilterChange);
    },

    _updateCheckboxes() {
        const filters = this.state.filters || {};
        const checkboxes = this._elements.checkboxes;
        
        // Determine "All" state
        // "All" is checked if all individual statuses are checked
        const statusKeys = Object.keys(checkboxes).filter(k => k !== 'all');
        const allChecked = statusKeys.every(key => filters[key]);
        
        if (checkboxes['all']) {
            checkboxes['all'].checked = allChecked;
        }

        statusKeys.forEach(key => {
            if (checkboxes[key]) {
                checkboxes[key].checked = !!filters[key];
            }
        });
    },

    _handleToggle(e) {
        e.stopPropagation();
        this.state.isOpen = !this.state.isOpen;
        this.render(); // Re-render to update visibility and listeners
        
        if (this.state.isOpen) {
            // Focus first checkbox
            const firstCheckbox = this._elements.panel.querySelector('input');
            if (firstCheckbox) firstCheckbox.focus();
        }
    },

    _handleDocumentClick(e) {
        if (!this.state.isOpen) return;
        
        const wrapper = this._elements.wrapper;
        if (wrapper && !wrapper.contains(e.target)) {
            this.state.isOpen = false;
            this.render();
            // Focus back to button? RequirementListToolbar did.
            if (this._elements.button) this._elements.button.focus();
        }
    },

    _handleDocumentKeydown(e) {
        if (!this.state.isOpen) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            this.state.isOpen = false;
            this.render();
            if (this._elements.button) this._elements.button.focus();
        }
        
        // Tab trap logic could be added here if needed, consistent with previous component
        if (e.key === 'Tab') {
            const focusable = Array.from(this._elements.panel.querySelectorAll('input'));
            if (focusable.length === 0) return;
            
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            
            if (e.shiftKey && document.activeElement === first) {
                this.state.isOpen = false;
                this.render();
                if (this._elements.button) this._elements.button.focus();
                e.preventDefault(); // Prevent tabbing away? Or let it close and focus button (standard behavior is usually focus button then prev element)
            } else if (!e.shiftKey && document.activeElement === last) {
                this.state.isOpen = false;
                this.render();
                if (this._elements.button) this._elements.button.focus();
                e.preventDefault();
            }
        }
    },

    _handleFilterChange(e) {
        const target = e.target;
        if (target.type !== 'checkbox') return;

        const status = target.dataset.status;
        const isChecked = target.checked;
        const newFilters = { ...this.state.filters };
        
        if (status === 'all') {
            // Toggle all
            Object.keys(this._elements.checkboxes).forEach(key => {
                if (key !== 'all') {
                    newFilters[key] = isChecked;
                }
            });
        } else {
            newFilters[status] = isChecked;
        }

        this.state.filters = newFilters;
        this.render(); // Update UI (especially "All" checkbox)

        // Notify parent
        if (this.deps.onFilterChange) {
            this.deps.onFilterChange(newFilters);
        }
    }
};

