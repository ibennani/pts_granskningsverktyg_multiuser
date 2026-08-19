/**
 * @fileoverview Observationssektion vid DOM-byggnad för ChecklistHandler.
 */

import { read_pc_stored_data } from './checklist_observation_visibility.js';
import type { ChecklistDomBuildHost } from './checklist_dom_build_helpers.js';

export function append_pc_observation_section(
    host: ChecklistDomBuildHost,
    pc_item_li: HTMLElement,
    check_id: string,
    pc_id: string,
    numbering: string,
    check_index: number,
    pc_index: number,
    check_result_data: { passCriteria?: Record<string, unknown>; overallStatus?: string } | null | undefined,
    overall_for_pc_list: string,
    checks_header_actions: HTMLElement,
    t: (key: string, params?: Record<string, unknown>) => string,
    requirement_plain: string
): void {
    const observation_wrapper = host.Helpers.create_element('div', { class_name: 'pc-observation-detail-wrapper form-group' });
    const observation_label = host.Helpers.create_element('label', {
        attributes: { for: `pc-observation-${check_id}-${pc_id}` },
        text_content: t('pc_observation_detail_label')
    });
    observation_wrapper.appendChild(observation_label);

    const observation_hint = host.Helpers.create_element('div', { class_name: 'lock-hint text-muted' });
    observation_hint.id = `lock-hint-${check_id}-${pc_id}`;
    observation_hint.style.fontSize = '0.85em';
    observation_hint.style.fontWeight = 'bold';
    observation_hint.style.color = '#d32f2f';
    observation_hint.setAttribute('role', 'status');
    observation_wrapper.appendChild(observation_hint);

    const pc_data_init = read_pc_stored_data(check_result_data, pc_id);
    const observation_textarea = host.Helpers.create_element('textarea', {
        id: `pc-observation-${check_id}-${pc_id}`,
        class_name: 'form-control pc-observation-detail-textarea',
        attributes: { rows: '4' }
    }) as HTMLTextAreaElement;
    const initial_observation = typeof pc_data_init.observationDetail === 'string'
        ? pc_data_init.observationDetail
        : host._pick_user_observation_text(check_id, pc_id);
    if (initial_observation) {
        observation_textarea.value = initial_observation;
    }
    observation_wrapper.appendChild(observation_textarea);

    const attach_media_row = host.Helpers.create_element('div', { class_name: 'pc-attach-media-row' });
    const copy_observation_row = host.Helpers.create_element('div', {
        class_name: 'pc-copy-observation-row',
        attributes: { hidden: 'hidden' }
    });
    copy_observation_row.appendChild(host.Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'button-small'],
        attributes: {
            'data-action': 'copy-observation',
            'data-check-id': check_id,
            'data-pc-id': pc_id,
            type: 'button',
            'aria-label': t('copy_observation_from_other_button')
        },
        text_content: t('copy_observation_from_other_button')
    }));
    attach_media_row.appendChild(copy_observation_row);

    const criterion_title = `${t('pass_criterion_label')} ${numbering}`;
    const pc_result = host.requirement_result_ref?.checkResults?.[check_id] as {
        passCriteria?: Record<string, { attachedMediaFilenames?: string[] }>;
    } | undefined;
    const attached_filenames = Array.isArray(pc_result?.passCriteria?.[pc_id]?.attachedMediaFilenames)
        ? pc_result!.passCriteria![pc_id]!.attachedMediaFilenames!.filter((f) => f && String(f).trim())
        : [];
    const attached_count = attached_filenames.length;
    const attach_btn_label = attached_count > 0
        ? t('edit_attached_media_button', { count: attached_count })
        : t('attach_media_button');
    const attach_aria_label = `${attach_btn_label} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`;
    const image_icon = host.Helpers.get_icon_svg ? host.Helpers.get_icon_svg('image', ['currentColor'], 16) : '';
    const video_icon = host.Helpers.get_icon_svg ? host.Helpers.get_icon_svg('videocam', ['currentColor'], 16) : '';
    const attach_icons_html = (image_icon || video_icon)
        ? `<span class="attach-media-button-icons" aria-hidden="true">${image_icon}${video_icon}</span>`
        : '';
    attach_media_row.appendChild(host.Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'button-small'],
        attributes: {
            'data-action': 'attach-media',
            'data-check-id': check_id,
            'data-pc-id': pc_id,
            type: 'button',
            'aria-label': attach_aria_label
        },
        html_content: `<span>${host.Helpers.escape_html!(attach_btn_label)}</span>${attach_icons_html}`
    }));
    observation_wrapper.appendChild(attach_media_row);

    host._sync_observation_wrapper_visibility(
        observation_wrapper, overall_for_pc_list, pc_data_init, check_id, pc_id
    );

    if (check_index === 0 && pc_index === 0) {
        const has_stuck_content = (host.requirement_result_ref?.stuckProblemDescription || '').trim() !== '';
        const stuck_aria_label = has_stuck_content
            ? `${t('stuck_button')} ${t('stuck_button_has_content')} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`
            : `${t('stuck_button')} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`;
        const warning_icon = host.Helpers.get_icon_svg ? host.Helpers.get_icon_svg('warning', ['currentColor'], 16) : '';
        const indicator_html = has_stuck_content
            ? ` <span class="stuck-button-indicator">${host.Helpers.escape_html!(t('stuck_button_has_content'))}</span>`
            : '';
        checks_header_actions.appendChild(host.Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'button-small', 'stuck-button', ...(has_stuck_content ? ['stuck-button--has-content'] : [])],
            attributes: {
                'data-action': 'stuck',
                'data-check-id': check_id,
                'data-pc-id': pc_id,
                type: 'button',
                'aria-label': stuck_aria_label
            },
            html_content: `<span>${host.Helpers.escape_html!(t('stuck_button'))}${indicator_html}</span>${warning_icon ? `<span class="stuck-button-icon" aria-hidden="true">${warning_icon}</span>` : ''}`
        }));
    }

    pc_item_li.appendChild(observation_wrapper);
}

