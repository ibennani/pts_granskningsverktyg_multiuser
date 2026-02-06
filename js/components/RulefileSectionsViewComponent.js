// js/components/RulefileSectionsViewComponent.js

export const RulefileSectionsViewComponent = {
    CSS_PATH: 'css/components/rulefile_sections_view.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.is_initial_render = true; // Flagga för att veta om detta är första render
        this.general_form_initial_focus_set = false; // Flagga för att veta om fokus redan har satts på general-formuläret
        this.page_types_form_initial_focus_set = false; // Flagga för att veta om fokus redan har satts på page_types-formuläret
        
        if (this.Helpers?.load_css) {
            await this.Helpers.load_css(this.CSS_PATH).catch(err => console.warn('[RulefileSectionsViewComponent] Failed to load CSS', err));
        }
    },

    _get_section_config(section_id) {
        const t = this.Translation.t;
        const sections = {
            general: {
                id: 'general',
                title: t('rulefile_section_general_title') || 'Allmän information',
                editRoute: 'rulefile_metadata_edit',
                editSection: 'general'
            },
            publisher_source: {
                id: 'publisher_source',
                title: t('rulefile_section_publisher_source_title') || 'Utgivare & källa',
                editRoute: 'rulefile_metadata_edit',
                editSection: 'publisher_source'
            },
            classifications: {
                id: 'classifications',
                title: t('rulefile_section_classifications_title') || 'Klassificeringar',
                editRoute: 'rulefile_metadata_edit',
                editSection: 'classifications'
            },
            page_types: {
                id: 'page_types',
                title: t('rulefile_metadata_section_page_types') || 'Sidtyper',
                editRoute: 'rulefile_metadata_edit',
                editSection: 'page_types'
            },
            content_types: {
                id: 'content_types',
                title: t('rulefile_metadata_section_content_types') || 'Innehållstyper',
                editRoute: 'rulefile_metadata_edit',
                editSection: 'content_types'
            },
            report_template: {
                id: 'report_template',
                title: t('rulefile_section_report_template_title') || 'Rapportmall',
                editRoute: 'rulefile_metadata_edit',
                editSection: 'report_template'
            },
            info_blocks_order: {
                id: 'info_blocks_order',
                title: t('rulefile_section_info_blocks_order_title') || 'Info-blocks ordning',
                editRoute: 'rulefile_sections',
                editSection: 'info_blocks_order',
                isEditable: true
            }
        };
        return sections[section_id] || sections.general;
    },

    _create_left_menu(current_section_id) {
        const t = this.Translation.t;
        const menu = this.Helpers.create_element('nav', { 
            class_name: 'rulefile-sections-menu',
            attributes: { 'aria-label': t('rulefile_sections_menu_label') || 'Regelfilsektioner' }
        });

        const sections = [
            { id: 'general', label: t('rulefile_section_general_title') || 'Allmän information' },
            { id: 'page_types', label: t('rulefile_metadata_section_page_types') || 'Sidtyper' },
            { id: 'content_types', label: t('rulefile_metadata_section_content_types') || 'Innehållstyper' },
            { id: 'report_template', label: t('rulefile_section_report_template_title') || 'Rapportmall' },
            { id: 'info_blocks_order', label: t('rulefile_section_info_blocks_order_title') || 'Info-blocks ordning' },
            { id: 'classifications', label: t('rulefile_section_classifications_title') || 'Klassificeringar' }
        ];

        const menu_list = this.Helpers.create_element('ul', { class_name: 'rulefile-sections-menu-list' });
        
        sections.forEach(section => {
            const menu_item = this.Helpers.create_element('li', { class_name: 'rulefile-sections-menu-item' });
            const menu_link = this.Helpers.create_element('a', {
                class_name: current_section_id === section.id ? 'active' : '',
                attributes: {
                    href: `#rulefile_sections?section=${section.id}`,
                    'aria-current': current_section_id === section.id ? 'page' : null
                },
                text_content: section.label
            });
            menu_link.addEventListener('click', (e) => {
                e.preventDefault();
                this.router('rulefile_sections', { section: section.id });
            });
            menu_item.appendChild(menu_link);
            menu_list.appendChild(menu_item);
        });

        menu.appendChild(menu_list);
        return menu;
    },

    _create_header(section_config, is_editing = false) {
        const t = this.Translation.t;
        const header_wrapper = this.Helpers.create_element('div', { class_name: 'rulefile-sections-header' });
        
        const heading = this.Helpers.create_element('h2', { text_content: section_config.title });
        header_wrapper.appendChild(heading);
        
        // Lägg till redigera-knapp direkt till höger om h2 för general-sektionen (bara om inte redigerar)
        if (section_config.id === 'general' && !is_editing) {
            const edit_button = this.Helpers.create_element('button', {
                class_name: ['button', 'button-secondary', 'rulefile-sections-edit-button'],
                attributes: {
                    type: 'button',
                    'aria-label': t('rulefile_sections_edit_general_aria')
                },
                html_content: `<span>${t('edit_button_label')}</span>` +
                              (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('edit') : '')
            });
            edit_button.addEventListener('click', () => {
                this.router('rulefile_sections', { section: 'general', edit: 'true' });
            });
            header_wrapper.appendChild(edit_button);
        }
        
        // Lägg till redigera-knapp för page_types-sektionen (bara om inte redigerar)
        if (section_config.id === 'page_types' && !is_editing) {
            const edit_button = this.Helpers.create_element('button', {
                class_name: ['button', 'button-secondary', 'rulefile-sections-edit-button'],
                attributes: {
                    type: 'button',
                    'aria-label': t('rulefile_sections_edit_page_types_aria')
                },
                html_content: `<span>${t('edit_button_label')}</span>` +
                              (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('edit') : '')
            });
            edit_button.addEventListener('click', () => {
                this.router('rulefile_sections', { section: 'page_types', edit: 'true' });
            });
            header_wrapper.appendChild(edit_button);
        }

        // Lägg till "lägg till"-knapp för page_types i redigeringsläge
        if (section_config.id === 'page_types' && is_editing) {
            const add_button = this.Helpers.create_element('button', {
                class_name: ['button', 'button-primary', 'button-small', 'rulefile-sections-edit-button'],
                attributes: {
                    type: 'button',
                    'data-action': 'add-page-type'
                },
                html_content: `<span>${t('rulefile_metadata_add_page_type')}</span>` +
                              (this.Helpers.get_icon_svg ? `<span aria-hidden="true">${this.Helpers.get_icon_svg('add', ['currentColor'], 16)}</span>` : '')
            });
            add_button.addEventListener('click', () => {
                this.page_types_edit_component?.handle_add_page_type_click?.();
            });
            header_wrapper.appendChild(add_button);
        }
        
        return header_wrapper;
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
                console.warn('[RulefileSectionsViewComponent] Could not stringify value', value, error);
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
            console.warn('[RulefileSectionsViewComponent] Failed to format date', iso_string, error);
            return iso_string;
        }
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

    _create_list(items, empty_key, class_name = 'metadata-list') {
        const t = this.Translation.t;
        if (!Array.isArray(items) || items.length === 0) {
            return this.Helpers.create_element('p', { class_name: 'metadata-empty', text_content: t(empty_key) || 'Inget innehåll' });
        }
        const ul = this.Helpers.create_element('ul', { class_name });
        items.filter(Boolean).forEach(item => {
            const content = this._format_simple_value(item);
            if (!content) return;
            ul.appendChild(this.Helpers.create_element('li', { text_content: content }));
        });
        return ul;
    },

    _render_general_section(metadata) {
        const t = this.Translation.t;
        const section = this.Helpers.create_element('section', { class_name: 'rulefile-section-content' });
        
        // Visa endast text, aldrig nyckeln (type)
        const monitoringDisplay = metadata.monitoringType?.text || metadata.monitoringType?.label || '';

        // Allmän information
        section.appendChild(this._create_definition_list([
            [t('rulefile_metadata_field_title'), metadata.title],
            [t('rulefile_metadata_field_description'), metadata.description],
            [t('rulefile_metadata_field_version'), metadata.version],
            [t('rulefile_metadata_field_language'), metadata.language],
            [t('rulefile_metadata_field_monitoring_type'), monitoringDisplay],
            [t('rulefile_metadata_field_date_created'), this._format_date_display(metadata.dateCreated)],
            [t('rulefile_metadata_field_date_modified'), this._format_date_display(metadata.dateModified)],
            [t('rulefile_metadata_field_license'), metadata.license]
        ]));

        // Utgivare
        const publisher_subsection = this.Helpers.create_element('div', { class_name: 'metadata-subsection' });
        publisher_subsection.appendChild(this.Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_publisher') }));
        publisher_subsection.appendChild(this._create_definition_list([
            [t('rulefile_metadata_field_publisher_name'), metadata.publisher?.name],
            [t('rulefile_metadata_field_publisher_contact'), metadata.publisher?.contactPoint]
        ]));
        section.appendChild(publisher_subsection);

        // Källa
        const source_subsection = this.Helpers.create_element('div', { class_name: 'metadata-subsection' });
        source_subsection.appendChild(this.Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_source') }));
        
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
        source_section_nodes.forEach(node => source_subsection.appendChild(node));
        section.appendChild(source_subsection);

        return section;
    },

    _render_publisher_source_section(metadata) {
        const t = this.Translation.t;
        const section = this.Helpers.create_element('section', { class_name: 'rulefile-section-content' });
        
        const publisher_section = this.Helpers.create_element('div', { class_name: 'metadata-subsection' });
        publisher_section.appendChild(this.Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_publisher') }));
        publisher_section.appendChild(this._create_definition_list([
            [t('rulefile_metadata_field_publisher_name'), metadata.publisher?.name],
            [t('rulefile_metadata_field_publisher_contact'), metadata.publisher?.contactPoint]
        ]));
        section.appendChild(publisher_section);

        const source_section = this.Helpers.create_element('div', { class_name: 'metadata-subsection' });
        source_section.appendChild(this.Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_source') }));
        
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
        source_section_nodes.forEach(node => source_section.appendChild(node));
        section.appendChild(source_section);

        return section;
    },

    _render_classifications_section(metadata) {
        const t = this.Translation.t;
        const section = this.Helpers.create_element('section', { class_name: 'rulefile-section-content' });
        
        const vocabularies = metadata.vocabularies || {};
        const taxonomies = vocabularies.taxonomies || metadata.taxonomies || [];

        // Keywords
        const keywords_subsection = this.Helpers.create_element('div', { class_name: 'metadata-subsection' });
        keywords_subsection.appendChild(this.Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_keywords') }));
        keywords_subsection.appendChild(this._create_list(metadata.keywords, 'rulefile_metadata_empty_value', 'metadata-list'));
        section.appendChild(keywords_subsection);

        // Samples
        const samples_subsection = this.Helpers.create_element('div', { class_name: 'metadata-subsection' });
        samples_subsection.appendChild(this.Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_samples') }));
        const samples = metadata.samples || {};
        if (Array.isArray(samples.sampleCategories) && samples.sampleCategories.length > 0) {
            const categoriesWrapper = this.Helpers.create_element('div', { class_name: 'metadata-card-grid' });
            samples.sampleCategories.forEach(category => {
                const card = this.Helpers.create_element('article', { class_name: 'metadata-card' });
                card.appendChild(this.Helpers.create_element('h3', { 
                    text_content: category.text || category.id || t('rulefile_metadata_untitled_item') 
                }));
                if (typeof category.hasUrl === 'boolean') {
                    const tag_text = category.hasUrl ? t('rulefile_metadata_has_url_yes') : t('rulefile_metadata_has_url_no');
                    card.appendChild(this.Helpers.create_element('p', { 
                        class_name: 'metadata-tag', 
                        text_content: tag_text 
                    }));
                }
                if (Array.isArray(category.categories) && category.categories.length > 0) {
                    const list = this.Helpers.create_element('ul', { class_name: 'metadata-sub-list' });
                    category.categories.forEach(subCategory => {
                        list.appendChild(this.Helpers.create_element('li', { 
                            text_content: subCategory.text || subCategory.id || t('rulefile_metadata_untitled_item') 
                        }));
                    });
                    card.appendChild(list);
                }
                categoriesWrapper.appendChild(card);
            });
            samples_subsection.appendChild(categoriesWrapper);
        }
        if (Array.isArray(samples.sampleTypes) && samples.sampleTypes.length > 0) {
            const types_card = this.Helpers.create_element('article', { class_name: 'metadata-card' });
            types_card.appendChild(this.Helpers.create_element('h3', { text_content: t('rulefile_metadata_sample_types') }));
            types_card.appendChild(this._create_list(samples.sampleTypes, 'rulefile_metadata_empty_value', 'metadata-list'));
            samples_subsection.appendChild(types_card);
        }
        if (samples_subsection.children.length === 1) { // Only h2
            samples_subsection.appendChild(this.Helpers.create_element('p', { 
                class_name: 'metadata-empty', 
                text_content: t('rulefile_metadata_empty_value') 
            }));
        }
        section.appendChild(samples_subsection);

        // Taxonomies
        const taxonomies_subsection = this.Helpers.create_element('div', { class_name: 'metadata-subsection' });
        taxonomies_subsection.appendChild(this.Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_taxonomies') }));
        if (!Array.isArray(taxonomies) || taxonomies.length === 0) {
            taxonomies_subsection.appendChild(this.Helpers.create_element('p', { 
                class_name: 'metadata-empty', 
                text_content: t('rulefile_metadata_empty_value') 
            }));
        } else {
            const wrapper = this.Helpers.create_element('div', { class_name: 'metadata-card-grid' });
            taxonomies.forEach(taxonomy => {
                const card = this.Helpers.create_element('article', { class_name: 'metadata-card' });
                card.appendChild(this.Helpers.create_element('h3', { 
                    text_content: taxonomy.label || taxonomy.id || t('rulefile_metadata_untitled_item') 
                }));
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
                        list.appendChild(this.Helpers.create_element('li', { 
                            text_content: concept.label || concept.id || t('rulefile_metadata_untitled_item') 
                        }));
                    });
                    card.appendChild(list);
                }
                wrapper.appendChild(card);
            });
            taxonomies_subsection.appendChild(wrapper);
        }
        section.appendChild(taxonomies_subsection);

        return section;
    },

    _render_page_types_section(metadata) {
        const t = this.Translation.t;
        const section = this.Helpers.create_element('section', { class_name: 'rulefile-section-content' });
        
        // Försök hämta pageTypes från olika platser i strukturen
        const vocabularies = metadata.vocabularies || {};
        let page_types = vocabularies.pageTypes || metadata.pageTypes || [];
        
        // Hämta sampleCategories från olika platser i strukturen
        const samples = metadata.samples || {};
        let sample_categories = samples.sampleCategories || [];
        
        // Om sampleCategories är tom, försök hämta från vocabularies
        if (!Array.isArray(sample_categories) || sample_categories.length === 0) {
            const vocab_samples = vocabularies.sampleTypes || {};
            if (Array.isArray(vocab_samples.sampleCategories)) {
                sample_categories = vocab_samples.sampleCategories;
            }
        }
        
        // Om pageTypes är tom, använd sampleCategories som källa
        if (!Array.isArray(page_types) || page_types.length === 0) {
            if (Array.isArray(sample_categories) && sample_categories.length > 0) {
                // Extrahera pageTypes från sampleCategories
                page_types = sample_categories.map(cat => cat.text || cat.id).filter(Boolean);
            }
        }

        if (!Array.isArray(page_types) || page_types.length === 0) {
            section.appendChild(this.Helpers.create_element('p', { 
                class_name: 'metadata-empty', 
                text_content: t('rulefile_metadata_empty_value') 
            }));
            return section;
        }

        // För varje sidtyp, visa den som h3 och dess kopplade kategorier som punktlista
        page_types.forEach((page_type, index) => {
            // Hitta motsvarande sampleCategory genom att matcha text eller id
            const page_type_str = String(page_type);
            const page_type_normalized = page_type_str.toLowerCase().trim();
            
            // Först försök matcha exakt på text
            let matching_category = sample_categories.find(cat => {
                const cat_text = (cat.text || '').toLowerCase().trim();
                return cat_text === page_type_normalized;
            });
            
            // Om ingen exakt match, försök matcha på id eller normaliserad text
            if (!matching_category) {
                matching_category = sample_categories.find(cat => {
                    const cat_text = (cat.text || '').toLowerCase().trim();
                    const cat_id = (cat.id || '').toLowerCase().trim();
                    const cat_id_without_dashes = cat_id.replace(/-/g, ' ').trim();
                    
                    return cat_id === page_type_normalized ||
                           cat_id_without_dashes === page_type_normalized ||
                           cat_id.replace(/-/g, '') === page_type_normalized.replace(/\s+/g, '') ||
                           // Matcha även om det finns små skillnader i tecken
                           cat_text.includes(page_type_normalized) || 
                           page_type_normalized.includes(cat_text);
                });
            }
            
            // Fallback: om ingen match hittades, försök matcha på index-position
            if (!matching_category && index < sample_categories.length) {
                matching_category = sample_categories[index];
            }
            
            // Debug: logga om matchning misslyckas (kan tas bort senare)
            if (!matching_category) {
                console.warn('[RulefileSectionsViewComponent] No matching category found for page type:', page_type_str, 'Available categories:', sample_categories.map(c => c.text || c.id));
            } else if (!Array.isArray(matching_category.categories) || matching_category.categories.length === 0) {
                console.warn('[RulefileSectionsViewComponent] Matching category found but no categories array:', matching_category);
            }

            // Skapa wrapper för varje sidtyp med korrekt styling
            const page_type_wrapper = this.Helpers.create_element('div', { class_name: 'page-type-item' });
            
            // Skapa h3 för sidtypen med korrekt styling (liknande metadata-subsection h2)
            const heading = this.Helpers.create_element('h3', { 
                text_content: page_type_str,
                class_name: 'page-type-heading'
            });
            page_type_wrapper.appendChild(heading);

            // Skapa punktlista för kategorierna direkt under h3
            if (matching_category && Array.isArray(matching_category.categories) && matching_category.categories.length > 0) {
                const categories_list = this.Helpers.create_element('ul', { class_name: 'metadata-list' });
                matching_category.categories.forEach(category => {
                    const category_text = category.text || category.id || t('rulefile_metadata_untitled_item');
                    const list_item = this.Helpers.create_element('li', { text_content: category_text });
                    categories_list.appendChild(list_item);
                });
                page_type_wrapper.appendChild(categories_list);
            } else {
                // Om inga kategorier hittades, visa ett meddelande direkt under h3 utan mellanrum
                const empty_msg = this.Helpers.create_element('p', { 
                    class_name: 'metadata-empty page-type-empty', 
                    text_content: t('rulefile_metadata_empty_value') 
                });
                page_type_wrapper.appendChild(empty_msg);
            }
            
            section.appendChild(page_type_wrapper);
            
            // Lägg till mellanrum mellan sidtyper (utom efter sista)
            if (index < page_types.length - 1) {
                const spacer = this.Helpers.create_element('div', { style: 'margin-bottom: 2rem;' });
                section.appendChild(spacer);
            }
        });

        return section;
    },

    _render_content_types_section(metadata) {
        const t = this.Translation.t;
        const section = this.Helpers.create_element('section', { class_name: 'rulefile-section-content' });
        
        const vocabularies = metadata.vocabularies || {};
        const content_types = vocabularies.contentTypes || metadata.contentTypes || [];

        if (!Array.isArray(content_types) || content_types.length === 0) {
            section.appendChild(this.Helpers.create_element('p', { 
                class_name: 'metadata-empty', 
                text_content: t('rulefile_metadata_empty_value') 
            }));
        } else {
            const root_list = this.Helpers.create_element('ul', { class_name: 'metadata-nested-list' });
            content_types.forEach(parent => {
                const parent_item = this.Helpers.create_element('li');
                parent_item.appendChild(this.Helpers.create_element('span', { 
                    class_name: 'metadata-subject', 
                    text_content: parent.text || parent.id || t('rulefile_metadata_untitled_item') 
                }));
                if (parent.description) {
                    parent_item.appendChild(this.Helpers.create_element('p', { 
                        class_name: 'metadata-description', 
                        text_content: parent.description 
                    }));
                }
                if (Array.isArray(parent.types) && parent.types.length > 0) {
                    const child_list = this.Helpers.create_element('ul', { class_name: 'metadata-nested-list-child' });
                    parent.types.forEach(child => {
                        const child_item = this.Helpers.create_element('li');
                        child_item.appendChild(this.Helpers.create_element('span', { 
                            class_name: 'metadata-subject', 
                            text_content: child.text || child.id || t('rulefile_metadata_untitled_item') 
                        }));
                        if (child.description) {
                            child_item.appendChild(this.Helpers.create_element('p', { 
                                class_name: 'metadata-description', 
                                text_content: child.description 
                            }));
                        }
                        child_list.appendChild(child_item);
                    });
                    parent_item.appendChild(child_list);
                }
                root_list.appendChild(parent_item);
            });
            section.appendChild(root_list);
        }

        return section;
    },

    _render_report_template_section(ruleFileContent) {
        const t = this.Translation.t;
        const section = this.Helpers.create_element('section', { class_name: 'rulefile-section-content' });
        
        const report_template = ruleFileContent.reportTemplate || { sections: {} };
        const sections = report_template.sections || {};
        const metadata = ruleFileContent.metadata || {};
        const block_order = metadata?.blockOrders?.reportSections || [];

        if (Object.keys(sections).length === 0) {
            section.appendChild(this.Helpers.create_element('p', { 
                class_name: 'metadata-empty', 
                text_content: t('rulefile_metadata_empty_value') 
            }));
        } else {
            const ordered_section_ids = [...block_order];
            const extra_section_ids = Object.keys(sections).filter(id => !ordered_section_ids.includes(id));
            ordered_section_ids.push(...extra_section_ids);

            const sections_list = this.Helpers.create_element('div', { class_name: 'report-sections-list' });
            ordered_section_ids.forEach(section_id => {
                const section_data = sections[section_id];
                if (!section_data) return;

                const section_card = this.Helpers.create_element('article', { class_name: 'metadata-card' });
                const header = this.Helpers.create_element('div', { class_name: 'report-section-header' });
                header.appendChild(this.Helpers.create_element('h3', { text_content: section_data.name || section_id }));
                if (section_data.required) {
                    const required_tag = this.Helpers.create_element('span', { 
                        class_name: 'metadata-tag', 
                        text_content: t('report_section_required') || 'Obligatorisk' 
                    });
                    header.appendChild(required_tag);
                }
                section_card.appendChild(header);
                if (section_data.content) {
                    section_card.appendChild(this.Helpers.create_element('div', { 
                        class_name: 'report-section-content',
                        text_content: section_data.content 
                    }));
                }
                sections_list.appendChild(section_card);
            });
            section.appendChild(sections_list);
        }

        return section;
    },

    _get_block_display_name(block_id) {
        const t = this.Translation.t;
        const name_map = {
            'expectedObservation': t('requirement_expected_observation'),
            'instructions': t('requirement_instructions'),
            'exceptions': t('requirement_exceptions'),
            'commonErrors': t('requirement_common_errors'),
            'tips': t('requirement_tips'),
            'examples': t('requirement_examples')
        };
        return name_map[block_id] || block_id;
    },

    _render_info_blocks_order_section(metadata, isEditing = false) {
        const t = this.Translation.t;
        const section = this.Helpers.create_element('section', { class_name: 'rulefile-section-content' });
        
        const block_order = metadata?.blockOrders?.infoBlocks || [
            'expectedObservation',
            'instructions',
            'exceptions',
            'commonErrors',
            'tips',
            'examples'
        ];

        if (isEditing) {
            // Redigeringsläge: upp/ner-knappar
            const editor = this.Helpers.create_element('div', { class_name: 'info-blocks-order-editor' });
            const info_text = this.Helpers.create_element('p', { 
                class_name: 'field-hint',
                text_content: t('rulefile_info_blocks_order_instruction') || 'Ändra ordningen genom att klicka på pilarna. Denna ordning används för alla krav i regelfilen.'
            });
            editor.appendChild(info_text);

            const list = this.Helpers.create_element('ol', { class_name: 'info-blocks-order-list-editable' });
            const working_order = [...block_order];
            
            working_order.forEach((blockId, index) => {
                const list_item = this.Helpers.create_element('li', { class_name: 'info-blocks-order-item' });
                const item_content = this.Helpers.create_element('div', { class_name: 'info-blocks-order-item-content' });
                item_content.appendChild(this.Helpers.create_element('span', { 
                    text_content: this._get_block_display_name(blockId) 
                }));
                
                const controls = this.Helpers.create_element('div', { class_name: 'info-blocks-order-controls' });
                
                if (index > 0) {
                    const up_btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-small', 'button-default'],
                        attributes: { 
                            type: 'button',
                            'aria-label': t('move_up') || 'Flytta upp'
                        },
                        html_content: this.Helpers.get_icon_svg('arrow_upward', [], 16)
                    });
                    up_btn.addEventListener('click', () => {
                        const temp = working_order[index];
                        working_order[index] = working_order[index - 1];
                        working_order[index - 1] = temp;
                        this._save_info_blocks_order(working_order);
                    });
                    controls.appendChild(up_btn);
                }
                
                if (index < working_order.length - 1) {
                    const down_btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-small', 'button-default'],
                        attributes: { 
                            type: 'button',
                            'aria-label': t('move_down') || 'Flytta ner'
                        },
                        html_content: this.Helpers.get_icon_svg('arrow_downward', [], 16)
                    });
                    down_btn.addEventListener('click', () => {
                        const temp = working_order[index];
                        working_order[index] = working_order[index + 1];
                        working_order[index + 1] = temp;
                        this._save_info_blocks_order(working_order);
                    });
                    controls.appendChild(down_btn);
                }
                
                item_content.appendChild(controls);
                list_item.appendChild(item_content);
                list.appendChild(list_item);
            });
            
            editor.appendChild(list);
            
            const save_button = this.Helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                attributes: { type: 'button' },
                html_content: `<span>${t('save_changes_button')}</span>` + 
                              (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('save') : '')
            });
            save_button.addEventListener('click', () => {
                this._save_info_blocks_order(working_order);
                this.NotificationComponent.show_global_message?.(
                    t('rulefile_info_blocks_order_saved') || 'Info-blocks ordning sparad',
                    'success'
                );
                this.router('rulefile_sections', { section: 'info_blocks_order' });
            });
            
            const cancel_button = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                attributes: { type: 'button' },
                html_content: `<span>${t('cancel')}</span>`
            });
            cancel_button.addEventListener('click', () => {
                this.router('rulefile_sections', { section: 'info_blocks_order' });
            });
            
            const actions = this.Helpers.create_element('div', { class_name: 'form-actions' });
            actions.appendChild(save_button);
            actions.appendChild(cancel_button);
            editor.appendChild(actions);
            
            section.appendChild(editor);
        } else {
            // Visningsläge: visa ordningen
            const list = this.Helpers.create_element('ol', { class_name: 'info-blocks-order-list' });
            block_order.forEach((blockId) => {
                const item = this.Helpers.create_element('li', {
                    text_content: this._get_block_display_name(blockId)
                });
                list.appendChild(item);
            });
            section.appendChild(list);
        }

        return section;
    },

    _save_info_blocks_order(new_order) {
        const state = this.getState();
        const currentRulefile = state?.ruleFileContent || {};
        const metadata = currentRulefile.metadata || {};
        
        if (!metadata.blockOrders) {
            metadata.blockOrders = {};
        }
        metadata.blockOrders.infoBlocks = new_order;
        
        const updatedRulefileContent = {
            ...currentRulefile,
            metadata: {
                ...metadata,
                blockOrders: {
                    ...metadata.blockOrders,
                    infoBlocks: new_order
                }
            }
        };

        this.dispatch({
            type: this.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: { ruleFileContent: updatedRulefileContent }
        });
    },

    async _render_general_edit_form(container, metadata) {
        const is_first_render = !this.general_edit_component;
        
        // Om formuläret redan är renderat, hoppa över (förhindra re-rendering vid autospar)
        if (this.general_edit_component && container.children.length > 0) {
            return;
        }
        
        // Dynamiskt importera EditGeneralSectionComponent
        const { EditGeneralSectionComponent } = await import('./EditGeneralSectionComponent.js');
        
        // Initiera komponenten med container som root
        await EditGeneralSectionComponent.init({
            root: container,
            deps: this.deps
        });
        
        // Rendera formuläret inline
        EditGeneralSectionComponent.render();
        
        // Sätt fokus på första h2 endast när formuläret renderas första gången (när användaren klickar på redigera-knappen)
        // Inte vid autospar/re-rendering
        if (is_first_render && !this.general_form_initial_focus_set) {
            setTimeout(() => {
                const firstH2 = container.querySelector('h2');
                if (firstH2) {
                    firstH2.setAttribute('tabindex', '-1');
                    firstH2.focus();
                    this.general_form_initial_focus_set = true;
                }
            }, 100);
        }
        
        // Spara referens för cleanup
        this.general_edit_component = EditGeneralSectionComponent;
    },

    async _render_page_types_edit_form(container, metadata) {
        const is_first_render = !this.page_types_edit_component;
        
        // Om formuläret redan är renderat, hoppa över (förhindra re-rendering vid autospar)
        if (this.page_types_edit_component && container.children.length > 0) {
            return;
        }
        
        // Dynamiskt importera EditPageTypesSectionComponent
        const { EditPageTypesSectionComponent } = await import('./EditPageTypesSectionComponent.js');
        
        // Initiera komponenten med container som root
        await EditPageTypesSectionComponent.init({
            root: container,
            deps: this.deps
        });
        
        // Rendera formuläret inline
        EditPageTypesSectionComponent.render();
        
        // Sätt fokus på första h2 endast när formuläret renderas första gången (när användaren klickar på redigera-knappen)
        // Inte vid autospar/re-rendering
        if (is_first_render && !this.page_types_form_initial_focus_set) {
            setTimeout(() => {
                const firstH2 = container.querySelector('h2');
                if (firstH2) {
                    firstH2.setAttribute('tabindex', '-1');
                    firstH2.focus();
                    this.page_types_form_initial_focus_set = true;
                }
            }, 100);
        }
        
        // Spara referens för cleanup
        this.page_types_edit_component = EditPageTypesSectionComponent;
    },

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        const state = this.getState();
        const params = this.deps.params || {};
        const section_id = params.section || 'general';
        const is_editing = params.edit === 'true';

        // Viktigt: Kontrollera att vi är i regelfilredigeringsläge
        if (state?.auditStatus !== 'rulefile_editing') {
            this.router('edit_rulefile_main');
            return;
        }

        if (!state?.ruleFileContent?.metadata) {
            this.router('edit_rulefile_main');
            return;
        }

        this.root.innerHTML = '';
        
        // Main wrapper (content-plate) som innehåller allt
        const main_plate = this.Helpers.create_element('div', { class_name: 'content-plate rulefile-sections-main-plate' });
        
        // Global message
        const global_message = this.NotificationComponent.get_global_message_element_reference();
        if (global_message) {
            main_plate.appendChild(global_message);
        }

        // Main heading
        const main_heading = this.Helpers.create_element('h1', { 
            text_content: t('rulefile_sections_title') || 'Regelfilens innehåll' 
        });
        main_plate.appendChild(main_heading);

        // Main layout - flex container för meny och innehåll
        const layout = this.Helpers.create_element('div', { class_name: 'rulefile-sections-layout' });
        
        // Left menu - ligger i main-wrapper
        const left_menu = this._create_left_menu(section_id);
        layout.appendChild(left_menu);

        // Right wrapper - egen wrapper för högerinnehållet
        const right_wrapper = this.Helpers.create_element('div', { class_name: 'rulefile-sections-right-wrapper' });
        
        // Render section content
        const metadata = state.ruleFileContent.metadata;
        let section_content;
        let header_section_config;
        
        // Om vi är i redigeringsläge för general eller page_types, visa formuläret inline
        if (is_editing && (section_id === 'general' || section_id === 'page_types')) {
            header_section_config = this._get_section_config(section_id);
            const header = this._create_header(header_section_config, is_editing);
            right_wrapper.appendChild(header);
            
            // Skapa en container för redigeringsformuläret
            const edit_form_container = this.Helpers.create_element('div', { class_name: 'rulefile-section-edit-form-container' });
            
            // Ladda och rendera rätt redigeringskomponent
            if (section_id === 'general') {
                this._render_general_edit_form(edit_form_container, metadata);
            } else if (section_id === 'page_types') {
                this._render_page_types_edit_form(edit_form_container, metadata);
            }
            
            right_wrapper.appendChild(edit_form_container);
        } else {
            // Normal visningsläge
            switch (section_id) {
                case 'general':
                case 'publisher_source':
                    // publisher_source visas nu i general-sektionen, använd general som rubrik
                    header_section_config = this._get_section_config('general');
                    section_content = this._render_general_section(metadata);
                    break;
                case 'classifications':
                    header_section_config = this._get_section_config(section_id);
                    section_content = this._render_classifications_section(metadata);
                    break;
                case 'page_types':
                    header_section_config = this._get_section_config(section_id);
                    section_content = this._render_page_types_section(metadata);
                    break;
                case 'content_types':
                    header_section_config = this._get_section_config(section_id);
                    section_content = this._render_content_types_section(metadata);
                    break;
                case 'report_template':
                    header_section_config = this._get_section_config(section_id);
                    section_content = this._render_report_template_section(state.ruleFileContent);
                    break;
                case 'info_blocks_order':
                    header_section_config = this._get_section_config(section_id);
                    section_content = this._render_info_blocks_order_section(metadata, is_editing);
                    break;
                default:
                    header_section_config = this._get_section_config('general');
                    section_content = this._render_general_section(metadata);
            }

            // Skapa header för alla sektioner (inklusive page_types)
            const header = this._create_header(header_section_config, is_editing);
            right_wrapper.appendChild(header);
            right_wrapper.appendChild(section_content);
        }
        
        layout.appendChild(right_wrapper);

        main_plate.appendChild(layout);

        // Back button - längst ner i main wrapper
        const back_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            html_content: `<span>${t('back_to_edit_options')}</span>` + 
                          (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('arrow_back') : '')
        });
        back_button.addEventListener('click', () => this.router('edit_rulefile_main'));
        main_plate.appendChild(back_button);

        this.root.appendChild(main_plate);

        // Sätt fokus på h2 om det finns i sessionStorage
        // Men endast om detta är första render (när vi faktiskt navigerar hit)
        // Inte vid autospar/re-rendering när state ändras
        const focusSelector = sessionStorage.getItem('focusAfterLoad');
        if (focusSelector && this.is_initial_render) {
            sessionStorage.removeItem('focusAfterLoad');
            setTimeout(() => {
                const elementToFocus = this.root.querySelector(focusSelector);
                if (elementToFocus) {
                    elementToFocus.setAttribute('tabindex', '-1');
                    elementToFocus.focus();
                }
            }, 100);
        }
        
        // Sätt flaggan till false efter första render
        this.is_initial_render = false;
    },

    destroy() {
        // Cleanup redigeringskomponenter om de finns
        if (this.general_edit_component && typeof this.general_edit_component.destroy === 'function') {
            this.general_edit_component.destroy();
            this.general_edit_component = null;
        }
        if (this.page_types_edit_component && typeof this.page_types_edit_component.destroy === 'function') {
            this.page_types_edit_component.destroy();
            this.page_types_edit_component = null;
        }
        
        // Återställ fokus-flaggorna så att fokus sätts när användaren navigerar tillbaka
        this.general_form_initial_focus_set = false;
        this.page_types_form_initial_focus_set = false;
        
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
    }
};
