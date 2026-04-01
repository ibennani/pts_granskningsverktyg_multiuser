/**
 * @fileoverview Läsvisning för allmän metadata, utgivare/källa, klassificeringar och ”kommer snart”.
 */

import {
    create_definition_list,
    format_date_display,
    create_source_link,
    create_list
} from './rulefile_sections_display_helpers.js';

/**
 * @param {{ Helpers: object, Translation: object }} ctx
 * @param {object} metadata
 */
export function render_rulefile_general_section(ctx, metadata) {
    const t = ctx.Translation.t;
    const Helpers = ctx.Helpers;
    const section = Helpers.create_element('section', { class_name: 'rulefile-section-content' });

    const monitoringDisplay = metadata.monitoringType?.text || metadata.monitoringType?.label || '';

    section.appendChild(create_definition_list(Helpers, [
        [t('rulefile_metadata_field_title'), metadata.title],
        [t('rulefile_metadata_field_description'), metadata.description],
        [t('rulefile_metadata_version_based_on_published'), metadata.version],
        [t('rulefile_metadata_field_language'), metadata.language],
        [t('rulefile_metadata_field_monitoring_type'), monitoringDisplay],
        [t('rulefile_metadata_field_date_created'), format_date_display(metadata.dateCreated)],
        [t('rulefile_metadata_field_date_modified'), format_date_display(metadata.dateModified)],
        [t('rulefile_metadata_field_license'), metadata.license]
    ]));

    const publisher_subsection = Helpers.create_element('div', { class_name: 'metadata-subsection' });
    publisher_subsection.appendChild(Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_publisher') }));
    publisher_subsection.appendChild(create_definition_list(Helpers, [
        [t('rulefile_metadata_field_publisher_name'), metadata.publisher?.name],
        [t('rulefile_metadata_field_publisher_contact'), metadata.publisher?.contactPoint]
    ]));
    section.appendChild(publisher_subsection);

    const source_subsection = Helpers.create_element('div', { class_name: 'metadata-subsection' });
    source_subsection.appendChild(Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_source') }));

    const source_link_node = create_source_link(Helpers, ctx.Translation, metadata.source?.url);
    const source_entries = [
        [t('rulefile_metadata_field_source_title'), metadata.source?.title],
        [t('rulefile_metadata_field_source_retrieved'), format_date_display(metadata.source?.retrievedDate)],
        [t('rulefile_metadata_field_source_format'), metadata.source?.format]
    ];
    const source_section_nodes = [];
    if (source_link_node) {
        const link_container = Helpers.create_element('p');
        link_container.appendChild(source_link_node);
        source_section_nodes.push(link_container);
    }
    const source_definition_list = create_definition_list(Helpers, source_entries);
    if (source_definition_list.childNodes.length > 0) {
        source_section_nodes.push(source_definition_list);
    }
    source_section_nodes.forEach(node => source_subsection.appendChild(node));
    section.appendChild(source_subsection);

    return section;
}

/**
 * @param {{ Helpers: object, Translation: object }} ctx
 * @param {object} metadata
 */
export function render_rulefile_publisher_source_section(ctx, metadata) {
    const t = ctx.Translation.t;
    const Helpers = ctx.Helpers;
    const section = Helpers.create_element('section', { class_name: 'rulefile-section-content' });

    const publisher_section = Helpers.create_element('div', { class_name: 'metadata-subsection' });
    publisher_section.appendChild(Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_publisher') }));
    publisher_section.appendChild(create_definition_list(Helpers, [
        [t('rulefile_metadata_field_publisher_name'), metadata.publisher?.name],
        [t('rulefile_metadata_field_publisher_contact'), metadata.publisher?.contactPoint]
    ]));
    section.appendChild(publisher_section);

    const source_section = Helpers.create_element('div', { class_name: 'metadata-subsection' });
    source_section.appendChild(Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_source') }));

    const source_link_node = create_source_link(Helpers, ctx.Translation, metadata.source?.url);
    const source_entries = [
        [t('rulefile_metadata_field_source_title'), metadata.source?.title],
        [t('rulefile_metadata_field_source_retrieved'), format_date_display(metadata.source?.retrievedDate)],
        [t('rulefile_metadata_field_source_format'), metadata.source?.format]
    ];
    const source_section_nodes = [];
    if (source_link_node) {
        const link_container = Helpers.create_element('p');
        link_container.appendChild(source_link_node);
        source_section_nodes.push(link_container);
    }
    const source_definition_list = create_definition_list(Helpers, source_entries);
    if (source_definition_list.childNodes.length > 0) {
        source_section_nodes.push(source_definition_list);
    }
    source_section_nodes.forEach(node => source_section.appendChild(node));
    section.appendChild(source_section);

    return section;
}

/**
 * @param {{ Helpers: object, Translation: object }} ctx
 * @param {object} metadata
 */
export function render_rulefile_classifications_section(ctx, metadata) {
    const t = ctx.Translation.t;
    const Helpers = ctx.Helpers;
    const section = Helpers.create_element('section', { class_name: 'rulefile-section-content' });

    const vocabularies = metadata.vocabularies || {};
    const taxonomies = vocabularies.taxonomies || metadata.taxonomies || [];

    const keywords_subsection = Helpers.create_element('div', { class_name: 'metadata-subsection' });
    keywords_subsection.appendChild(Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_keywords') }));
    keywords_subsection.appendChild(create_list(Helpers, t, metadata.keywords, 'rulefile_metadata_empty_value', 'metadata-list'));
    section.appendChild(keywords_subsection);

    const samples_subsection = Helpers.create_element('div', { class_name: 'metadata-subsection' });
    samples_subsection.appendChild(Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_samples') }));
    const samples = metadata.samples || {};
    if (Array.isArray(samples.sampleCategories) && samples.sampleCategories.length > 0) {
        const categoriesWrapper = Helpers.create_element('div', { class_name: 'metadata-card-grid' });
        samples.sampleCategories.forEach(category => {
            const card = Helpers.create_element('article', { class_name: 'metadata-card' });
            card.appendChild(Helpers.create_element('h2', {
                text_content: category.text || category.id || t('rulefile_metadata_untitled_item')
            }));
            if (typeof category.hasUrl === 'boolean') {
                const tag_text = category.hasUrl ? t('rulefile_metadata_has_url_yes') : t('rulefile_metadata_has_url_no');
                card.appendChild(Helpers.create_element('p', {
                    class_name: 'metadata-tag',
                    text_content: tag_text
                }));
            }
            if (Array.isArray(category.categories) && category.categories.length > 0) {
                const list = Helpers.create_element('ul', { class_name: 'metadata-sub-list' });
                category.categories.forEach(subCategory => {
                    list.appendChild(Helpers.create_element('li', {
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
        const types_card = Helpers.create_element('article', { class_name: 'metadata-card' });
        types_card.appendChild(Helpers.create_element('h3', { text_content: t('rulefile_metadata_sample_types') }));
        types_card.appendChild(create_list(Helpers, t, samples.sampleTypes, 'rulefile_metadata_empty_value', 'metadata-list'));
        samples_subsection.appendChild(types_card);
    }
    if (samples_subsection.children.length === 1) {
        samples_subsection.appendChild(Helpers.create_element('p', {
            class_name: 'metadata-empty',
            text_content: t('rulefile_metadata_empty_value')
        }));
    }
    section.appendChild(samples_subsection);

    const taxonomies_subsection = Helpers.create_element('div', { class_name: 'metadata-subsection' });
    taxonomies_subsection.appendChild(Helpers.create_element('h2', { text_content: t('rulefile_metadata_section_taxonomies') }));
    if (!Array.isArray(taxonomies) || taxonomies.length === 0) {
        taxonomies_subsection.appendChild(Helpers.create_element('p', {
            class_name: 'metadata-empty',
            text_content: t('rulefile_metadata_empty_value')
        }));
    } else {
        const wrapper = Helpers.create_element('div', { class_name: 'metadata-card-grid' });
        taxonomies.forEach(taxonomy => {
            const card = Helpers.create_element('article', { class_name: 'metadata-card' });
            card.appendChild(Helpers.create_element('h2', {
                text_content: taxonomy.label || taxonomy.id || t('rulefile_metadata_untitled_item')
            }));
            const infoList = create_definition_list(Helpers, [
                [t('rulefile_metadata_field_taxonomy_id'), taxonomy.id],
                [t('rulefile_metadata_field_taxonomy_version'), taxonomy.version],
                [t('rulefile_metadata_field_taxonomy_uri'), taxonomy.uri]
            ]);
            if (infoList.childNodes.length > 0) {
                card.appendChild(infoList);
            }
            if (Array.isArray(taxonomy.concepts) && taxonomy.concepts.length > 0) {
                const list = Helpers.create_element('ul', { class_name: 'metadata-sub-list' });
                taxonomy.concepts.forEach(concept => {
                    list.appendChild(Helpers.create_element('li', {
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
}

/**
 * @param {{ Helpers: object, Translation: object }} ctx
 */
export function render_rulefile_coming_soon_section(ctx) {
    const t = ctx.Translation.t;
    const Helpers = ctx.Helpers;
    const section = Helpers.create_element('section', { class_name: 'rulefile-section-content' });
    section.appendChild(Helpers.create_element('p', {
        class_name: 'rulefile-section-coming-soon',
        text_content: t('rulefile_section_coming_soon')
    }));
    return section;
}
