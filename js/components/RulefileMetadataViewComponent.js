// js/components/RulefileMetadataViewComponent.js

export const RulefileMetadataViewComponent = {
    CSS_PATH: 'css/components/rulefile_metadata_view_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        
        this.is_css_loaded = false;

        if (this.Helpers?.load_css) {
            try {
                await this.Helpers.load_css(this.CSS_PATH);
                this.is_css_loaded = true;
            } catch (error) {
                console.warn('[RulefileMetadataViewComponent] Failed to load CSS. Continuing without dedicated styles.', error);
            }
        }
    },

    _ensure_dependencies() {
        if (!this.Helpers?.create_element || !this.Translation?.t) {
            throw new Error('RulefileMetadataViewComponent: Missing required global helpers.');
        }
    },

    _format_simple_value(value) {
        if (value === undefined || value === null) return '';
        if (typeof value === 'object') {
            if (value.text) return value.text;
            if (value.label) return value.label;
            if (value.name) return value.name;
            if (value.title) return value.title;
            try {
                return JSON.stringify(value);
            } catch (error) {
                console.warn('[RulefileMetadataViewComponent] Could not stringify value', value, error);
                return '';
            }
        }
        return String(value);
    },

    _create_definition_list(entries) {
        const dl = this.Helpers.create_element('dl', { class_name: 'metadata-definition-list' });
        entries.forEach(([label, value]) => {
            if (value === undefined || value === null || value === '') {
                return;
            }
            dl.appendChild(this.Helpers.create_element('dt', { text_content: String(label) }));
            if (Array.isArray(value)) {
                const list = this.Helpers.create_element('ul', { class_name: 'metadata-inline-list' });
                value.filter(Boolean).forEach(item => {
                    list.appendChild(this.Helpers.create_element('li', { text_content: this._format_simple_value(item) }));
                });
                dl.appendChild(this.Helpers.create_element('dd', {})).appendChild(list);
            } else {
                dl.appendChild(this.Helpers.create_element('dd', { text_content: this._format_simple_value(value) }));
            }
        });
        return dl;
    },

    _create_section(title_key, content_nodes = []) {
        const section = this.Helpers.create_element('section', { class_name: 'metadata-section' });
        if (title_key) {
            section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t(title_key) }));
        }
        const valid_nodes = content_nodes.filter(Boolean);
        if (valid_nodes.length === 0) {
            return section;
        }

        const has_card_like_nodes = valid_nodes.some(node => {
            return node?.classList?.contains('metadata-card') || node?.classList?.contains('metadata-card-grid');
        });

        if (has_card_like_nodes) {
            valid_nodes.forEach(node => section.appendChild(node));
        } else {
            const wrapper = this.Helpers.create_element('article', { class_name: ['metadata-card', 'metadata-section-card'] });
            valid_nodes.forEach(node => wrapper.appendChild(node));
            section.appendChild(wrapper);
        }
        return section;
    },

    _create_list(items, empty_key, class_name = 'metadata-list') {
        if (!Array.isArray(items) || items.length === 0) {
            return this.Helpers.create_element('p', { class_name: 'metadata-empty', text_content: this.Translation.t(empty_key) });
        }
        const ul = this.Helpers.create_element('ul', { class_name });
        items.filter(Boolean).forEach(item => {
            const content = this._format_simple_value(item);
            if (!content) return;
            ul.appendChild(this.Helpers.create_element('li', { text_content: content }));
        });
        return ul;
    },

    _create_content_types_section(content_types) {
        const t = this.Translation.t;
        if (!Array.isArray(content_types) || content_types.length === 0) {
            return this._create_section('rulefile_metadata_section_content_types', [
                this.Helpers.create_element('p', { class_name: 'metadata-empty', text_content: t('rulefile_metadata_empty_value') })
            ]);
        }

        const root_list = this.Helpers.create_element('ul', { class_name: 'metadata-nested-list' });

        content_types.forEach(parent => {
            const parent_item = this.Helpers.create_element('li');
            parent_item.appendChild(this.Helpers.create_element('span', { class_name: 'metadata-subject', text_content: parent.text || parent.id || t('rulefile_metadata_untitled_item') }));
            if (parent.description) {
                parent_item.appendChild(this.Helpers.create_element('p', { class_name: 'metadata-description', text_content: parent.description }));
            }
            if (Array.isArray(parent.types) && parent.types.length > 0) {
                const child_list = this.Helpers.create_element('ul', { class_name: 'metadata-nested-list-child' });
                parent.types.forEach(child => {
                    const child_item = this.Helpers.create_element('li');
                    child_item.appendChild(this.Helpers.create_element('span', { class_name: 'metadata-subject', text_content: child.text || child.id || t('rulefile_metadata_untitled_item') }));
                    if (child.description) {
                        child_item.appendChild(this.Helpers.create_element('p', { class_name: 'metadata-description', text_content: child.description }));
                    }
                    child_list.appendChild(child_item);
                });
                parent_item.appendChild(child_list);
            }
            root_list.appendChild(parent_item);
        });

        return this._create_section('rulefile_metadata_section_content_types', [root_list]);
    },

    _create_samples_section(samples) {
        const t = this.Translation.t;
        if (!samples || (Array.isArray(samples) && samples.length === 0)) {
            return this._create_section('rulefile_metadata_section_samples', [
                this.Helpers.create_element('p', { class_name: 'metadata-empty', text_content: t('rulefile_metadata_empty_value') })
            ]);
        }

        const nodes = [];
        const sampleCategories = samples.sampleCategories;
        if (Array.isArray(sampleCategories) && sampleCategories.length > 0) {
            const categoriesWrapper = this.Helpers.create_element('div', { class_name: 'metadata-card-grid' });
            sampleCategories.forEach(category => {
                const card = this.Helpers.create_element('article', { class_name: 'metadata-card' });
                card.appendChild(this.Helpers.create_element('h3', { text_content: category.text || category.id || t('rulefile_metadata_untitled_item') }));
                if (typeof category.hasUrl === 'boolean') {
                    const tag_text = category.hasUrl ? t('rulefile_metadata_has_url_yes') : t('rulefile_metadata_has_url_no');
                    card.appendChild(this.Helpers.create_element('p', { class_name: 'metadata-tag', text_content: tag_text }));
                }
                if (Array.isArray(category.categories) && category.categories.length > 0) {
                    const list = this.Helpers.create_element('ul', { class_name: 'metadata-sub-list' });
                    category.categories.forEach(subCategory => {
                        list.appendChild(this.Helpers.create_element('li', { text_content: subCategory.text || subCategory.id || t('rulefile_metadata_untitled_item') }));
                    });
                    card.appendChild(list);
                }
                categoriesWrapper.appendChild(card);
            });
            nodes.push(categoriesWrapper);
        }

        if (Array.isArray(samples.sampleTypes) && samples.sampleTypes.length > 0) {
            const types_card = this.Helpers.create_element('article', { class_name: 'metadata-card' });
            types_card.appendChild(this.Helpers.create_element('h3', { text_content: t('rulefile_metadata_sample_types') }));
            types_card.appendChild(this._create_list(samples.sampleTypes, 'rulefile_metadata_empty_value', 'metadata-list'));
            nodes.push(types_card);
        }

        if (nodes.length === 0) {
            nodes.push(this.Helpers.create_element('p', { class_name: 'metadata-empty', text_content: t('rulefile_metadata_empty_value') }));
        }

        return this._create_section('rulefile_metadata_section_samples', nodes);
    },

    _create_taxonomies_section(taxonomies) {
        const t = this.Translation.t;
        if (!Array.isArray(taxonomies) || taxonomies.length === 0) {
            return this._create_section('rulefile_metadata_section_taxonomies', [
                this.Helpers.create_element('p', { class_name: 'metadata-empty', text_content: t('rulefile_metadata_empty_value') })
            ]);
        }

        const wrapper = this.Helpers.create_element('div', { class_name: 'metadata-card-grid' });
        taxonomies.forEach(taxonomy => {
            const card = this.Helpers.create_element('article', { class_name: 'metadata-card' });
            card.appendChild(this.Helpers.create_element('h3', { text_content: taxonomy.label || taxonomy.id || t('rulefile_metadata_untitled_item') }));
            const infoList = this._create_definition_list([
                [t('rulefile_metadata_field_taxonomy_id'), taxonomy.id],
                [t('rulefile_metadata_field_taxonomy_version'), taxonomy.version],
                [t('rulefile_metadata_field_taxonomy_uri'), taxonomy.uri]
            ]);
            if (infoList.childNodes.length > 0) {
                card.appendChild(infoList);
            }
            if (Array.isArray(taxonomy.concepts) && taxonomy.concepts.length > 0) {
                const list = this.Helpers.create_element('ul', { class_name: 'metadata-sub-list' });
                taxonomy.concepts.forEach(concept => {
                    const item = this.Helpers.create_element('li', { text_content: concept.label || concept.id || t('rulefile_metadata_untitled_item') });
                    list.appendChild(item);
                });
                card.appendChild(list);
            }
            wrapper.appendChild(card);
        });

        return this._create_section('rulefile_metadata_section_taxonomies', [wrapper]);
    },

    _create_source_link(source_url) {
        const clean_url = this.Helpers.add_protocol_if_missing ? this.Helpers.add_protocol_if_missing(source_url) : source_url;
        if (!clean_url) return null;
        return this.Helpers.create_element('a', {
            text_content: source_url,
            attributes: {
                href: clean_url,
                target: '_blank',
                rel: 'noopener noreferrer'
            }
        });
    },

    _format_date_display(iso_string) {
        if (!iso_string) return '';
        try {
            const date = new Date(iso_string);
            if (Number.isNaN(date.getTime())) return iso_string;
            const locale = window.Translation?.getCurrentLocale?.()
                || window.Translation?.currentLocale
                || (typeof navigator !== 'undefined' ? navigator.language : 'en-GB');
            return date.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
        } catch (error) {
            console.warn('[RulefileMetadataViewComponent] Failed to format date', iso_string, error);
            return iso_string;
        }
    },

    render() {
        if (!this.root) return;
        this._ensure_dependencies();
        const t = this.Translation.t;

        this.root.innerHTML = '';
        const plate = this.Helpers.create_element('div', { class_name: ['content-plate', 'rulefile-metadata-plate'] });

        if (this.NotificationComponent?.get_global_message_element_reference) {
            const global_message_element = this.NotificationComponent.get_global_message_element_reference();
            if (global_message_element) {
                plate.appendChild(global_message_element);
            }
        }

        const header_wrapper = this.Helpers.create_element('div', { class_name: 'metadata-header' });
        const heading = this.Helpers.create_element('h1', { text_content: t('rulefile_metadata_title') });
        const edit_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-secondary', 'metadata-edit-button'],
            attributes: {
                type: 'button',
                'aria-label': t('rulefile_metadata_edit_button_aria')
            },
            html_content: `<span>${t('rulefile_metadata_edit_button')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('edit') : '')
        });
        edit_button.addEventListener('click', () => this.router('rulefile_metadata_edit'));

        header_wrapper.appendChild(heading);
        header_wrapper.appendChild(edit_button);

        plate.appendChild(header_wrapper);
        plate.appendChild(this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: t('rulefile_metadata_intro') }));

        const current_state = typeof this.getState === 'function' ? this.getState() : {};
        const metadata = current_state?.ruleFileContent?.metadata;

        if (!metadata) {
            plate.appendChild(this.Helpers.create_element('p', { class_name: 'metadata-empty', text_content: t('rulefile_metadata_missing') }));
        } else {
            const monitoringText = metadata.monitoringType?.text || metadata.monitoringType?.label || '';
            const monitoringKey = metadata.monitoringType?.type || '';
            const monitoringDisplay = monitoringText
                ? (monitoringKey && monitoringKey !== monitoringText ? `${monitoringText} (${monitoringKey})` : monitoringText)
                : monitoringKey;

            const general_section = this._create_section('rulefile_metadata_section_general', [
                this._create_definition_list([
                    [t('rulefile_metadata_field_title'), metadata.title],
                    [t('rulefile_metadata_field_description'), metadata.description],
                    [t('rulefile_metadata_field_version'), metadata.version],
                    [t('rulefile_metadata_field_language'), metadata.language],
                    [t('rulefile_metadata_field_monitoring_type'), monitoringDisplay],
                    [t('rulefile_metadata_field_date_created'), this._format_date_display(metadata.dateCreated)],
                    [t('rulefile_metadata_field_date_modified'), this._format_date_display(metadata.dateModified)],
                    [t('rulefile_metadata_field_license'), metadata.license]
                ])
            ]);

            const publisher_section = this._create_section('rulefile_metadata_section_publisher', [
                this._create_definition_list([
                    [t('rulefile_metadata_field_publisher_name'), metadata.publisher?.name],
                    [t('rulefile_metadata_field_publisher_contact'), metadata.publisher?.contactPoint]
                ])
            ]);

            const source_link_node = this._create_source_link(metadata.source?.url);
            const source_entries = [
                [t('rulefile_metadata_field_source_title'), metadata.source?.title],
                [t('rulefile_metadata_field_source_retrieved'), this._format_date_display(metadata.source?.retrievedDate)],
                [t('rulefile_metadata_field_source_format'), metadata.source?.format]
            ];
            const source_section_nodes = [];
            if (source_link_node) {
                const link_container = this.Helpers.create_element('p');
                link_container.appendChild(source_link_node);
                source_section_nodes.push(link_container);
            }
            const source_definition_list = this._create_definition_list(source_entries);
            if (source_definition_list.childNodes.length > 0) {
                source_section_nodes.push(source_definition_list);
            }
            const source_section = this._create_section('rulefile_metadata_section_source', source_section_nodes);

            const keywords_section = this._create_section('rulefile_metadata_section_keywords', [
                this._create_list(metadata.keywords, 'rulefile_metadata_empty_value', 'metadata-list')
            ]);

            const vocabularies = metadata.vocabularies || {};
            const page_types = vocabularies.pageTypes || metadata.pageTypes || [];
            const content_types = vocabularies.contentTypes || metadata.contentTypes || [];
            const taxonomies = vocabularies.taxonomies || metadata.taxonomies || [];
            const sample_types = vocabularies.sampleTypes || metadata.samples?.sampleTypes || [];
            
            const page_types_section = this._create_section('rulefile_metadata_section_page_types', [
                this._create_list(page_types, 'rulefile_metadata_empty_value', 'metadata-list')
            ]);

            const content_types_section = this._create_content_types_section(content_types);
            const samples_section = this._create_samples_section(metadata.samples);
            const taxonomies_section = this._create_taxonomies_section(taxonomies);

            [
                general_section,
                publisher_section,
                source_section,
                keywords_section,
                page_types_section,
                content_types_section,
                samples_section,
                taxonomies_section
            ].forEach(section => {
                if (section) {
                    plate.appendChild(section);
                }
            });
        }

        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: 'margin-top: 2rem; justify-content: flex-start;' });
        const back_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            html_content: `<span>${t('back_to_edit_options')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('arrow_back') : '')
        });
        back_button.addEventListener('click', () => this.router('edit_rulefile_main'));
        actions_div.appendChild(back_button);
        plate.appendChild(actions_div);

        this.root.appendChild(plate);
    },

    destroy() {
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
    }
};
