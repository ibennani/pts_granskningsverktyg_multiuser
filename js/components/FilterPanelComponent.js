import "./FilterPanelComponent.css";

const STATUS_KEYS = ['needs_help', 'passed', 'failed', 'partially_audited', 'not_audited', 'updated'];

export const FilterPanelComponent = {
    init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this._id_prefix = deps.idPrefix || 'filter-panel';
        this.state = {
            filters: {},
            isOpen: false
        };

        this._elements = {
            wrapper: null,
            toggleButton: null,
            panel: null,
            checkboxes: {}
        };

        this._boundHandlers = {
            onToggle: this._handleToggle.bind(this),
            onDocumentClick: this._handleDocumentClick.bind(this),
            onDocumentKeydown: this._handleDocumentKeydown.bind(this),
            onFilterChange: this._handleFilterChange.bind(this)
        };

        this._buildDom();
    },

    render(state) {
        if (state) {
            this.state = { ...this.state, ...state };
            if (state.filters && typeof state.filters === 'object') {
                if (this._last_dispatched_filters) {
                    this.state.filters = { ...this._last_dispatched_filters };
                } else {
                    this.state.filters = {};
                    STATUS_KEYS.forEach(key => {
                        this.state.filters[key] = state.filters[key] === true;
                    });
                }
            }
        }

        const { t } = this.deps.Translation;

        if (this._elements.toggleButton) {
            const labelSpan = this._elements.toggleButton.querySelector('.FilterPanelComponent__toggle-label');
            if (labelSpan) labelSpan.textContent = t('status_filter_button_text');
            const chevronSpan = this._elements.toggleButton.querySelector('.FilterPanelComponent__toggle-chevron');
            if (chevronSpan) chevronSpan.textContent = this.state.isOpen ? '▲' : '▼';
            this._elements.toggleButton.setAttribute('aria-expanded', this.state.isOpen);
        }

        if (this._elements.panel) {
            this._elements.panel.classList.toggle('FilterPanelComponent__panel--visible', this.state.isOpen);
            this._elements.panel.setAttribute('aria-hidden', this.state.isOpen ? 'false' : 'true');
            if (this.state.isOpen) {
                this._elements.panel.removeAttribute('inert');
                document.addEventListener('click', this._boundHandlers.onDocumentClick, true);
                document.addEventListener('keydown', this._boundHandlers.onDocumentKeydown);
            } else {
                this._elements.panel.setAttribute('inert', '');
                document.removeEventListener('click', this._boundHandlers.onDocumentClick, true);
                document.removeEventListener('keydown', this._boundHandlers.onDocumentKeydown);
            }
        }

        if (this._elements.panel) {
            this._elements.panel.querySelectorAll('label[data-text-key]').forEach(labelEl => {
                const key = labelEl.getAttribute('data-text-key');
                if (key) labelEl.textContent = t(key);
            });
        }

        this._updateCheckboxes();
    },

    destroy() {
        document.removeEventListener('click', this._boundHandlers.onDocumentClick, true);
        document.removeEventListener('keydown', this._boundHandlers.onDocumentKeydown);
        if (this.root && this._elements.wrapper) {
            this.root.removeChild(this._elements.wrapper);
        }

        this._elements = {};
        this._boundHandlers = {};
        this._last_dispatched_filters = null;
        this.root = null;
        this.deps = null;
    },

    _buildDom() {
        const { Helpers, Translation } = this.deps;
        const t = Translation.t;

        const panel_id = `${this._id_prefix}-filter-panel`;
        const button_id = `${this._id_prefix}-filter-button`;

        this._elements.wrapper = Helpers.create_element('div', {
            class_name: 'FilterPanelComponent'
        });

        this._elements.toggleButton = Helpers.create_element('button', {
            id: button_id,
            class_name: 'button button-default FilterPanelComponent__toggle',
            attributes: {
                type: 'button',
                'aria-expanded': 'false',
                'aria-controls': panel_id
            }
        });
        const labelSpan = Helpers.create_element('span', { class_name: 'FilterPanelComponent__toggle-label', text_content: t('status_filter_button_text') });
        const chevronSpan = Helpers.create_element('span', { class_name: 'FilterPanelComponent__toggle-chevron', attributes: { 'aria-hidden': 'true' }, text_content: '▼' });
        this._elements.toggleButton.appendChild(labelSpan);
        this._elements.toggleButton.appendChild(chevronSpan);
        this._elements.toggleButton.addEventListener('click', this._boundHandlers.onToggle);
        this._elements.wrapper.appendChild(this._elements.toggleButton);

        this._elements.panel = Helpers.create_element('div', {
            id: panel_id,
            class_name: 'FilterPanelComponent__panel',
            attributes: {
                'role': 'group',
                'aria-labelledby': button_id,
                'aria-hidden': 'true',
                'inert': ''
            }
        });

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
        const p = this._id_prefix;

        const allWrapper = Helpers.create_element('div', { class_name: 'form-check FilterPanelComponent__item FilterPanelComponent__item--all' });
        const allInput = Helpers.create_element('input', {
            class_name: 'form-check-input',
            id: `${p}-filter-all`,
            attributes: { type: 'checkbox', 'data-status': 'all' }
        });
        const allLabel = Helpers.create_element('label', {
            attributes: { for: `${p}-filter-all`, 'data-text-key': 'show_all' },
            text_content: t('show_all')
        });
        allWrapper.append(allInput, allLabel);
        panel.appendChild(allWrapper);
        this._elements.checkboxes['all'] = allInput;

        panel.appendChild(Helpers.create_element('hr', { class_name: 'FilterPanelComponent__separator' }));

        ['passed', 'failed', 'partially_audited', 'not_audited'].forEach(status => {
            const wrapper = Helpers.create_element('div', { class_name: 'form-check FilterPanelComponent__item' });
            const input = Helpers.create_element('input', {
                class_name: 'form-check-input',
                id: `${p}-filter-${status}`,
                attributes: { type: 'checkbox', 'data-status': status }
            });
            const label = Helpers.create_element('label', {
                attributes: { for: `${p}-filter-${status}`, 'data-text-key': `audit_status_${status}` },
                text_content: t(`audit_status_${status}`)
            });
            wrapper.append(input, label);
            panel.appendChild(wrapper);
            this._elements.checkboxes[status] = input;
        });

        panel.appendChild(Helpers.create_element('hr', { class_name: 'FilterPanelComponent__separator' }));

        const updatedWrapper = Helpers.create_element('div', { class_name: 'form-check FilterPanelComponent__item' });
        const updatedInput = Helpers.create_element('input', {
            class_name: 'form-check-input',
            id: `${p}-filter-updated`,
            attributes: { type: 'checkbox', 'data-status': 'updated' }
        });
        const updatedLabel = Helpers.create_element('label', {
            attributes: { for: `${p}-filter-updated`, 'data-text-key': 'filter_option_updated' },
            text_content: t('filter_option_updated')
        });
        updatedWrapper.append(updatedInput, updatedLabel);
        panel.appendChild(updatedWrapper);
        this._elements.checkboxes['updated'] = updatedInput;

        panel.appendChild(Helpers.create_element('hr', { class_name: 'FilterPanelComponent__separator' }));

        const needsHelpWrapper = Helpers.create_element('div', { class_name: 'form-check FilterPanelComponent__item FilterPanelComponent__item--needs-help' });
        const needsHelpInput = Helpers.create_element('input', {
            class_name: 'form-check-input',
            id: `${p}-filter-needs_help`,
            attributes: { type: 'checkbox', 'data-status': 'needs_help' }
        });
        const needsHelpLabel = Helpers.create_element('label', {
            attributes: { for: `${p}-filter-needs_help`, 'data-text-key': 'filter_option_needs_help' },
            text_content: t('filter_option_needs_help')
        });
        needsHelpWrapper.append(needsHelpInput, needsHelpLabel);
        panel.appendChild(needsHelpWrapper);
        this._elements.checkboxes['needs_help'] = needsHelpInput;

        panel.addEventListener('change', this._boundHandlers.onFilterChange);
    },

    _handleToggle(e) {
        e.stopPropagation();
        this.state.isOpen = !this.state.isOpen;
        this.render();
        if (this.state.isOpen) {
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
            if (this._elements.toggleButton) this._elements.toggleButton.focus();
        }
    },

    _handleDocumentKeydown(e) {
        if (!this.state.isOpen) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            this.state.isOpen = false;
            this.render();
            if (this._elements.toggleButton) this._elements.toggleButton.focus();
            return;
        }
        if (e.key === 'Tab') {
            const focusable = Array.from(this._elements.panel.querySelectorAll('input'));
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                this.state.isOpen = false;
                this.render();
                if (this._elements.toggleButton) this._elements.toggleButton.focus();
                e.preventDefault();
            } else if (!e.shiftKey && document.activeElement === last) {
                this.state.isOpen = false;
                this.render();
                if (this._elements.toggleButton) this._elements.toggleButton.focus();
                e.preventDefault();
            }
        }
    },

    _updateCheckboxes() {
        const filters = this.state.filters || {};
        const panel = this._elements.panel;
        if (!panel) return;

        panel.removeEventListener('change', this._boundHandlers.onFilterChange);

        const allChecked = STATUS_KEYS.every(key => filters[key] === true);
        const allInput = panel.querySelector('[data-status="all"]');
        if (allInput) {
            allInput.checked = allChecked;
        }

        STATUS_KEYS.forEach(key => {
            const input = panel.querySelector(`[data-status="${key}"]`);
            if (input) {
                input.checked = filters[key] === true;
            }
        });

        panel.addEventListener('change', this._boundHandlers.onFilterChange);
    },

    _handleFilterChange(e) {
        const target = e.target;
        if (target.type !== 'checkbox') return;

        const status = target.dataset.status;
        const isChecked = Boolean(target.checked);
        let newFilters;

        if (status === 'all') {
            newFilters = {};
            STATUS_KEYS.forEach(key => {
                newFilters[key] = isChecked;
            });
        } else {
            const panel = this._elements.panel;
            newFilters = {};
            STATUS_KEYS.forEach(key => {
                if (key === status) {
                    newFilters[key] = isChecked;
                } else {
                    const input = panel?.querySelector(`[data-status="${key}"]`);
                    newFilters[key] = input ? input.checked : (this.state.filters[key] === true);
                }
            });
        }

        this.state.filters = newFilters;
        this._last_dispatched_filters = { ...newFilters };
        this.render();

        if (this.deps.onFilterChange) {
            this.deps.onFilterChange(newFilters);
        }

        const filtersToApply = { ...newFilters };
        setTimeout(() => {
            setTimeout(() => {
                if (this._last_dispatched_filters && this._elements?.panel) {
                    this.state.filters = { ...filtersToApply };
                    this._updateCheckboxes();
                }
                this._last_dispatched_filters = null;
            }, 0);
        }, 0);
    }
};
