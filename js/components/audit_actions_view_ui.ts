// @ts-nocheck
/**
 * @fileoverview UI-hjälpare för knappar och exportrader på Åtgärder-sidan.
 */
import { create_file_download_button } from '../utils/file_download_button_ui.js';

/**
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 */
export function create_file_download_action_button(
    view,
    { label, on_download, variant = 'button-default', icon_name = 'export', id = null, aria_describedby = null }
) {
    const parts = create_file_download_button({
        Helpers: view.Helpers,
        label,
        on_download,
        t: view.Translation.t,
        variant,
        icon_name,
        id,
        aria_describedby,
    });
    return parts.wrapper;
}

/**
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 */
export function create_action_button(
    view,
    { label, on_click, variant = 'button-default', icon_name = null, id = null, aria_describedby = null }
) {
    const icon = (icon_name && view.Helpers.get_icon_svg)
        ? view.Helpers.get_icon_svg(icon_name, ['currentColor'], 16)
        : '';

    const attributes = {};
    if (id) attributes.id = id;
    if (aria_describedby) attributes['aria-describedby'] = aria_describedby;

    return view.Helpers.create_element('button', {
        class_name: ['button', 'button-small', variant],
        html_content: `<span>${label}</span>${icon}`,
        attributes,
        event_listeners: { click: on_click },
    });
}

/**
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 */
export function create_export_item(view, { label, description, on_click, id_suffix }) {
    const btn_id = id_suffix ? `audit-action-btn-${id_suffix}` : null;
    const desc_id = id_suffix ? `audit-action-desc-${id_suffix}` : null;

    const wrapper = view.Helpers.create_element('div', {
        class_name: 'audit-actions__export-item',
        attributes: desc_id ? { role: 'group', 'aria-describedby': desc_id } : {},
    });
    wrapper.appendChild(view.Helpers.create_element('p', {
        class_name: 'audit-actions__export-description',
        text_content: description,
        attributes: desc_id ? { id: desc_id } : {},
    }));
    wrapper.appendChild(create_file_download_action_button(view, {
        label,
        on_download: on_click,
        variant: 'button-default',
        icon_name: 'export',
        id: btn_id,
        aria_describedby: desc_id || undefined,
    }));
    return wrapper;
}

/**
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 */
export function create_export_item_with_buttons(view, { buttons, description, desc_id_suffix }) {
    const desc_id = desc_id_suffix ? `audit-action-desc-${desc_id_suffix}` : null;

    const wrapper = view.Helpers.create_element('div', {
        class_name: 'audit-actions__export-item',
        attributes: desc_id ? { role: 'group', 'aria-describedby': desc_id } : {},
    });
    wrapper.appendChild(view.Helpers.create_element('p', {
        class_name: 'audit-actions__export-description',
        text_content: description,
        attributes: desc_id ? { id: desc_id } : {},
    }));
    const buttons_row = view.Helpers.create_element('div', {
        class_name: 'audit-actions__export-buttons',
    });
    for (const btn of buttons) {
        buttons_row.appendChild(create_file_download_action_button(view, {
            label: btn.label,
            on_download: btn.on_click,
            variant: 'button-default',
            icon_name: 'export',
            id: btn.id_suffix ? `audit-action-btn-${btn.id_suffix}` : null,
            aria_describedby: desc_id || undefined,
        }));
    }
    wrapper.appendChild(buttons_row);
    return wrapper;
}

/**
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 */
export function create_file_download_status_item(
    view,
    { label, description, on_download, variant = 'button-default', icon_name = null, id_suffix }
) {
    const btn_id = id_suffix ? `audit-action-btn-${id_suffix}` : null;
    const desc_id = id_suffix ? `audit-action-desc-${id_suffix}` : null;

    const wrapper = view.Helpers.create_element('div', {
        class_name: 'audit-actions__status-item',
        attributes: desc_id ? { role: 'group', 'aria-describedby': desc_id } : {},
    });
    wrapper.appendChild(view.Helpers.create_element('p', {
        class_name: 'audit-actions__status-description',
        text_content: description,
        attributes: desc_id ? { id: desc_id } : {},
    }));
    wrapper.appendChild(create_file_download_action_button(view, {
        label,
        on_download,
        variant,
        icon_name,
        id: btn_id,
        aria_describedby: desc_id || undefined,
    }));
    return wrapper;
}

/**
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 */
export function create_status_action_item(
    view,
    { label, description, on_click, variant = 'button-default', icon_name = null, id_suffix }
) {
    const btn_id = id_suffix ? `audit-action-btn-${id_suffix}` : null;
    const desc_id = id_suffix ? `audit-action-desc-${id_suffix}` : null;

    const wrapper = view.Helpers.create_element('div', {
        class_name: 'audit-actions__status-item',
        attributes: desc_id ? { role: 'group', 'aria-describedby': desc_id } : {},
    });
    wrapper.appendChild(view.Helpers.create_element('p', {
        class_name: 'audit-actions__status-description',
        text_content: description,
        attributes: desc_id ? { id: desc_id } : {},
    }));
    wrapper.appendChild(create_action_button(view, {
        label,
        on_click,
        variant,
        icon_name,
        id: btn_id,
        aria_describedby: desc_id || undefined,
    }));
    return wrapper;
}

/**
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 */
export function bind_audit_actions_view_ui(view) {
    view.create_file_download_action_button = (opts) => create_file_download_action_button(view, opts);
    view.create_action_button = (opts) => create_action_button(view, opts);
    view.create_export_item = (opts) => create_export_item(view, opts);
    view.create_export_item_with_buttons = (opts) => create_export_item_with_buttons(view, opts);
    view.create_file_download_status_item = (opts) => create_file_download_status_item(view, opts);
    view.create_status_action_item = (opts) => create_status_action_item(view, opts);
}
