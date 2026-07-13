/**
 * Statusikoner och tooltip-rad för kravlistor.
 * @module js/components/requirements_list/requirement_list_status_icons
 */

import { wrap_with_static_tooltip } from '../../utils/generic_tooltip.js';

/**
 * @param {string} status
 * @returns {string}
 */
export function get_status_icon(status) {
    switch (status) {
        case 'not_audited':
            return '○';
        case 'partially_audited':
            return '◐';
        case 'passed':
            return '✓';
        case 'failed':
        case 'needs_help':
            return '✗';
        case 'updated':
            return '↻';
        default:
            return '○';
    }
}

/**
 * @param {{ Helpers: object, Translation: object }} ctx
 * @param {string} base_status
 * @param {boolean} needs_help
 * @param {boolean} is_updated
 * @returns {HTMLElement}
 */
export function create_status_icons_wrapper(ctx, base_status, needs_help, is_updated) {
    const { Helpers, Translation } = ctx;
    const t = Translation.t;
    const icons_wrapper = Helpers.create_element('span', { class_name: 'status-icons-wrapper' });
    const status_tooltip_text = t(`audit_status_${base_status}`);
    const status_icon = Helpers.create_element('span', {
        class_name: `status-icon status-icon-${base_status.replace('_', '-')}`,
        text_content: get_status_icon(base_status),
        attributes: { 'aria-hidden': 'true' },
    });
    icons_wrapper.appendChild(
        wrap_with_static_tooltip(Helpers, status_icon, status_tooltip_text, { use_overlay: true })
    );

    if (needs_help) {
        const warning_svg = Helpers.get_icon_svg ? Helpers.get_icon_svg('warning', ['currentColor'], 14) : '';
        const needs_help_icon = Helpers.create_element('span', {
            class_name: 'status-icon status-icon-needs-help-indicator',
            html_content: warning_svg,
            attributes: { 'aria-hidden': 'true' },
        });
        icons_wrapper.appendChild(
            wrap_with_static_tooltip(Helpers, needs_help_icon, t('filter_option_needs_help'), { use_overlay: true })
        );
    }
    if (is_updated) {
        const update_svg = Helpers.get_icon_svg ? Helpers.get_icon_svg('update', ['currentColor'], 14) : '';
        const updated_icon = Helpers.create_element('span', {
            class_name: 'status-icon status-icon-updated-indicator',
            html_content: update_svg,
            attributes: { 'aria-hidden': 'true' },
        });
        icons_wrapper.appendChild(
            wrap_with_static_tooltip(Helpers, updated_icon, t('status_updated_tooltip'), { use_overlay: true })
        );
    }
    return icons_wrapper;
}
