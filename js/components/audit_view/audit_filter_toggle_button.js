/**
 * @fileoverview Filterknapp med ikon för granskningslistans responsiva filterrad.
 */

const FILTER_ICON_PATH = 'M4 6h16v2H4V6zm3 5h10v2H7v-2zm3 5h4v2h-4v-2z';

/**
 * @param {object} ctx AuditViewComponent-kontext
 * @param {HTMLElement} wrapper `.audit-filter-wrapper`
 * @returns {HTMLButtonElement}
 */
export function create_audit_filter_toggle_button(ctx, wrapper) {
    const t = ctx.get_t_func();
    const is_open = Boolean(ctx.audit_filter_panel_open);
    if (is_open) {
        wrapper.classList.add('audit-filter-wrapper--open');
    }
    const toggle = ctx.Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'audit-filter-toggle'],
        attributes: {
            type: 'button',
            'aria-expanded': is_open ? 'true' : 'false',
            'aria-controls': 'audit-filter-row',
            'aria-label': t('audit_filter_toggle_aria')
        }
    });
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    icon.classList.add('audit-filter-toggle__icon');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', FILTER_ICON_PATH);
    icon.appendChild(path);
    toggle.appendChild(icon);
    toggle.appendChild(
        ctx.Helpers.create_element('span', {
            class_name: 'audit-filter-toggle__text',
            text_content: t('audit_filter_toggle_label')
        })
    );
    toggle.addEventListener('click', ctx.handle_audit_filter_toggle);
    ctx._auditFilterToggleRef = toggle;
    return toggle;
}
