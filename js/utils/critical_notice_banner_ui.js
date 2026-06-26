/**
 * @file Gemensam orange kritisk notisruta (samma utseende som regelfilsbanner på översikten).
 */

/** @typedef {{ text: string, class_names?: string[], aria_label?: string, on_click: () => void }} CriticalNoticeBannerButton */

export const CRITICAL_NOTICE_BANNER_CLASS = 'audit-overview__newer-rule-banner';
export const VERSION_RELOAD_BANNER_ID = 'gv-version-reload-banner';

/**
 * @param {typeof import('./helpers.js')} Helpers
 * @param {{ lead_text: string, buttons: CriticalNoticeBannerButton[] }} options
 * @returns {HTMLElement}
 */
export function build_critical_notice_banner_row(Helpers, { lead_text, buttons }) {
    const row = Helpers.create_element('div', { class_name: 'audit-overview__newer-rule-banner__row' });
    const left = Helpers.create_element('div', { class_name: 'audit-overview__newer-rule-banner__left' });
    left.appendChild(Helpers.create_element('span', {
        class_name: 'audit-overview__newer-rule-banner__lead',
        text_content: lead_text
    }));

    const actions = Helpers.create_element('div', { class_name: 'audit-overview__newer-rule-banner__actions' });
    for (const btn_spec of buttons) {
        const attrs = { type: 'button' };
        if (btn_spec.aria_label) {
            attrs['aria-label'] = btn_spec.aria_label;
        }
        const btn = Helpers.create_element('button', {
            class_name: btn_spec.class_names || ['button', 'button-default', 'audit-overview__newer-rule-banner__btn'],
            text_content: btn_spec.text,
            attributes: attrs
        });
        btn.addEventListener('click', btn_spec.on_click);
        actions.appendChild(btn);
    }

    left.appendChild(actions);
    row.appendChild(left);
    return row;
}

/**
 * @param {typeof import('./helpers.js')} Helpers
 * @param {HTMLElement[]} rows
 * @param {{ id?: string }} [options]
 * @returns {HTMLElement}
 */
export function build_critical_notice_banner(Helpers, rows, options = {}) {
    const attrs = { 'aria-live': 'polite' };
    if (options.id) {
        attrs.id = options.id;
    }
    const banner = Helpers.create_element('div', {
        class_name: CRITICAL_NOTICE_BANNER_CLASS,
        attributes: attrs
    });
    rows.forEach((row, index) => {
        if (index > 0) {
            row.classList.add('audit-overview__newer-rule-banner__row--stacked');
        }
        banner.appendChild(row);
    });
    return banner;
}

/**
 * @param {typeof import('./helpers.js')} Helpers
 * @param {{ message: string, reload_label: string, on_reload: () => void }} options
 * @returns {HTMLElement}
 */
export function build_version_reload_banner_row(Helpers, { message, reload_label, on_reload }) {
    return build_critical_notice_banner_row(Helpers, {
        lead_text: message,
        buttons: [
            {
                text: reload_label,
                class_names: ['button', 'button-default', 'audit-overview__newer-rule-banner__btn'],
                on_click: on_reload
            }
        ]
    });
}
