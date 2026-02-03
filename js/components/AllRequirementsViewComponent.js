export const AllRequirementsViewComponent = {
    CSS_PATH: 'css/components/all_requirements_view_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;

        this.router = deps.router;
        this.getState = deps.getState;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;

        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
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

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        this.root.innerHTML = '';

        const state = this.getState();
        const rule_file_content = state?.ruleFileContent;
        const samples = state?.samples || [];

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });

        if (!rule_file_content) {
            plate.appendChild(this.Helpers.create_element('h1', { text_content: t('left_menu_all_requirements') }));
            plate.appendChild(this.Helpers.create_element('p', { text_content: t('error_no_active_audit') }));
            this.root.appendChild(plate);
            return;
        }

        const entries = this.get_requirements_entries(rule_file_content);
        plate.appendChild(this.Helpers.create_element('h1', { text_content: t('all_requirements_title_with_count', { count: entries.length }) }));

        if (entries.length === 0) {
            plate.appendChild(this.Helpers.create_element('p', { text_content: t('all_requirements_empty') }));
            this.root.appendChild(plate);
            return;
        }

        const list = this.Helpers.create_element('ul', { class_name: ['item-list', 'all-requirements__list'] });
        entries.forEach(([req_id, req]) => {
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

            const matching_samples = samples.filter(sample => Boolean(sample?.requirementResults && Object.prototype.hasOwnProperty.call(sample.requirementResults, req_id)));
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
            list.appendChild(li);
        });

        plate.appendChild(list);
        this.root.appendChild(plate);
    },

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
    }
};

