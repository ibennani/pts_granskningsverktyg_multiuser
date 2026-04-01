/**
 * Redigerare för rapportmallens sektioner i regelfilsmetadata.
 * @module js/components/rulefile_metadata/rulefile_metadata_report_template
 */

import { show_confirm_delete_modal } from '../../logic/confirm_delete_modal_logic.js';

/**
 * @param {{ Helpers: object, Translation: object }} ctx
 * @param {object} reportTemplate
 * @param {object} metadata
 * @param {{ _report_template_ref?: object, _report_template_metadata_ref?: object }} host
 * @returns {HTMLElement}
 */
export function create_report_template_section(ctx, reportTemplate, metadata, host) {
    const { Helpers, Translation } = ctx;
    const t = Translation.t;
    const section = Helpers.create_element('section', { class_name: 'form-section' });
    section.appendChild(Helpers.create_element('h2', { text_content: t('report_template_sections_title') }));

    const block_order = metadata?.blockOrders?.reportSections || [];
    const sections = reportTemplate.sections || {};

    const container = Helpers.create_element('div', { class_name: 'report-sections-editor' });

    const ordered_section_ids = [...block_order];
    const extra_section_ids = Object.keys(sections).filter(id => !ordered_section_ids.includes(id));
    ordered_section_ids.push(...extra_section_ids);

    ordered_section_ids.forEach((section_id, index) => {
        const section_data = sections[section_id] || { name: '', required: false, content: '' };

        const section_card = Helpers.create_element('div', {
            class_name: 'report-section-card',
            attributes: { 'data-section-id': section_id }
        });

        const header = Helpers.create_element('div', { class_name: 'report-section-header' });

        if (index > 0) {
            const move_up_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-small', 'button-default'],
                attributes: { type: 'button', 'data-action': 'move-section-up', 'data-section-id': section_id },
                html_content: Helpers.get_icon_svg('arrow_upward', [], 16)
            });
            move_up_btn.addEventListener('click', () => {
                const current_index = ordered_section_ids.indexOf(section_id);
                if (current_index > 0) {
                    ordered_section_ids.splice(current_index, 1);
                    ordered_section_ids.splice(current_index - 1, 0, section_id);
                    render_report_template_sections(ctx, container, reportTemplate, metadata, host);
                }
            });
            header.appendChild(move_up_btn);
        }

        if (index < ordered_section_ids.length - 1) {
            const move_down_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-small', 'button-default'],
                attributes: { type: 'button', 'data-action': 'move-section-down', 'data-section-id': section_id },
                html_content: Helpers.get_icon_svg('arrow_downward', [], 16)
            });
            move_down_btn.addEventListener('click', () => {
                const current_index = ordered_section_ids.indexOf(section_id);
                if (current_index < ordered_section_ids.length - 1) {
                    ordered_section_ids.splice(current_index, 1);
                    ordered_section_ids.splice(current_index + 1, 0, section_id);
                    render_report_template_sections(ctx, container, reportTemplate, metadata, host);
                }
            });
            header.appendChild(move_down_btn);
        }

        const name_label = Helpers.create_element('label', {
            attributes: { for: `section_${section_id}_name` },
            text_content: t('report_section_name_placeholder')
        });
        const name_input = Helpers.create_element('input', {
            id: `section_${section_id}_name`,
            class_name: 'form-control',
            attributes: {
                type: 'text',
                'data-section-id': section_id,
                'data-field': 'name',
                value: section_data.name || ''
            }
        });
        name_input.style.width = '200px';
        name_input.style.display = 'inline-block';
        header.appendChild(name_label);
        header.appendChild(name_input);

        if (section_data.required === true && sections[section_id]) {
            const required_text = Helpers.create_element('span', {
                class_name: 'report-section-required-label',
                text_content: t('report_section_required')
            });
            header.appendChild(required_text);
        } else {
            const required_label = Helpers.create_element('label', {
                class_name: 'checkbox-label',
                attributes: { 'for': `section_${section_id}_required` }
            });
            const required_checkbox = Helpers.create_element('input', {
                attributes: {
                    id: `section_${section_id}_required`,
                    type: 'checkbox',
                    'data-section-id': section_id,
                    'data-field': 'required',
                    checked: section_data.required === true
                }
            });
            required_label.appendChild(required_checkbox);
            required_label.appendChild(document.createTextNode(' ' + t('report_section_required')));
            header.appendChild(required_label);
        }

        if (!section_data.required) {
            const delete_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-small', 'button-danger'],
                attributes: { type: 'button', 'data-action': 'delete-section', 'data-section-id': section_id },
                html_content: Helpers.get_icon_svg('delete', [], 16)
            });
            delete_btn.addEventListener('click', () => {
                const warning_text = t('confirm_delete_report_section');
                if (show_confirm_delete_modal) {
                    show_confirm_delete_modal({
                        warning_text,
                        delete_button: delete_btn,
                        on_confirm: () => {
                            delete sections[section_id];
                            const order_index = ordered_section_ids.indexOf(section_id);
                            if (order_index !== -1) {
                                ordered_section_ids.splice(order_index, 1);
                            }
                            render_report_template_sections(ctx, container, reportTemplate, metadata, host);
                        }
                    });
                }
            });
            header.appendChild(delete_btn);
        }

        section_card.appendChild(header);

        const content_group = Helpers.create_element('div', { class_name: 'form-group' });
        const content_label = Helpers.create_element('label', {
            attributes: { 'for': `section_${section_id}_content` },
            text_content: t('report_section_content')
        });
        const content_textarea = Helpers.create_element('textarea', {
            class_name: 'form-control',
            attributes: {
                id: `section_${section_id}_content`,
                'data-section-id': section_id,
                'data-field': 'content',
                rows: '6'
            }
        });
        content_textarea.value = section_data.content || '';
        Helpers.init_auto_resize_for_textarea?.(content_textarea);
        content_group.appendChild(content_label);
        content_group.appendChild(content_textarea);
        section_card.appendChild(content_group);

        container.appendChild(section_card);
    });

    const add_section_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-secondary'],
        attributes: { type: 'button' },
        html_content: `<span>${t('add_report_section')}</span>` + Helpers.get_icon_svg('add', [], 16)
    });
    add_section_btn.addEventListener('click', () => {
        const new_id = `section-${Helpers.generate_uuid_v4().substring(0, 8)}`;
        sections[new_id] = {
            name: t('new_report_section'),
            required: false,
            content: ''
        };
        const block_order_inner = metadata?.blockOrders?.reportSections || [];
        block_order_inner.push(new_id);
        if (!metadata.blockOrders) {
            metadata.blockOrders = {};
        }
        if (!metadata.blockOrders.reportSections) {
            metadata.blockOrders.reportSections = [];
        }
        metadata.blockOrders.reportSections = block_order_inner;
        render_report_template_sections(ctx, container, reportTemplate, metadata, host);
    });
    container.appendChild(add_section_btn);

    section.appendChild(container);

    host._report_template_ref = reportTemplate;
    host._report_template_metadata_ref = metadata;

    return section;
}

/**
 * @param {{ Helpers: object, Translation: object }} ctx
 * @param {HTMLElement} container
 * @param {object} reportTemplate
 * @param {object} metadata
 * @param {{ _report_template_ref?: object, _report_template_metadata_ref?: object }} host
 */
export function render_report_template_sections(ctx, container, reportTemplate, metadata, host) {
    const parent_section = container.closest('.form-section');
    if (parent_section) {
        const form = parent_section.closest('form');
        if (form) {
            const old_section = parent_section;
            const new_section = create_report_template_section(ctx, reportTemplate, metadata, host);
            old_section.replaceWith(new_section);
        }
    }
}
