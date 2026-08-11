/**
 * @fileoverview Läsvisning för sidtyper, innehållstyper, rapportmall, informationsblock.
 */

import { format_simple_value } from './rulefile_sections_display_helpers.js';
import {
    resolve_content_types,
    resolve_page_types,
    resolve_sample_vocab
} from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import { read_rulefile_appendix1_body_text } from '../../logic/appendix1_sections.js';
import { read_rulefile_appendix2_labels, filter_editable_appendix2_deficiency_columns } from '../../logic/appendix2_excel_template.js';
import { read_rulefile_appendix3_template } from '../../logic/appendix3_screenshots_template.js';
import { render_appendix1_summary_editor_page } from '../../utils/appendix1_summary_editor_render.js';
import {
    create_rulefile_appendix_edit_button,
    render_rulefile_appendix_templates_hub,
} from './rulefile_appendix_templates_render.js';
import { can_edit_rulefile } from '../../utils/helpers.js';
import '../../components/markdown_preview_editor.css';

/**
 * @param {{ info_blocks_edit_component?: { flush_to_state?: function } }} ctx
 */
export function flush_info_blocks_order_from_dom(ctx) {
    if (ctx.info_blocks_edit_component && typeof ctx.info_blocks_edit_component.flush_to_state === 'function') {
        ctx.info_blocks_edit_component.flush_to_state();
    }
}

/**
 * @param {(key: string) => string} t
 * @param {string} block_id
 */
export function get_block_display_name(t, block_id) {
    const name_map = {
        'expectedObservation': t('requirement_expected_observation'),
        'instructions': t('requirement_instructions'),
        'exceptions': t('requirement_exceptions'),
        'commonErrors': t('requirement_common_errors'),
        'tips': t('requirement_tips'),
        'examples': t('requirement_examples')
    };
    return name_map[block_id] || block_id;
}

/**
 * @param {function} getState
 * @param {string} block_id
 */
export function get_custom_block_name_from_requirements(getState, block_id) {
    const requirements = getState()?.ruleFileContent?.requirements || {};
    for (const req of Object.values(requirements)) {
        const name = req?.infoBlocks?.[block_id]?.name;
        if (typeof name === 'string') return name;
    }
    return '';
}

/**
 * @param {{ Helpers: object, Translation: object, getState: function }} ctx
 * @param {object} metadata
 */
export function render_rulefile_page_types_section(ctx, metadata) {
    const t = ctx.Translation.t;
    const Helpers = ctx.Helpers;
    const section = Helpers.create_element('section', { class_name: 'rulefile-section-content' });

    let page_types = resolve_page_types(metadata);

    const sample_vocab = resolve_sample_vocab(metadata);
    let sample_categories = sample_vocab.sampleCategories;

    if (!Array.isArray(page_types) || page_types.length === 0) {
        if (Array.isArray(sample_categories) && sample_categories.length > 0) {
            page_types = sample_categories.map(cat => cat.text || cat.id).filter(Boolean);
        }
    }

    if (!Array.isArray(page_types) || page_types.length === 0) {
        section.appendChild(Helpers.create_element('p', {
            class_name: 'metadata-empty',
            text_content: t('rulefile_metadata_empty_value')
        }));
        return section;
    }

    const list_heading = Helpers.create_element('h2', {
        text_content: t('rulefile_page_types_current_list_title'),
        class_name: 'page-types-list-heading'
    });
    section.appendChild(list_heading);
    const list_intro = Helpers.create_element('p', {
        class_name: 'field-hint rulefile-sections-header-intro page-types-list-intro',
        text_content: t('rulefile_page_types_current_list_intro')
    });
    section.appendChild(list_intro);

    page_types.forEach((page_type, index) => {
        const page_type_str = format_simple_value(page_type) || String(page_type);
        const page_type_normalized = page_type_str.toLowerCase().trim();

        let matching_category = sample_categories.find(cat => {
            const cat_text = (cat.text || '').toLowerCase().trim();
            return cat_text === page_type_normalized;
        });

        if (!matching_category) {
            matching_category = sample_categories.find(cat => {
                const cat_text = (cat.text || '').toLowerCase().trim();
                const cat_id = (cat.id || '').toLowerCase().trim();
                const cat_id_without_dashes = cat_id.replace(/-/g, ' ').trim();

                return cat_id === page_type_normalized ||
                       cat_id_without_dashes === page_type_normalized ||
                       cat_id.replace(/-/g, '') === page_type_normalized.replace(/\s+/g, '') ||
                       cat_text.includes(page_type_normalized) ||
                       page_type_normalized.includes(cat_text);
            });
        }

        if (!matching_category && index < sample_categories.length) {
            matching_category = sample_categories[index];
        }

        if (!matching_category) {
            console.warn('[RulefileSectionsViewComponent] No matching category found for page type:', page_type_str, 'Available categories:', sample_categories.map(c => c.text || c.id));
        } else if (!Array.isArray(matching_category.categories) || matching_category.categories.length === 0) {
            console.warn('[RulefileSectionsViewComponent] Matching category found but no categories array:', matching_category);
        }

        const page_type_wrapper = Helpers.create_element('div', { class_name: 'page-type-item' });

        const heading = Helpers.create_element('h3', {
            text_content: page_type_str,
            class_name: 'page-type-heading'
        });
        page_type_wrapper.appendChild(heading);

        if (matching_category && Array.isArray(matching_category.categories) && matching_category.categories.length > 0) {
            const categories_list = Helpers.create_element('ul', { class_name: 'metadata-list' });
            matching_category.categories.forEach(category => {
                const category_text = category.text || category.id || t('rulefile_metadata_untitled_item');
                const list_item = Helpers.create_element('li', { text_content: category_text });
                categories_list.appendChild(list_item);
            });
            page_type_wrapper.appendChild(categories_list);
        } else {
            const empty_msg = Helpers.create_element('p', {
                class_name: 'metadata-empty page-type-empty',
                text_content: t('rulefile_metadata_empty_value')
            });
            page_type_wrapper.appendChild(empty_msg);
        }

        section.appendChild(page_type_wrapper);

        if (index < page_types.length - 1) {
            const spacer = Helpers.create_element('div', { style: 'margin-bottom: 2rem;' });
            section.appendChild(spacer);
        }
    });

    return section;
}

/**
 * @param {{ Helpers: object, Translation: object }} ctx
 * @param {object} metadata
 */
export function render_rulefile_content_types_section(ctx, metadata) {
    const t = ctx.Translation.t;
    const Helpers = ctx.Helpers;
    const section = Helpers.create_element('section', { class_name: 'rulefile-section-content' });

    const content_types = resolve_content_types(metadata);

    if (!Array.isArray(content_types) || content_types.length === 0) {
        section.appendChild(Helpers.create_element('p', {
            class_name: 'metadata-empty',
            text_content: t('rulefile_metadata_empty_value')
        }));
    } else {
        const root_list = Helpers.create_element('ul', { class_name: 'metadata-nested-list' });
        content_types.forEach(parent => {
            const parent_item = Helpers.create_element('li');
            parent_item.appendChild(Helpers.create_element('span', {
                class_name: 'metadata-subject',
                text_content: parent.text || parent.id || t('rulefile_metadata_untitled_item')
            }));
            if (parent.description) {
                parent_item.appendChild(Helpers.create_element('p', {
                    class_name: 'metadata-description',
                    text_content: parent.description
                }));
            }
            if (Array.isArray(parent.types) && parent.types.length > 0) {
                const child_list = Helpers.create_element('ul', { class_name: 'metadata-nested-list-child' });
                parent.types.forEach(child => {
                    const child_item = Helpers.create_element('li');
                    child_item.appendChild(Helpers.create_element('span', {
                        class_name: 'metadata-subject',
                        text_content: child.text || child.id || t('rulefile_metadata_untitled_item')
                    }));
                    if (child.description) {
                        child_item.appendChild(Helpers.create_element('p', {
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
}

/**
 * @param {{ Helpers: object, Translation: object, router: function }} ctx
 */
export function render_rulefile_appendix_templates_hub_section(ctx) {
    const Helpers = ctx.Helpers;
    const section = Helpers.create_element('section', { class_name: 'rulefile-section-content' });
    render_rulefile_appendix_templates_hub(
        { Helpers: ctx.Helpers, Translation: ctx.Translation, router: ctx.router },
        section
    );
    return section;
}

/**
 * @param {{ Helpers: object, Translation: object, router?: function, getState?: function }} ctx
 * @param {object} ruleFileContent
 * @param {{ body_text?: string, page_header_action?: HTMLElement }} [options]
 */
export function render_rulefile_appendix1_template_section(ctx, ruleFileContent, options = {}) {
    const Helpers = ctx.Helpers;
    const section = Helpers.create_element('section', { class_name: 'rulefile-section-content' });
    const body_text =
        typeof options.body_text === 'string'
            ? options.body_text
            : read_rulefile_appendix1_body_text(ruleFileContent);
    const state = typeof ctx.getState === 'function' ? ctx.getState() : null;
    const page_header_action =
        options.page_header_action !== undefined
            ? options.page_header_action
            : can_edit_rulefile(state) && typeof ctx.router === 'function'
                ? create_rulefile_appendix_edit_button(
                      { Helpers: ctx.Helpers, Translation: ctx.Translation, router: ctx.router },
                      '1',
                      'rulefile_sections_edit_appendix1_aria'
                  )
                : undefined;

    render_appendix1_summary_editor_page(
        { Helpers: ctx.Helpers, Translation: ctx.Translation },
        section,
        {
            heading_id: 'rulefile-appendix1-summary-heading',
            heading_key: 'rulefile_appendix1_summary_heading',
            intro_key: 'rulefile_appendix1_summary_intro',
            label_key: 'rulefile_appendix1_summary_label',
            textarea_id: 'rulefile-appendix1-summary-text-view',
            initial_text: body_text,
            readonly: true,
            page_header_action,
            summary_host: {
                is_editing: false,
                working_text: body_text,
                textarea_ref: null,
                preview_container_ref: null,
            },
            on_save: () => {},
        }
    );

    return section;
}

function append_value_bullet_list(Helpers, section, values) {
    const list = Helpers.create_element('ul', {
        class_name: ['metadata-list', 'rulefile-appendix2-value-list'],
    });
    values.forEach((text) => {
        list.appendChild(Helpers.create_element('li', { text_content: text }));
    });
    section.appendChild(list);
}

function append_appendix2_view_section(Helpers, t, section, heading_key, intro_key, values, trailing_note_key) {
    section.appendChild(
        Helpers.create_element('h2', {
            text_content: t(heading_key),
        })
    );
    section.appendChild(
        Helpers.create_element('p', {
            class_name: 'view-intro-text rulefile-appendix2-section-intro',
            text_content: t(intro_key),
        })
    );
    append_value_bullet_list(Helpers, section, values);
    if (trailing_note_key) {
        section.appendChild(
            Helpers.create_element('p', {
                class_name: 'view-intro-text rulefile-appendix2-section-intro rulefile-appendix2-taxonomy-note',
                text_content: t(trailing_note_key),
            })
        );
    }
}

/**
 * @param {{ Helpers: object, Translation: object }} ctx
 * @param {object} ruleFileContent
 * @param {{ labels?: ReturnType<typeof read_rulefile_appendix2_labels> }} [options]
 */
export function render_rulefile_appendix2_template_section(ctx, ruleFileContent, options = {}) {
    const t = ctx.Translation.t;
    const Helpers = ctx.Helpers;
    const section = Helpers.create_element('section', { class_name: 'rulefile-section-content' });
    const labels = options.labels ?? read_rulefile_appendix2_labels(ruleFileContent);

    section.appendChild(
        Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('rulefile_appendix2_view_intro'),
        })
    );
    append_appendix2_view_section(Helpers, t, section, 'rulefile_appendix2_sheets_heading', 'rulefile_appendix2_sheets_view_intro', [
        labels.sheetNames.general_info,
        labels.sheetNames.deficiencies,
    ]);
    append_appendix2_view_section(
        Helpers,
        t,
        section,
        'rulefile_appendix2_general_info_heading',
        'rulefile_appendix2_general_info_view_intro',
        labels.generalInfo.map((entry) => entry.label)
    );
    append_appendix2_view_section(
        Helpers,
        t,
        section,
        'rulefile_appendix2_deficiencies_heading',
        'rulefile_appendix2_deficiencies_view_intro',
        filter_editable_appendix2_deficiency_columns(labels.deficiencyColumns).map((entry) => entry.label),
        'rulefile_appendix2_taxonomy_columns_note'
    );

    return section;
}

/**
 * @param {{ Helpers: object, Translation: object, router?: function, getState?: function }} ctx
 * @param {object} ruleFileContent
 * @param {{ intro_text?: string, page_header_action?: HTMLElement }} [options]
 */
export function render_rulefile_appendix3_template_section(ctx, ruleFileContent, options = {}) {
    const Helpers = ctx.Helpers;
    const section = Helpers.create_element('section', { class_name: 'rulefile-section-content' });
    const template =
        typeof options.intro_text === 'string'
            ? { introText: options.intro_text }
            : read_rulefile_appendix3_template(ruleFileContent);
    const state = typeof ctx.getState === 'function' ? ctx.getState() : null;
    const page_header_action =
        options.page_header_action !== undefined
            ? options.page_header_action
            : can_edit_rulefile(state) && typeof ctx.router === 'function'
                ? create_rulefile_appendix_edit_button(
                      { Helpers: ctx.Helpers, Translation: ctx.Translation, router: ctx.router },
                      '3',
                      'rulefile_sections_edit_appendix3_aria'
                  )
                : undefined;

    render_appendix1_summary_editor_page(
        { Helpers: ctx.Helpers, Translation: ctx.Translation },
        section,
        {
            heading_id: 'rulefile-appendix3-heading',
            heading_key: 'rulefile_appendix_hub_3_title',
            intro_key: 'rulefile_appendix3_view_intro',
            label_key: 'rulefile_appendix3_intro_label',
            textarea_id: 'rulefile-appendix3-intro-text-view',
            initial_text: template.introText,
            readonly: true,
            page_header_action,
            summary_host: {
                is_editing: false,
                working_text: template.introText,
                textarea_ref: null,
                preview_container_ref: null,
            },
            on_save: () => {},
        }
    );

    return section;
}

/** @deprecated Använd render_rulefile_appendix1_template_section. */
export function render_rulefile_report_template_section(ctx, ruleFileContent) {
    return render_rulefile_appendix1_template_section(ctx, ruleFileContent);
}

/**
 * @param {{ Helpers: object, Translation: object, getState: function }} ctx
 * @param {object} metadata
 */
export function render_rulefile_info_blocks_order_section(ctx, metadata) {
    const t = ctx.Translation.t;
    const Helpers = ctx.Helpers;
    const section = Helpers.create_element('section', { class_name: 'rulefile-section-content' });
    const block_order = metadata?.blockOrders?.infoBlocks || [
        'expectedObservation',
        'instructions',
        'exceptions',
        'commonErrors',
        'tips',
        'examples'
    ];
    const list = Helpers.create_element('ol', { class_name: 'info-blocks-order-list' });
    block_order.forEach((blockId) => {
        const name = blockId.startsWith('custom_')
            ? (get_custom_block_name_from_requirements(ctx.getState, blockId) || t('rulefile_info_blocks_unnamed_block'))
            : get_block_display_name(t, blockId);
        const item = Helpers.create_element('li', { text_content: name });
        list.appendChild(item);
    });
    section.appendChild(list);
    return section;
}
