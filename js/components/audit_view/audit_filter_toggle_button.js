/**

 * @fileoverview Filterknapp med ikon för granskningslistans hopfällbara sekundärrad.

 */

const FILTER_ICON_PATH = 'M4 6h16v2H4V6zm3 5h10v2H7v-2zm3 5h4v2h-4v-2z';



/**

 * @param {(key: string, params?: Record<string, string | number>) => string} t

 * @param {number} secondary_count

 * @param {boolean} panel_open

 * @returns {string}

 */

function get_audit_filter_toggle_text(t, secondary_count, panel_open) {

    if (panel_open) {

        return t('audit_filter_toggle_hide');

    }

    if (secondary_count === 1) {

        return t('audit_filter_toggle_active_singular');

    }

    if (secondary_count > 1) {

        return t('audit_filter_toggle_active_plural', { count: secondary_count });

    }

    return t('audit_filter_toggle_label');

}



/**

 * @param {object} ctx AuditViewComponent-kontext

 * @param {HTMLElement} wrapper `.audit-filter-wrapper`

 * @param {number} [secondary_count]

 * @param {boolean} [panel_open]

 * @returns {HTMLButtonElement}

 */

export function create_audit_filter_toggle_button(ctx, wrapper, secondary_count = 0, panel_open = false) {

    const is_open = panel_open || Boolean(ctx.audit_filter_panel_open);

    if (is_open) {

        wrapper.classList.add('audit-filter-wrapper--open');

    }

    const toggle = ctx.Helpers.create_element('button', {

        class_name: ['button', 'button-default', 'audit-filter-toggle'],

        attributes: {

            type: 'button',

            'aria-expanded': is_open ? 'true' : 'false',

            'aria-controls': 'audit-filter-accordion-panel'

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

    const text_span = ctx.Helpers.create_element('span', { class_name: 'audit-filter-toggle__text' });

    toggle.appendChild(text_span);

    toggle.addEventListener('click', ctx.handle_audit_filter_toggle);

    ctx._auditFilterToggleRef = toggle;

    update_audit_filter_toggle_button(toggle, ctx, secondary_count, is_open);

    return toggle;

}



/**

 * @param {HTMLButtonElement} toggle

 * @param {object} ctx

 * @param {number} secondary_count

 * @param {boolean} panel_open

 */

export function update_audit_filter_toggle_button(toggle, ctx, secondary_count, panel_open) {

    if (!toggle) return;

    const t = ctx.get_t_func();

    const text_span = toggle.querySelector('.audit-filter-toggle__text');

    if (!text_span) return;

    const label = get_audit_filter_toggle_text(t, secondary_count, panel_open);

    text_span.textContent = label;

    toggle.setAttribute('aria-expanded', panel_open ? 'true' : 'false');

}


