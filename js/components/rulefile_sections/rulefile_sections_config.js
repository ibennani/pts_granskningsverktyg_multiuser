/**
 * @fileoverview Sektionsmetadata (id, titel, rutter) för regelfilssektionernas vy.
 */

/**
 * @param {string} section_id
 * @param {(key: string, opts?: object) => string} t
 */
export function get_section_config(section_id, t) {
    const sections = {
        general: {
            id: 'general',
            title: t('rulefile_section_general_title'),
            editRoute: 'rulefile_sections',
            editSection: 'general',
            isEditable: true
        },
        publisher_source: {
            id: 'publisher_source',
            title: t('rulefile_section_publisher_source_title'),
            editRoute: 'rulefile_metadata_edit',
            editSection: 'publisher_source'
        },
        classifications: {
            id: 'classifications',
            title: t('rulefile_section_classifications_title'),
            editRoute: 'rulefile_sections',
            editSection: 'classifications'
        },
        page_types: {
            id: 'page_types',
            title: t('rulefile_metadata_section_page_types'),
            editRoute: 'rulefile_sections',
            editSection: 'page_types',
            isEditable: true
        },
        content_types: {
            id: 'content_types',
            title: t('rulefile_metadata_section_content_types'),
            editRoute: 'rulefile_sections',
            editSection: 'content_types',
            isEditable: true
        },
        report_template: {
            id: 'report_template',
            title: t('rulefile_section_report_template_title'),
            editRoute: 'rulefile_sections',
            editSection: 'report_template'
        },
        info_blocks_order: {
            id: 'info_blocks_order',
            title: t('rulefile_section_info_blocks_order_title'),
            editRoute: 'rulefile_sections',
            editSection: 'info_blocks_order',
            isEditable: true
        }
    };
    return sections[section_id] || sections.general;
}
