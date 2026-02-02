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
            { id: 'general', label: t('rulefile_section_general_title') || 'Allmän information', icon: 'info' },
            { id: 'publisher_source', label: t('rulefile_section_publisher_source_title') || 'Utgivare & källa', icon: 'person' },
            { id: 'classifications', label: t('rulefile_section_classifications_title') || 'Klassificeringar', icon: 'label' },
            { id: 'report_template', label: t('rulefile_section_report_template_title') || 'Rapportmall', icon: 'description' },
            { id: 'info_blocks_order', label: t('rulefile_section_info_blocks_order_title') || 'Info-blocks ordning', icon: 'view_list' }
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
                html_content: (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg(section.icon, [], 20) : '') + 
                              `<span>${section.label}</span>`
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

    _create_header(section_config) {
        const t = this.Translation.t;
        const header_wrapper = this.Helpers.create_element('div', { class_name: 'rulefile-sections-header' });
        
        const heading = this.Helpers.create_element('h1', { text_content: section_config.title });
        
        const edit_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-secondary', 'rulefile-sections-edit-button'],
            attributes: {
                type: 'button',
                'aria-label': t('rulefile_sections_edit_button_aria', { sectionName: section_config.title }) || 
                             `Redigera ${section_config.title}`
            },
            html_content: `<span>${t('edit_button_label') || 'Redigera'}</span>` + 
                          (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('edit') : '')
        });
        
        edit_button.addEventListener('click', () => {
            if (section_config.isEditable) {
                // För info_blocks_order, växla till redigeringsläge i samma vy
                this.router('rulefile_sections', { section: section_config.id, edit: 'true' });
            } else {
                // För andra sektioner, gå till metadata-edit
                this.router(section_config.editRoute);
            }
        });

        header_wrapper.appendChild(heading);
        header_wrapper.appendChild(edit_button);
        
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
        
        const monitoringText = metadata.monitoringType?.text || metadata.monitoringType?.label || '';
        const monitoringKey = metadata.monitoringType?.type || '';
        const monitoringDisplay = monitoringText
            ? (monitoringKey && monitoringKey !== monitoringText ? `${monitoringText} (${monitoringKey})` : monitoringText)
            : monitoringKey;

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
        const page_types = vocabularies.pageTypes || metadata.pageTypes || [];
        const content_types = vocabularies.contentTypes || metadata.contentTypes || [];
        const taxonomies = vocabularies.taxonomies || metadata.taxonomies || [];

        // Keywords
        const keywords_subsection = this.Helpers.create_element('div', { class_name: 'metadata-subsection' });
        keywords_subsection.appendChild(this.Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_keywords') }));
        keywords_subsection.appendChild(this._create_list(metadata.keywords, 'rulefile_metadata_empty_value', 'metadata-list'));
        section.appendChild(keywords_subsection);

        // Page Types
        const page_types_subsection = this.Helpers.create_element('div', { class_name: 'metadata-subsection' });
        page_types_subsection.appendChild(this.Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_page_types') }));
        page_types_subsection.appendChild(this._create_list(page_types, 'rulefile_metadata_empty_value', 'metadata-list'));
        section.appendChild(page_types_subsection);

        // Content Types
        const content_types_subsection = this.Helpers.create_element('div', { class_name: 'metadata-subsection' });
        content_types_subsection.appendChild(this.Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_content_types') }));
        if (!Array.isArray(content_types) || content_types.length === 0) {
            content_types_subsection.appendChild(this.Helpers.create_element('p', { 
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
            content_types_subsection.appendChild(root_list);
        }
        section.appendChild(content_types_subsection);

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
            'expectedObservation': t('requirement_expected_observation') || 'Förväntad observation',
            'instructions': t('requirement_instructions') || 'Instruktioner',
            'exceptions': t('requirement_exceptions') || 'Undantag',
            'commonErrors': t('requirement_common_errors') || 'Vanliga fel',
            'tips': t('requirement_tips') || 'Tips',
            'examples': t('requirement_examples') || 'Exempel'
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
                html_content: `<span>${t('save_changes_button') || 'Spara ändringar'}</span>` + 
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
                html_content: `<span>${t('cancel') || 'Avbryt'}</span>`
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
        
        const container = this.Helpers.create_element('div', { class_name: 'rulefile-sections-container' });
        
        // Global message
        const global_message = this.NotificationComponent.get_global_message_element_reference();
        if (global_message) {
            container.appendChild(global_message);
        }

        // Back button
        const back_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            html_content: `<span>${t('back_to_edit_options') || 'Tillbaka'}</span>` + 
                          (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('arrow_back') : '')
        });
        back_button.addEventListener('click', () => this.router('edit_rulefile_main'));
        container.appendChild(back_button);

        // Main layout
        const layout = this.Helpers.create_element('div', { class_name: 'rulefile-sections-layout' });
        
        // Left menu
        const left_menu = this._create_left_menu(section_id);
        layout.appendChild(left_menu);

        // Content area
        const content_area = this.Helpers.create_element('div', { class_name: 'rulefile-sections-content-area' });
        const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });

        const section_config = this._get_section_config(section_id);
        const header = this._create_header(section_config);
        plate.appendChild(header);

        // Render section content
        const metadata = state.ruleFileContent.metadata;
        let section_content;
        
        switch (section_id) {
            case 'general':
                section_content = this._render_general_section(metadata);
                break;
            case 'publisher_source':
                section_content = this._render_publisher_source_section(metadata);
                break;
            case 'classifications':
                section_content = this._render_classifications_section(metadata);
                break;
            case 'report_template':
                section_content = this._render_report_template_section(state.ruleFileContent);
                break;
            case 'info_blocks_order':
                section_content = this._render_info_blocks_order_section(metadata, is_editing);
                break;
            default:
                section_content = this._render_general_section(metadata);
        }

        plate.appendChild(section_content);
        content_area.appendChild(plate);
        layout.appendChild(content_area);

        container.appendChild(layout);
        this.root.appendChild(container);
    },

    destroy() {
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
    }
};
