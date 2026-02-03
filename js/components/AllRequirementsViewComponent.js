import { RequirementListToolbarComponent } from './RequirementListToolbarComponent.js';

export const AllRequirementsViewComponent = {
    CSS_PATH: 'css/components/all_requirements_view_component.css',

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

        this.toolbar_component_instance = RequirementListToolbarComponent;
        this.toolbar_container_element = null;
        this.handle_toolbar_change = this.handle_toolbar_change.bind(this);

        this.is_dom_initialized = false;
        this.plate_element_ref = null;
        this.h1_element_ref = null;
        this.results_summary_element_ref = null;
        this.empty_message_element_ref = null;
        this.list_element_ref = null;

        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }
    },

    handle_toolbar_change(new_toolbar_state) {
        if (typeof this.dispatch !== 'function' || !this.StoreActionTypes) return;
        this.dispatch({
            type: this.StoreActionTypes.SET_ALL_REQUIREMENTS_FILTER_SETTINGS,
            payload: new_toolbar_state,
        });
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

    get_sort_options() {
        // Begränsad sortering för "Krav"-vyn (inte stickprovsspecifik)
        return [
            { value: 'default', textKey: 'sort_option_default' },
            { value: 'ref_asc', textKey: 'sort_option_ref_asc_natural' },
            { value: 'ref_desc', textKey: 'sort_option_ref_desc_natural' },
            { value: 'title_asc', textKey: 'sort_option_title_asc' },
            { value: 'title_desc', textKey: 'sort_option_title_desc' },
        ];
    },

    get_searchable_text_for_requirement(req) {
        const title = typeof req?.title === 'string' ? req.title : '';
        const std_ref_text = typeof req?.standardReference?.text === 'string' ? req.standardReference.text : '';
        const legacy_ref = typeof req?.reference === 'string' ? req.reference : '';
        return `${title} ${std_ref_text} ${legacy_ref}`.toLowerCase();
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

    ensure_dom_initialized() {
        if (!this.root) return false;

        // Om DOM redan finns och sitter kvar, gör inget.
        if (
            this.is_dom_initialized &&
            this.plate_element_ref &&
            this.root.contains(this.plate_element_ref) &&
            this.h1_element_ref &&
            this.results_summary_element_ref &&
            this.empty_message_element_ref &&
            this.list_element_ref &&
            this.toolbar_container_element
        ) {
            return true;
        }

        // Bygg upp grundstrukturen en gång (så att toolbar-input inte skapas om vid varje render).
        this.root.innerHTML = '';

        this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate' });

        this.h1_element_ref = this.Helpers.create_element('h1', { text_content: '' });
        this.plate_element_ref.appendChild(this.h1_element_ref);

        this.toolbar_container_element = this.Helpers.create_element('div', {
            id: 'all-requirements-toolbar-container',
        });
        this.plate_element_ref.appendChild(this.toolbar_container_element);

        this.results_summary_element_ref = this.Helpers.create_element('p', {
            class_name: 'results-summary',
            id: 'all-requirements-results-summary',
            text_content: '',
        });
        this.plate_element_ref.appendChild(this.results_summary_element_ref);

        this.empty_message_element_ref = this.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: '',
        });
        this.empty_message_element_ref.style.display = 'none';
        this.plate_element_ref.appendChild(this.empty_message_element_ref);

        this.list_element_ref = this.Helpers.create_element('ul', {
            class_name: ['item-list', 'all-requirements__list'],
        });
        this.plate_element_ref.appendChild(this.list_element_ref);

        this.root.appendChild(this.plate_element_ref);
        this.is_dom_initialized = true;
        return true;
    },

    render() {
        if (!this.root) return;
        const t = this.Translation.t;

        const state = this.getState();
        const rule_file_content = state?.ruleFileContent;
        const samples = state?.samples || [];

        if (!rule_file_content) {
            this.root.innerHTML = '';
            const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });
            plate.appendChild(this.Helpers.create_element('h1', { text_content: t('left_menu_all_requirements') }));
            plate.appendChild(this.Helpers.create_element('p', { text_content: t('error_no_active_audit') }));
            this.root.appendChild(plate);
            this.is_dom_initialized = false;
            return;
        }

        const entries = this.get_requirements_entries(rule_file_content);

        if (!this.ensure_dom_initialized()) return;

        // Endast krav som är relevanta för minst ett stickprov ska räknas/visas i denna vy.
        // Viktigt: använd valda innehållstyper (AuditLogic) istället för requirementResults (som ofta är tomt innan granskning).
        const can_use_audit_logic = Boolean(
            this.AuditLogic &&
            typeof this.AuditLogic.get_relevant_requirements_for_sample === 'function' &&
            rule_file_content
        );

        // Cache: stickprov -> Set av relevanta krav-id:n (req.key eller req.id).
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
                // Fallback (bakåtkompatibilitet): om AuditLogic inte är injicerad.
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

        const entries_in_any_sample = entries.filter(([req_id, req]) => entry_matches_any_sample(req_id, req));
        const total_count = entries_in_any_sample.length;

        this.h1_element_ref.textContent = t('all_requirements_title_audit_with_count', { count: total_count });

        // Toolbar (separat state för denna vy)
        const current_ui_settings = state.uiSettings?.allRequirementsFilter || { searchText: '', sortBy: 'default' };
        const initial_toolbar_state = {
            searchText: current_ui_settings.searchText || '',
            sortBy: current_ui_settings.sortBy || 'default',
        };

        // Initiera toolbar endast om den inte redan byggt DOM i denna container.
        // (RequirementListToolbarComponent håller internt koll på is_dom_built.)
        if (this.toolbar_component_instance?.init && this.toolbar_component_instance?.render) {
            if (!this.toolbar_component_instance.is_dom_built) {
                this.toolbar_component_instance.init({
                    root: this.toolbar_container_element,
                    deps: {
                        on_change: this.handle_toolbar_change,
                        initial_state: initial_toolbar_state,
                        Translation: this.Translation,
                        Helpers: this.Helpers,
                        config: {
                            showStatusFilter: false,
                            sortOptions: this.get_sort_options(),
                        },
                    },
                });
            }
            this.toolbar_component_instance.render(current_ui_settings);
        }

        const search_term = (current_ui_settings.searchText || '').toLowerCase().trim();
        const filtered_entries = entries_in_any_sample.filter(([, req]) => {
            if (!search_term) return true;
            return this.get_searchable_text_for_requirement(req).includes(search_term);
        });
        const filtered_count = filtered_entries.length;

        // Resultat-rad direkt under filtret
        this.results_summary_element_ref.textContent = t('results_summary_template', {
            filteredCount: filtered_count,
            totalCount: total_count
        });

        const sort_by = current_ui_settings.sortBy || 'default';
        const sorted_entries = [...filtered_entries];
        if (sort_by === 'title_asc') {
            sorted_entries.sort((a, b) => this.compare_strings_locale(a?.[1]?.title, b?.[1]?.title));
        } else if (sort_by === 'title_desc') {
            sorted_entries.sort((a, b) => this.compare_strings_locale(b?.[1]?.title, a?.[1]?.title));
        } else if (sort_by === 'ref_asc') {
            sorted_entries.sort((a, b) => this.compare_strings_locale(this.get_reference_string_for_sort(a?.[1]), this.get_reference_string_for_sort(b?.[1])));
        } else if (sort_by === 'ref_desc') {
            sorted_entries.sort((a, b) => this.compare_strings_locale(this.get_reference_string_for_sort(b?.[1]), this.get_reference_string_for_sort(a?.[1])));
        } else {
            // default: behåll regelfilens ordning
        }

        this.list_element_ref.innerHTML = '';
        this.empty_message_element_ref.style.display = 'none';

        if (total_count === 0) {
            this.empty_message_element_ref.textContent = t('all_requirements_empty_no_samples') || t('all_requirements_empty');
            this.empty_message_element_ref.style.display = '';
            return;
        }

        if (filtered_count === 0) {
            // Inga träffar med aktuellt filter. Visa tom lista men behåll summary.
            return;
        }

        sorted_entries.forEach(([req_id, req]) => {
            const title = req?.title || t('unknown_value', { val: req_id });
            const standard_ref = req?.standardReference || null;

            const li = this.Helpers.create_element('li', { class_name: ['item-list-item'] });
            const title_el = this.Helpers.create_element('h2', { class_name: 'all-requirements__title', text_content: title });

            // Metadata-rad: standardreferens (samma regler som i RequirementListComponent)
            const meta_p = this.Helpers.create_element('p', { class_name: ['text-muted', 'all-requirements__meta'] });

            if (standard_ref?.text) {
                if (standard_ref.url) {
                    meta_p.appendChild(this.Helpers.create_element('a', {
                        text_content: standard_ref.text,
                        attributes: { href: standard_ref.url, target: '_blank', rel: 'noopener noreferrer' }
                    }));
                } else {
                    meta_p.appendChild(this.Helpers.create_element('span', { text_content: standard_ref.text }));
                }
            }

            // Fallback: om äldre format har `reference` som sträng
            if (!standard_ref?.text && typeof req?.reference === 'string' && req.reference.trim() !== '') {
                if (meta_p.textContent) meta_p.appendChild(document.createTextNode(' • '));
                meta_p.appendChild(this.Helpers.create_element('span', { text_content: req.reference }));
            }

            if (meta_p.textContent || meta_p.childNodes.length > 0) {
                li.appendChild(meta_p);
            }

            const candidates = new Set([String(req_id)]);
            if (req?.key) candidates.add(String(req.key));
            if (req?.id) candidates.add(String(req.id));

            const matching_samples = samples.filter(sample => {
                const sample_set = sample?.id ? relevant_ids_by_sample.get(sample.id) : null;
                if (!sample_set) return false;
                return [...candidates].some(id => sample_set.has(id));
            });
            li.appendChild(this.Helpers.create_element('p', {
                class_name: ['all-requirements__occurs'],
                text_content: t('all_requirements_occurs_in_samples', { count: matching_samples.length })
            }));

            if (matching_samples.length > 0) {
                const ul = this.Helpers.create_element('ul', { class_name: 'all-requirements__samples' });
                matching_samples.forEach(sample => {
                    const sample_label = sample?.description || t('undefined_description');
                    const href = `#requirement_list?${new URLSearchParams({ sampleId: sample.id }).toString()}`;

                    const a = this.Helpers.create_element('a', {
                        text_content: sample_label,
                        attributes: { href }
                    });
                    a.addEventListener('click', (event) => {
                        if (typeof this.router === 'function') {
                            event.preventDefault();
                            this.router('requirement_list', { sampleId: sample.id });
                        }
                    });

                    const sample_li = this.Helpers.create_element('li', {});
                    sample_li.appendChild(a);
                    ul.appendChild(sample_li);
                });
                li.appendChild(ul);
            }

            li.insertBefore(title_el, li.firstChild);
            this.list_element_ref.appendChild(li);
        });
    },

    destroy() {
        if (this.toolbar_component_instance && typeof this.toolbar_component_instance.destroy === 'function') {
            this.toolbar_component_instance.destroy();
        }
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
        this.toolbar_container_element = null;
        this.is_dom_initialized = false;
        this.plate_element_ref = null;
        this.h1_element_ref = null;
        this.results_summary_element_ref = null;
        this.empty_message_element_ref = null;
        this.list_element_ref = null;
    }
};

