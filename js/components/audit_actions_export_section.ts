// @ts-nocheck
/**
 * @fileoverview Accordion för exportsektionen på Åtgärder-sidan (låst/arkiverad granskning).
 */
import { audit_status_is_exportable } from '../utils/audit_status_helpers.js';
import { collect_html_export_zip_entries } from '../export/export_html_media.js';
import { has_screenshots_appendix_images } from '../export/export_screenshots_appendix_collect.js';
import {
    EXPANDABLE_PANEL_EXPANDED_CLASS,
    animate_expandable_panel,
    apply_instant_expanded_panel_state,
} from '../utils/expandable_panel_transition.js';

/**
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 * @param {HTMLElement} export_actions
 */
function populate_audit_actions_export_list(view, state, t, export_actions) {
    if (view.ExportLogic?.export_to_csv || view.ExportLogic?.export_to_excel) {
        export_actions.appendChild(view.create_export_item_with_buttons({
            buttons: [
                ...(view.ExportLogic?.export_to_excel
                    ? [{
                        label: t('export_to_excel'),
                        on_click: view.handle_export_excel,
                        id_suffix: 'export-excel',
                    }]
                    : []),
                ...(view.ExportLogic?.export_to_csv
                    ? [{
                        label: t('export_to_csv'),
                        on_click: view.handle_export_csv,
                        id_suffix: 'export-csv',
                    }]
                    : []),
            ],
            description: t('audit_actions_export_spreadsheet_description'),
            desc_id_suffix: 'export-spreadsheet',
        }));
    }

    if (view.ExportLogic?.export_to_word_criterias || view.ExportLogic?.export_to_pdf_criterias) {
        export_actions.appendChild(view.create_export_item_with_buttons({
            buttons: [
                ...(view.ExportLogic?.export_to_word_criterias
                    ? [{
                        label: t('export_to_word'),
                        on_click: view.handle_export_word,
                        id_suffix: 'export-word-reqs',
                    }]
                    : []),
                ...(view.ExportLogic?.export_to_pdf_criterias
                    ? [{
                        label: t('export_to_pdf'),
                        on_click: view.handle_export_pdf,
                        id_suffix: 'export-pdf-reqs',
                    }]
                    : []),
            ],
            description: t('audit_actions_export_word_requirements_description'),
            desc_id_suffix: 'export-reqs-report',
        }));
    }

    if (view.ExportLogic?.export_to_word_samples || view.ExportLogic?.export_to_pdf_samples) {
        export_actions.appendChild(view.create_export_item_with_buttons({
            buttons: [
                ...(view.ExportLogic?.export_to_word_samples
                    ? [{
                        label: t('export_to_word_samples'),
                        on_click: view.handle_export_word_samples,
                        id_suffix: 'export-word-samples',
                    }]
                    : []),
                ...(view.ExportLogic?.export_to_pdf_samples
                    ? [{
                        label: t('export_to_pdf_samples'),
                        on_click: view.handle_export_pdf_samples,
                        id_suffix: 'export-pdf-samples',
                    }]
                    : []),
            ],
            description: t('audit_actions_export_word_samples_description'),
            desc_id_suffix: 'export-samples-report',
        }));
    }

    if (view.ExportLogic?.export_to_html) {
        export_actions.appendChild(view.create_export_item({
            label: t('export_to_html'),
            description: t('audit_actions_export_html_description'),
            on_click: view.handle_export_html,
            id_suffix: 'export-html',
        }));
    }

    const has_exportable_images = collect_html_export_zip_entries(state, null).length > 0;
    const has_screenshots_appendix = has_screenshots_appendix_images(state);

    if (view.ExportLogic?.export_to_images_zip && has_exportable_images) {
        export_actions.appendChild(view.create_export_item({
            label: t('export_to_images_zip'),
            description: t('audit_actions_export_images_zip_description'),
            on_click: view.handle_export_images_zip,
            id_suffix: 'export-images-zip',
        }));
    }

    if (
        view.ExportLogic?.export_to_word_appendix1_summary
        || view.ExportLogic?.export_to_word_deficiency_types
        || view.ExportLogic?.export_to_pdf_appendix1_summary
        || view.ExportLogic?.export_to_pdf_deficiency_types
    ) {
        export_actions.appendChild(view.create_export_item_with_buttons({
            buttons: [
                ...(view.ExportLogic?.export_to_word_appendix1_summary || view.ExportLogic?.export_to_word_deficiency_types
                    ? [{
                        label: t('export_word_appendix1_summary_button'),
                        on_click: view.handle_export_word_deficiency_types,
                        id_suffix: 'export-word-appendix1-summary',
                    }]
                    : []),
                ...(view.ExportLogic?.export_to_pdf_appendix1_summary || view.ExportLogic?.export_to_pdf_deficiency_types
                    ? [{
                        label: t('export_pdf_appendix1_summary_button'),
                        on_click: view.handle_export_pdf_deficiency_types,
                        id_suffix: 'export-pdf-appendix1-summary',
                    }]
                    : []),
            ],
            description: t('audit_actions_export_appendix1_summary_description'),
            desc_id_suffix: 'export-appendix1-summary',
        }));
    }

    if (
        has_screenshots_appendix
        && (view.ExportLogic?.export_to_word_screenshots_appendix || view.ExportLogic?.export_to_pdf_screenshots_appendix)
    ) {
        export_actions.appendChild(view.create_export_item_with_buttons({
            buttons: [
                ...(view.ExportLogic?.export_to_word_screenshots_appendix
                    ? [{
                        label: t('export_word_screenshots_appendix_button'),
                        on_click: view.handle_export_word_screenshots_appendix,
                        id_suffix: 'export-word-screenshots-appendix',
                    }]
                    : []),
                ...(view.ExportLogic?.export_to_pdf_screenshots_appendix
                    ? [{
                        label: t('export_pdf_screenshots_appendix_button'),
                        on_click: view.handle_export_pdf_screenshots_appendix,
                        id_suffix: 'export-pdf-screenshots-appendix',
                    }]
                    : []),
            ],
            description: t('audit_actions_export_screenshots_appendix_description'),
            desc_id_suffix: 'export-screenshots-appendix',
        }));
    }
}

function create_audit_actions_export_list(view, state, t) {
    const export_actions = view.Helpers.create_element('div', { class_name: 'audit-actions__export-list' });
    populate_audit_actions_export_list(view, state, t, export_actions);
    if (export_actions.childElementCount === 0) {
        return null;
    }
    return export_actions;
}

async function toggle_export_section_accordion(
    section,
    panel_host,
    expandable_panel,
    header_button,
    title_element,
    mount_content,
    unmount_content
) {
    if (section.getAttribute('data-animating') === 'true') return;

    const will_open = !section.classList.contains('content-types-section-accordion--open');
    section.setAttribute('data-animating', 'true');
    try {
        if (will_open) {
            mount_content();
            section.classList.add('content-types-section-accordion--open');
            header_button.setAttribute('aria-expanded', 'true');
            await animate_expandable_panel(expandable_panel, panel_host, true, EXPANDABLE_PANEL_EXPANDED_CLASS);
            return;
        }

        section.classList.remove('content-types-section-accordion--open');
        header_button.setAttribute('aria-expanded', 'false');
        await animate_expandable_panel(expandable_panel, panel_host, false, EXPANDABLE_PANEL_EXPANDED_CLASS);
        unmount_content();
        title_element.scrollIntoView({ block: 'start', behavior: 'auto' });
    } finally {
        section.removeAttribute('data-animating');
    }
}

/**
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 */
export function build_audit_actions_export_section(view, state, t) {
    if (!audit_status_is_exportable(state.auditStatus)) {
        return null;
    }

    const export_list = create_audit_actions_export_list(view, state, t);
    if (!export_list) {
        return null;
    }

    const initially_open = false;
    const panel_id = 'audit-actions-export-accordion-panel';
    const heading_id = 'audit-actions-export-accordion-heading';

    const export_section = view.Helpers.create_element('section', {
        class_name: ['audit-actions__export-section', 'content-types-section-accordion'],
    });

    const header_button = view.Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'content-types-section-accordion__header'],
        attributes: {
            type: 'button',
            'aria-controls': panel_id,
            'aria-expanded': initially_open ? 'true' : 'false',
        },
    });
    const header_inner = view.Helpers.create_element('span', {
        class_name: 'content-types-section-accordion__header-inner',
    });
    const title_h2 = view.Helpers.create_element('h2', {
        class_name: 'content-types-section-accordion__title',
        attributes: { id: heading_id },
        text_content: t('audit_actions_exports_title'),
    });
    header_inner.append(
        title_h2,
        view.Helpers.create_element('span', {
            class_name: 'content-types-section-accordion__chevron',
            attributes: { 'aria-hidden': 'true' },
        })
    );
    header_button.appendChild(header_inner);
    export_section.appendChild(header_button);

    const panel_host = view.Helpers.create_element('div', {
        class_name: 'content-types-section-accordion__panel-host',
        attributes: {
            id: panel_id,
            role: 'region',
            'aria-labelledby': heading_id,
        },
    });
    panel_host.hidden = !initially_open;

    const expandable_panel = view.Helpers.create_element('div', {
        class_name: ['expandable-panel', 'content-types-section-accordion__panel'],
    });
    const panel_inner = view.Helpers.create_element('div', {
        class_name: ['expandable-panel__inner', 'content-types-section-accordion__panel-inner'],
    });
    expandable_panel.appendChild(panel_inner);
    panel_host.appendChild(expandable_panel);
    export_section.appendChild(panel_host);

    const mount_content = () => {
        if (export_list.parentElement === panel_inner) return;
        panel_inner.appendChild(export_list);
    };

    const unmount_content = () => {
        export_list.remove();
    };

    header_button.addEventListener('click', () => {
        void toggle_export_section_accordion(
            export_section,
            panel_host,
            expandable_panel,
            header_button,
            title_h2,
            mount_content,
            unmount_content
        );
    });

    if (initially_open) {
        export_section.classList.add('content-types-section-accordion--open');
        mount_content();
        apply_instant_expanded_panel_state(expandable_panel, panel_host, true, EXPANDABLE_PANEL_EXPANDED_CLASS);
    }

    return export_section;
}
