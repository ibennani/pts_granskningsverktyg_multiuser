/**
 * @fileoverview Knapp som återställer alla filter i granskningslistan till standardvärden.
 */

const FILTER_ICON_PATH = 'M4 6h16v2H4V6zm3 5h10v2H7v-2zm3 5h4v2h-4v-2z';

/**
 * @param {object} ctx AuditViewComponent-kontext
 * @returns {HTMLButtonElement}
 */
export function create_audit_filter_reset_button(ctx) {
    const t = ctx.get_t_func();
    const label_text = t('audit_filter_reset_label');
    const reset_btn = ctx.Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'audit-filter-reset'],
        attributes: {
            type: 'button',
            'aria-label': t('audit_filter_reset_aria')
        }
    });
    reset_btn.appendChild(
        ctx.Helpers.create_element('span', {
            class_name: 'audit-filter-reset__text',
            text_content: label_text
        })
    );
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    icon.classList.add('audit-filter-reset__icon');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', FILTER_ICON_PATH);
    icon.appendChild(path);
    reset_btn.appendChild(icon);
    reset_btn.addEventListener('click', ctx.handle_audit_filter_reset);
    ctx._auditFilterResetRef = reset_btn;
    return reset_btn;
}
