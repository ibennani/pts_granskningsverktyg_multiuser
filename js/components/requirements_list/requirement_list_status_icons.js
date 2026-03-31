/**
 * Statusikoner och tooltip-rad för kravlistor.
 * @module js/components/requirements_list/requirement_list_status_icons
 */

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
    const status_icon_wrapper = Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
    status_icon_wrapper.appendChild(Helpers.create_element('span', {
        class_name: `status-icon status-icon-${base_status.replace('_', '-')}`,
        text_content: get_status_icon(base_status),
        attributes: { 'aria-hidden': 'true' }
    }));
    status_icon_wrapper.appendChild(Helpers.create_element('span', {
        class_name: 'status-icon-tooltip',
        text_content: status_tooltip_text,
        attributes: { 'aria-hidden': 'true' }
    }));
    icons_wrapper.appendChild(status_icon_wrapper);
    if (needs_help) {
        const warning_svg = Helpers.get_icon_svg ? Helpers.get_icon_svg('warning', ['currentColor'], 14) : '';
        const wh = Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
        wh.appendChild(Helpers.create_element('span', { class_name: 'status-icon status-icon-needs-help-indicator', html_content: warning_svg, attributes: { 'aria-hidden': 'true' } }));
        wh.appendChild(Helpers.create_element('span', { class_name: 'status-icon-tooltip', text_content: t('filter_option_needs_help'), attributes: { 'aria-hidden': 'true' } }));
        icons_wrapper.appendChild(wh);
    }
    if (is_updated) {
        const update_svg = Helpers.get_icon_svg ? Helpers.get_icon_svg('update', ['currentColor'], 14) : '';
        const uw = Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
        uw.appendChild(Helpers.create_element('span', { class_name: 'status-icon status-icon-updated-indicator', html_content: update_svg, attributes: { 'aria-hidden': 'true' } }));
        uw.appendChild(Helpers.create_element('span', { class_name: 'status-icon-tooltip', text_content: t('status_updated_tooltip'), attributes: { 'aria-hidden': 'true' } }));
        icons_wrapper.appendChild(uw);
    }
    return icons_wrapper;
}
