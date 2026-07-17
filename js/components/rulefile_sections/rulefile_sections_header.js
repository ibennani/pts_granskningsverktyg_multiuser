/**
 * @fileoverview Sidhuvud för regelfilssektionernas vy (rubrik, redigera, intros).
 */

import { can_edit_rulefile } from '../../utils/helpers.js';

import {
    classification_part_shows_header_edit_button,
    get_classification_part_edit_aria_key,
    get_classification_part_title_key,
    normalize_classification_part_param,
} from './rulefile_classifications_parts.js';
import { build_taxonomy_detail_edit_button } from './rulefile_taxonomy_detail_ui.js';

/**
 * @param {object} deps
 * @param {object} deps.Helpers
 * @param {object} deps.Translation
 * @param {function} deps.router
 * @param {function} deps.getState
 * @param {() => unknown | null} [deps.get_page_types_edit_component]
 * @param {string} [appendix]
 * @param {string} [classifications_part]
 * @param {string} [heading_text_override]
 * @param {object} section_config
 * @param {boolean} [is_editing]
 */
export function create_rulefile_section_header(
    deps,
    section_config,
    is_editing = false,
    appendix = '',
    classifications_part = '',
    heading_text_override = ''
) {
    const t = deps.Translation.t;
    const Helpers = deps.Helpers;
    const header_wrapper = Helpers.create_element('div', { class_name: 'rulefile-sections-header' });

    const heading_row = Helpers.create_element('div', { class_name: 'rulefile-sections-header-row' });
    const heading_id = `rulefile-section-${section_config.id}-heading`;
    const appendix_title_key =
        appendix === '1'
            ? 'rulefile_appendix_hub_1_title'
            : appendix === '2'
                ? 'rulefile_appendix_hub_2_title'
                : appendix === '3'
                    ? 'rulefile_appendix_hub_3_title'
                    : null;
    const normalized_part = normalize_classification_part_param(classifications_part);
    const classification_part_title_key = normalized_part
        ? get_classification_part_title_key(normalized_part)
        : null;
    const heading_text = String(heading_text_override ?? '').trim()
        ? String(heading_text_override).trim()
        : appendix_title_key
            ? t(appendix_title_key)
            : classification_part_title_key
                ? t(classification_part_title_key)
                : section_config.title;
    const heading = Helpers.create_element('h1', {
        text_content: heading_text,
        attributes: { id: heading_id }
    });
    heading_row.appendChild(heading);

    const state_for_header = typeof deps.getState === 'function' ? deps.getState() : null;
    const can_edit = can_edit_rulefile(state_for_header);
    const taxonomy_detail_context = deps.taxonomy_detail_context ?? null;

    if (
        can_edit &&
        taxonomy_detail_context &&
        section_config.id === 'classifications' &&
        !is_editing &&
        normalized_part === 'taxonomy'
    ) {
        heading_row.classList.add('rulefile-sections-header-row--taxonomy-detail');
        heading_row.appendChild(
            build_taxonomy_detail_edit_button(
                { Helpers, Translation: deps.Translation, router: deps.router },
                taxonomy_detail_context.taxonomy,
                taxonomy_detail_context.taxonomy_key
            )
        );
    }

    if (can_edit && section_config.id === 'general' && !is_editing) {
        const edit_button = Helpers.create_element('button', {
            class_name: ['button', 'button-secondary', 'rulefile-sections-edit-button'],
            attributes: {
                type: 'button',
                'aria-label': t('rulefile_sections_edit_general_aria')
            },
            html_content: `<span>${t('edit_button_label')}</span>` +
                          (Helpers.get_icon_svg ? Helpers.get_icon_svg('edit') : '')
        });
        edit_button.addEventListener('click', () => {
            deps.router('rulefile_sections', { section: 'general', edit: 'true' });
        });
        heading_row.appendChild(edit_button);
    }

    if (can_edit && section_config.id === 'page_types' && !is_editing) {
        const edit_button = Helpers.create_element('button', {
            class_name: ['button', 'button-secondary', 'rulefile-sections-edit-button'],
            attributes: {
                type: 'button',
                'aria-label': t('rulefile_sections_edit_page_types_aria')
            },
            html_content: `<span>${t('edit_button_label')}</span>` +
                          (Helpers.get_icon_svg ? Helpers.get_icon_svg('edit') : '')
        });
        edit_button.addEventListener('click', () => {
            deps.router('rulefile_sections', { section: 'page_types', edit: 'true' });
        });
        heading_row.appendChild(edit_button);
    }

    if (
        can_edit &&
        section_config.id === 'classifications' &&
        !is_editing &&
        normalized_part &&
        classification_part_shows_header_edit_button(normalized_part)
    ) {
        const edit_button = Helpers.create_element('button', {
            class_name: ['button', 'button-secondary', 'rulefile-sections-edit-button'],
            attributes: {
                type: 'button',
                'aria-label': t(get_classification_part_edit_aria_key(normalized_part))
            },
            html_content: `<span>${t('edit_button_label')}</span>` +
                          (Helpers.get_icon_svg ? Helpers.get_icon_svg('edit') : '')
        });
        edit_button.addEventListener('click', () => {
            deps.router('rulefile_sections', {
                section: 'classifications',
                part: normalized_part,
                edit: 'true'
            });
        });
        heading_row.appendChild(edit_button);
    }

    if (can_edit && section_config.id === 'content_types' && !is_editing) {
        const edit_button = Helpers.create_element('button', {
            class_name: ['button', 'button-secondary', 'rulefile-sections-edit-button'],
            attributes: {
                type: 'button',
                'aria-label': t('rulefile_sections_edit_content_types_aria')
            },
            html_content: `<span>${t('edit_button_label')}</span>` +
                          (Helpers.get_icon_svg ? Helpers.get_icon_svg('edit') : '')
        });
        edit_button.addEventListener('click', () => {
            deps.router('rulefile_sections', { section: 'content_types', edit: 'true' });
        });
        heading_row.appendChild(edit_button);
    }

    if (can_edit && section_config.id === 'info_blocks_order' && !is_editing) {
        const edit_button = Helpers.create_element('button', {
            class_name: ['button', 'button-secondary', 'rulefile-sections-edit-button'],
            attributes: {
                type: 'button',
                'aria-label': t('rulefile_sections_edit_info_blocks_aria')
            },
            html_content: `<span>${t('edit_button_label')}</span>` +
                          (Helpers.get_icon_svg ? Helpers.get_icon_svg('edit') : '')
        });
        edit_button.addEventListener('click', () => {
            deps.router('rulefile_sections', { section: 'info_blocks_order', edit: 'true' });
        });
        heading_row.appendChild(edit_button);
    }

    if (can_edit && section_config.id === 'report_template' && !is_editing && appendix === '1') {
        const edit_button = Helpers.create_element('button', {
            class_name: ['button', 'button-secondary', 'rulefile-sections-edit-button'],
            attributes: {
                type: 'button',
                'aria-label': t('rulefile_sections_edit_appendix1_aria')
            },
            html_content: `<span>${t('edit_button_label')}</span>` +
                          (Helpers.get_icon_svg ? Helpers.get_icon_svg('edit') : '')
        });
        edit_button.addEventListener('click', () => {
            deps.router('rulefile_sections', { section: 'report_template', appendix: '1', edit: 'true' });
        });
        heading_row.appendChild(edit_button);
    }

    if (can_edit && section_config.id === 'report_template' && !is_editing && appendix === '2') {
        const edit_button = Helpers.create_element('button', {
            class_name: ['button', 'button-secondary', 'rulefile-sections-edit-button'],
            attributes: {
                type: 'button',
                'aria-label': t('rulefile_sections_edit_appendix2_aria')
            },
            html_content: `<span>${t('edit_button_label')}</span>` +
                          (Helpers.get_icon_svg ? Helpers.get_icon_svg('edit') : '')
        });
        edit_button.addEventListener('click', () => {
            deps.router('rulefile_sections', { section: 'report_template', appendix: '2', edit: 'true' });
        });
        heading_row.appendChild(edit_button);
    }

    if (can_edit && section_config.id === 'report_template' && !is_editing && appendix === '3') {
        const edit_button = Helpers.create_element('button', {
            class_name: ['button', 'button-secondary', 'rulefile-sections-edit-button'],
            attributes: {
                type: 'button',
                'aria-label': t('rulefile_sections_edit_appendix3_aria')
            },
            html_content: `<span>${t('edit_button_label')}</span>` +
                          (Helpers.get_icon_svg ? Helpers.get_icon_svg('edit') : '')
        });
        edit_button.addEventListener('click', () => {
            deps.router('rulefile_sections', { section: 'report_template', appendix: '3', edit: 'true' });
        });
        heading_row.appendChild(edit_button);
    }

    header_wrapper.appendChild(heading_row);

    if (section_config.id === 'content_types' && is_editing) {
        const intro = Helpers.create_element('p', {
            class_name: 'field-hint rulefile-sections-header-intro',
            text_content: t('rulefile_metadata_content_types_intro')
        });
        header_wrapper.appendChild(intro);
    }

    if (section_config.id === 'info_blocks_order') {
        const intro = Helpers.create_element('p', {
            class_name: 'field-hint rulefile-sections-header-intro',
            text_content: t('rulefile_info_blocks_order_intro')
        });
        header_wrapper.appendChild(intro);
    }

    if (section_config.id === 'page_types') {
        const intro_text = t('rulefile_page_types_intro');
        const intro_paragraphs = intro_text.split(/\n\n+/).filter(p => p.trim());
        intro_paragraphs.forEach(paragraph => {
            const p = Helpers.create_element('p', {
                class_name: 'field-hint rulefile-sections-header-intro',
                text_content: paragraph.trim()
            });
            header_wrapper.appendChild(p);
        });
    }

    if (section_config.id === 'report_template' && appendix === '1') {
        const intro_key = is_editing
            ? 'rulefile_appendix1_edit_header_intro'
            : 'rulefile_appendix1_view_header_intro';
        header_wrapper.appendChild(Helpers.create_element('p', {
            class_name: 'field-hint rulefile-sections-header-intro',
            text_content: t(intro_key)
        }));
    }

    if (can_edit && section_config.id === 'page_types' && is_editing) {
        const add_button_wrapper = Helpers.create_element('div', { class_name: 'rulefile-sections-add-button-wrapper' });
        const add_button = Helpers.create_element('button', {
            class_name: ['button', 'button-primary', 'button-small', 'rulefile-sections-edit-button'],
            attributes: {
                type: 'button',
                'data-action': 'add-page-type'
            },
            html_content: `<span>${t('rulefile_metadata_add_page_type')}</span>` +
                          (Helpers.get_icon_svg ? `<span aria-hidden="true">${Helpers.get_icon_svg('add', ['currentColor'], 16)}</span>` : '')
        });
        add_button.addEventListener('click', () => {
            const comp = deps.get_page_types_edit_component ? deps.get_page_types_edit_component() : null;
            comp?.handle_add_page_type_click?.();
        });
        add_button_wrapper.appendChild(add_button);
        header_wrapper.appendChild(add_button_wrapper);
    }

    return header_wrapper;
}
