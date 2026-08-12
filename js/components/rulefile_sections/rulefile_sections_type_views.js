/**
 * @fileoverview Läsvisning för sidtyper, innehållstyper, rapportmall, informationsblock.
 */

import { format_simple_value } from './rulefile_sections_display_helpers.js';
import {
    resolve_content_types,
} from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import { read_page_types_dropdown_state } from '../../../shared/rulefile/page_types_dropdown_sync.js';
import {
    read_rulefile_appendix1_body_text,
} from '../../logic/appendix1_sections.js';
import { render_appendix1_deficiency_sections_view } from '../../utils/appendix1_deficiency_intros_view_render.js';
import { read_rulefile_appendix2_labels, filter_editable_appendix2_deficiency_columns } from '../../logic/appendix2_excel_template.js';
import { read_rulefile_appendix3_template } from '../../logic/appendix3_screenshots_template.js';
import { render_appendix1_summary_editor_page } from '../../utils/appendix1_summary_editor_render.js';
import {
    resolve_appendix1_deficiency_view_data_for_rulefile,
} from '../../logic/appendix1_deficiency_view_data.js';
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

    const dropdown_state = read_page_types_dropdown_state(metadata);
    const category_blocks = [
        {
            category: dropdown_state.webbsida_category,
            lines: dropdown_state.webbsida_lines,
        },
        {
            category: dropdown_state.aterkommande_category,
            lines: dropdown_state.aterkommande_lines,
        },
    ].filter((block) => block.category && block.lines.length > 0);

    if (category_blocks.length === 0) {
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

    category_blocks.forEach((block) => {
        const group = Helpers.create_element('div', { class_name: 'page-types-read-group' });

        group.appendChild(Helpers.create_element('h3', {
            text_content: String(block.category?.text || block.category?.id || t('rulefile_metadata_untitled_item')),
            class_name: 'page-types-read-group-heading',
        }));

        const list = Helpers.create_element('ul', { class_name: 'page-types-read-list' });
        block.lines.forEach((line) => {
            list.appendChild(Helpers.create_element('li', { text_content: line }));
        });
        group.appendChild(list);
        section.appendChild(group);
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
                    const child_name = child.text || child.id || t('rulefile_metadata_untitled_item');
                    const child_item = Helpers.create_element('li');
                    child_item.appendChild(Helpers.create_element('span', {
                        class_name: 'metadata-subject',
                        text_content: child_name
                    }));
                    if (child.defaultSelected === true) {
                        const default_note = Helpers.create_element('span', {
                            class_name: 'content-type-default-selected-note',
                        });
                        if (Helpers.get_icon_svg) {
                            default_note.appendChild(Helpers.create_element('span', {
                                class_name: 'content-type-default-selected-note__icon',
                                attributes: { 'aria-hidden': 'true' },
                                html_content: Helpers.get_icon_svg('check_circle', ['currentColor'], 16),
                            }));
                        }
                        default_note.appendChild(Helpers.create_element('span', {
                            class_name: 'content-type-default-selected-note__text',
                            text_content: t('rulefile_content_types_default_selected_readonly_text', {
                                name: child_name,
                            }),
                        }));
                        child_item.appendChild(default_note);
                    }
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
 * @param {{ body_text?: string, page_header_action?: HTMLElement, deficiency_intros_hint_key?: string }} [options]
 */
export function render_rulefile_appendix1_template_section(ctx, ruleFileContent, options = {}) {
    const Helpers = ctx.Helpers;
    const t = ctx.Translation.t;
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

    const view_data = options.deficiency_view_data
        ?? resolve_appendix1_deficiency_view_data_for_rulefile(ruleFileContent, t);
    render_appendix1_deficiency_sections_view(
        { Helpers: ctx.Helpers, Translation: ctx.Translation },
        section,
        {
            deficiency_sections: view_data.deficiency_sections,
            deficiency_types_by_concept: view_data.deficiency_types_by_concept,
            hint_key: options.deficiency_intros_hint_key ?? 'rulefile_appendix1_deficiency_intros_hint',
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

function append_appendix2_view_section(Helpers, t, section, heading_key, intro_key, values, trailing_note) {
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
    if (trailing_note?.key && trailing_note.count > 0) {
        section.appendChild(
            Helpers.create_element('p', {
                class_name: 'view-intro-text rulefile-appendix2-section-intro rulefile-appendix2-taxonomy-note',
                text_content: t(trailing_note.key, { count: trailing_note.count }),
            })
        );
    }
}

/**
 * @param {{ Helpers: object, Translation: object }} ctx
 * @param {object} ruleFileContent
 * @param {{ labels?: ReturnType<typeof read_rulefile_appendix2_labels>, taxonomy_column_labels?: string[] }} [options]
 */
export function render_rulefile_appendix2_template_section(ctx, ruleFileContent, options = {}) {
    const t = ctx.Translation.t;
    const Helpers = ctx.Helpers;
    const section = Helpers.create_element('section', { class_name: 'rulefile-section-content' });
    const labels = options.labels ?? read_rulefile_appendix2_labels(ruleFileContent);
    const editable_deficiency_labels = filter_editable_appendix2_deficiency_columns(
        labels.deficiencyColumns
    ).map((entry) => entry.label);
    const taxonomy_column_labels = Array.isArray(options.taxonomy_column_labels)
        ? options.taxonomy_column_labels.filter((label) => typeof label === 'string' && label.trim())
        : [];
    const deficiency_column_labels =
        taxonomy_column_labels.length > 0
            ? [...editable_deficiency_labels, ...taxonomy_column_labels]
            : editable_deficiency_labels;

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
        deficiency_column_labels,
        {
            key: 'rulefile_appendix2_taxonomy_columns_note',
            count: taxonomy_column_labels.length,
        }
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
