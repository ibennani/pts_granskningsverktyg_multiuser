// js/components/RulefileMetadataViewComponent.js

export const RulefileMetadataViewComponent = (function () {
    'use-strict';

    const CSS_PATH = 'css/components/rulefile_metadata_view_component.css';

    let app_container_ref;
    let router_ref;
    let local_getState;

    let Translation_t;
    let Helpers_create_element;
    let Helpers_get_icon_svg;
    let Helpers_add_protocol_if_missing;
    let NotificationComponent_get_global_message_element_reference;

    let is_css_loaded = false;

    function assign_globals_once() {
        if (Translation_t) return;
        Translation_t = window.Translation?.t;
        Helpers_create_element = window.Helpers?.create_element;
        Helpers_get_icon_svg = window.Helpers?.get_icon_svg;
        Helpers_add_protocol_if_missing = window.Helpers?.add_protocol_if_missing;
        NotificationComponent_get_global_message_element_reference = window.NotificationComponent?.get_global_message_element_reference;
    }

    async function init(_app_container, _router_cb, _params, _getState) {
        assign_globals_once();
        app_container_ref = _app_container;
        router_ref = _router_cb;
        local_getState = _getState;

        if (!is_css_loaded && window.Helpers?.load_css) {
            try {
                await window.Helpers.load_css(CSS_PATH);
                is_css_loaded = true;
            } catch (error) {
                console.warn('[RulefileMetadataViewComponent] Failed to load CSS. Continuing without dedicated styles.', error);
            }
        }
    }

    function _ensure_dependencies() {
        if (!Helpers_create_element || !Translation_t) {
            throw new Error('RulefileMetadataViewComponent: Missing required global helpers.');
        }
    }

    function _format_simple_value(value) {
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
    }

    function _create_definition_list(entries) {
        const dl = Helpers_create_element('dl', { class_name: 'metadata-definition-list' });
        entries.forEach(([label, value]) => {
            if (value === undefined || value === null || value === '') {
                return;
            }
            dl.appendChild(Helpers_create_element('dt', { text_content: String(label) }));
            if (Array.isArray(value)) {
                const list = Helpers_create_element('ul', { class_name: 'metadata-inline-list' });
                value.filter(Boolean).forEach(item => {
                    list.appendChild(Helpers_create_element('li', { text_content: _format_simple_value(item) }));
                });
                dl.appendChild(Helpers_create_element('dd', {})).appendChild(list);
            } else {
                dl.appendChild(Helpers_create_element('dd', { text_content: _format_simple_value(value) }));
            }
        });
        return dl;
    }

    function _create_section(title_key, content_nodes = []) {
        const section = Helpers_create_element('section', { class_name: 'metadata-section' });
        if (title_key) {
            section.appendChild(Helpers_create_element('h2', { text_content: Translation_t(title_key) }));
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
            const wrapper = Helpers_create_element('article', { class_name: ['metadata-card', 'metadata-section-card'] });
            valid_nodes.forEach(node => wrapper.appendChild(node));
            section.appendChild(wrapper);
        }
        return section;
    }

    function _create_list(items, empty_key, class_name = 'metadata-list') {
        if (!Array.isArray(items) || items.length === 0) {
            return Helpers_create_element('p', { class_name: 'metadata-empty', text_content: Translation_t(empty_key) });
        }
        const ul = Helpers_create_element('ul', { class_name });
        items.filter(Boolean).forEach(item => {
            const content = _format_simple_value(item);
            if (!content) return;
            ul.appendChild(Helpers_create_element('li', { text_content: content }));
        });
        return ul;
    }

    function _create_content_types_section(content_types) {
        const t = Translation_t;
        if (!Array.isArray(content_types) || content_types.length === 0) {
            return _create_section('rulefile_metadata_section_content_types', [
                Helpers_create_element('p', { class_name: 'metadata-empty', text_content: t('rulefile_metadata_empty_value') })
            ]);
        }

        const root_list = Helpers_create_element('ul', { class_name: 'metadata-nested-list' });

        content_types.forEach(parent => {
            const parent_item = Helpers_create_element('li');
            parent_item.appendChild(Helpers_create_element('span', { class_name: 'metadata-subject', text_content: parent.text || parent.id || t('rulefile_metadata_untitled_item') }));
            if (parent.description) {
                parent_item.appendChild(Helpers_create_element('p', { class_name: 'metadata-description', text_content: parent.description }));
            }
            if (Array.isArray(parent.types) && parent.types.length > 0) {
                const child_list = Helpers_create_element('ul', { class_name: 'metadata-nested-list-child' });
                parent.types.forEach(child => {
                    const child_item = Helpers_create_element('li');
                    child_item.appendChild(Helpers_create_element('span', { class_name: 'metadata-subject', text_content: child.text || child.id || t('rulefile_metadata_untitled_item') }));
                    if (child.description) {
                        child_item.appendChild(Helpers_create_element('p', { class_name: 'metadata-description', text_content: child.description }));
                    }
                    child_list.appendChild(child_item);
                });
                parent_item.appendChild(child_list);
            }
            root_list.appendChild(parent_item);
        });

        return _create_section('rulefile_metadata_section_content_types', [root_list]);
    }

    function _create_samples_section(samples) {
        const t = Translation_t;
        if (!samples || (Array.isArray(samples) && samples.length === 0)) {
            return _create_section('rulefile_metadata_section_samples', [
                Helpers_create_element('p', { class_name: 'metadata-empty', text_content: t('rulefile_metadata_empty_value') })
            ]);
        }

        const nodes = [];
        const sampleCategories = samples.sampleCategories;
        if (Array.isArray(sampleCategories) && sampleCategories.length > 0) {
            const categoriesWrapper = Helpers_create_element('div', { class_name: 'metadata-card-grid' });
            sampleCategories.forEach(category => {
                const card = Helpers_create_element('article', { class_name: 'metadata-card' });
                card.appendChild(Helpers_create_element('h3', { text_content: category.text || category.id || t('rulefile_metadata_untitled_item') }));
                if (typeof category.hasUrl === 'boolean') {
                    const tag_text = category.hasUrl ? t('rulefile_metadata_has_url_yes') : t('rulefile_metadata_has_url_no');
                    card.appendChild(Helpers_create_element('p', { class_name: 'metadata-tag', text_content: tag_text }));
                }
                if (Array.isArray(category.categories) && category.categories.length > 0) {
                    const list = Helpers_create_element('ul', { class_name: 'metadata-sub-list' });
                    category.categories.forEach(subCategory => {
                        list.appendChild(Helpers_create_element('li', { text_content: subCategory.text || subCategory.id || t('rulefile_metadata_untitled_item') }));
                    });
                    card.appendChild(list);
                }
                categoriesWrapper.appendChild(card);
            });
            nodes.push(categoriesWrapper);
        }

        if (Array.isArray(samples.sampleTypes) && samples.sampleTypes.length > 0) {
            const types_card = Helpers_create_element('article', { class_name: 'metadata-card' });
            types_card.appendChild(Helpers_create_element('h3', { text_content: t('rulefile_metadata_sample_types') }));
            types_card.appendChild(_create_list(samples.sampleTypes, 'rulefile_metadata_empty_value', 'metadata-list'));
            nodes.push(types_card);
        }

        if (nodes.length === 0) {
            nodes.push(Helpers_create_element('p', { class_name: 'metadata-empty', text_content: t('rulefile_metadata_empty_value') }));
        }

        return _create_section('rulefile_metadata_section_samples', nodes);
    }

    function _create_taxonomies_section(taxonomies) {
        const t = Translation_t;
        if (!Array.isArray(taxonomies) || taxonomies.length === 0) {
            return _create_section('rulefile_metadata_section_taxonomies', [
                Helpers_create_element('p', { class_name: 'metadata-empty', text_content: t('rulefile_metadata_empty_value') })
            ]);
        }

        const wrapper = Helpers_create_element('div', { class_name: 'metadata-card-grid' });
        taxonomies.forEach(taxonomy => {
            const card = Helpers_create_element('article', { class_name: 'metadata-card' });
            card.appendChild(Helpers_create_element('h3', { text_content: taxonomy.label || taxonomy.id || t('rulefile_metadata_untitled_item') }));
            const infoList = _create_definition_list([
                [t('rulefile_metadata_field_taxonomy_id'), taxonomy.id],
                [t('rulefile_metadata_field_taxonomy_version'), taxonomy.version],
                [t('rulefile_metadata_field_taxonomy_uri'), taxonomy.uri]
            ]);
            if (infoList.childNodes.length > 0) {
                card.appendChild(infoList);
            }
            if (Array.isArray(taxonomy.concepts) && taxonomy.concepts.length > 0) {
                const list = Helpers_create_element('ul', { class_name: 'metadata-sub-list' });
                taxonomy.concepts.forEach(concept => {
                    const item = Helpers_create_element('li', { text_content: concept.label || concept.id || t('rulefile_metadata_untitled_item') });
                    list.appendChild(item);
                });
                card.appendChild(list);
            }
            wrapper.appendChild(card);
        });

        return _create_section('rulefile_metadata_section_taxonomies', [wrapper]);
    }

    function _create_source_link(source_url) {
        const clean_url = Helpers_add_protocol_if_missing ? Helpers_add_protocol_if_missing(source_url) : source_url;
        if (!clean_url) return null;
        return Helpers_create_element('a', {
            text_content: source_url,
            attributes: {
                href: clean_url,
                target: '_blank',
                rel: 'noopener noreferrer'
            }
        });
    }

    function _format_date_display(iso_string) {
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
    }

    function render() {
        _ensure_dependencies();
        const t = Translation_t;

        app_container_ref.innerHTML = '';
        const plate = Helpers_create_element('div', { class_name: ['content-plate', 'rulefile-metadata-plate'] });

        const global_message_element = NotificationComponent_get_global_message_element_reference?.();
        if (global_message_element) {
            plate.appendChild(global_message_element);
        }

        const header_wrapper = Helpers_create_element('div', { class_name: 'metadata-header' });
        const heading = Helpers_create_element('h1', { text_content: t('rulefile_metadata_title') });
        const edit_button = Helpers_create_element('button', {
            class_name: ['button', 'button-secondary', 'metadata-edit-button'],
            attributes: {
                type: 'button',
                'aria-label': t('rulefile_metadata_edit_button_aria')
            },
            html_content: `<span>${t('rulefile_metadata_edit_button')}</span>` + (Helpers_get_icon_svg ? Helpers_get_icon_svg('edit') : '')
        });
        edit_button.addEventListener('click', () => router_ref('rulefile_metadata_edit'));

        header_wrapper.appendChild(heading);
        header_wrapper.appendChild(edit_button);

        plate.appendChild(header_wrapper);
        plate.appendChild(Helpers_create_element('p', { class_name: 'view-intro-text', text_content: t('rulefile_metadata_intro') }));

        const current_state = typeof local_getState === 'function' ? local_getState() : {};
        const metadata = current_state?.ruleFileContent?.metadata;

        if (!metadata) {
            plate.appendChild(Helpers_create_element('p', { class_name: 'metadata-empty', text_content: t('rulefile_metadata_missing') }));
        } else {
            const monitoringText = metadata.monitoringType?.text || metadata.monitoringType?.label || '';
            const monitoringKey = metadata.monitoringType?.type || '';
            const monitoringDisplay = monitoringText
                ? (monitoringKey && monitoringKey !== monitoringText ? `${monitoringText} (${monitoringKey})` : monitoringText)
                : monitoringKey;

            const general_section = _create_section('rulefile_metadata_section_general', [
                _create_definition_list([
                    [t('rulefile_metadata_field_title'), metadata.title],
                    [t('rulefile_metadata_field_description'), metadata.description],
                    [t('rulefile_metadata_field_version'), metadata.version],
                    [t('rulefile_metadata_field_language'), metadata.language],
                    [t('rulefile_metadata_field_monitoring_type'), monitoringDisplay],
                    [t('rulefile_metadata_field_date_created'), _format_date_display(metadata.dateCreated)],
                    [t('rulefile_metadata_field_date_modified'), _format_date_display(metadata.dateModified)],
                    [t('rulefile_metadata_field_license'), metadata.license]
                ])
            ]);

            const publisher_section = _create_section('rulefile_metadata_section_publisher', [
                _create_definition_list([
                    [t('rulefile_metadata_field_publisher_name'), metadata.publisher?.name],
                    [t('rulefile_metadata_field_publisher_contact'), metadata.publisher?.contactPoint]
                ])
            ]);

            const source_link_node = _create_source_link(metadata.source?.url);
            const source_entries = [
                [t('rulefile_metadata_field_source_title'), metadata.source?.title],
                [t('rulefile_metadata_field_source_retrieved'), _format_date_display(metadata.source?.retrievedDate)],
                [t('rulefile_metadata_field_source_format'), metadata.source?.format]
            ];
            const source_section_nodes = [];
            if (source_link_node) {
                const link_container = Helpers_create_element('p');
                link_container.appendChild(source_link_node);
                source_section_nodes.push(link_container);
            }
            const source_definition_list = _create_definition_list(source_entries);
            if (source_definition_list.childNodes.length > 0) {
                source_section_nodes.push(source_definition_list);
            }
            const source_section = _create_section('rulefile_metadata_section_source', source_section_nodes);

            const keywords_section = _create_section('rulefile_metadata_section_keywords', [
                _create_list(metadata.keywords, 'rulefile_metadata_empty_value', 'metadata-list')
            ]);

            const page_types_section = _create_section('rulefile_metadata_section_page_types', [
                _create_list(metadata.pageTypes, 'rulefile_metadata_empty_value', 'metadata-list')
            ]);

            const content_types_section = _create_content_types_section(metadata.contentTypes);
            const samples_section = _create_samples_section(metadata.samples);
            const taxonomies_section = _create_taxonomies_section(metadata.taxonomies);

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

        const actions_div = Helpers_create_element('div', { class_name: 'form-actions', style: 'margin-top: 2rem; justify-content: flex-start;' });
        const back_button = Helpers_create_element('button', {
            class_name: ['button', 'button-default'],
            html_content: `<span>${t('back_to_edit_options')}</span>` + (Helpers_get_icon_svg ? Helpers_get_icon_svg('arrow_back') : '')
        });
        back_button.addEventListener('click', () => router_ref('edit_rulefile_main'));
        actions_div.appendChild(back_button);
        plate.appendChild(actions_div);

        app_container_ref.appendChild(plate);
    }

    function destroy() {
        if (app_container_ref) {
            app_container_ref.innerHTML = '';
        }
    }

    return { init, render, destroy };
})();
