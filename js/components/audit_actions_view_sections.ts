// @ts-nocheck
/**
 * @fileoverview Renderar bilageguide- och exportsektioner på Åtgärder-sidan.
 */
import { audit_status_is_exportable } from '../utils/audit_status_helpers.js';
import { collect_html_export_zip_entries } from '../export/export_html_media.js';
import { has_screenshots_appendix_images } from '../export/export_screenshots_appendix_collect.js';

/**
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 */
export function build_audit_actions_appendix_guide_section(view, state, t) {
    const section = view.Helpers.create_element('section', {
        class_name: 'audit-actions__appendix-guide-section',
    });
    section.appendChild(view.Helpers.create_element('h2', {
        class_name: 'audit-actions__section-title',
        text_content: t('audit_actions_appendix_guide_title'),
    }));

    if (!audit_status_is_exportable(state.auditStatus)) {
        section.appendChild(view.Helpers.create_element('p', {
            class_name: 'audit-actions__section-lead',
            text_content: t('audit_not_locked_for_export'),
        }));
        return section;
    }

    section.appendChild(view.Helpers.create_element('p', {
        class_name: 'audit-actions__section-lead',
        text_content: t('audit_actions_appendix_guide_intro'),
    }));

    const actions = view.Helpers.create_element('div', { class_name: 'audit-actions__export-list' });
    const item = view.Helpers.create_element('div', {
        class_name: 'audit-actions__export-item',
        attributes: { role: 'group', 'aria-labelledby': 'audit-action-btn-download-observation-texts-word' },
    });
    const buttons_row = view.Helpers.create_element('div', {
        class_name: 'audit-actions__export-buttons',
    });

    if (view.ExportLogic?.export_observation_texts_word) {
        buttons_row.appendChild(view.create_file_download_action_button({
            label: t('audit_actions_download_observation_texts_word'),
            on_download: () => view.handle_export_observation_texts_word(),
            variant: 'button-default',
            icon_name: 'export',
            id: 'audit-action-btn-download-observation-texts-word',
        }));
    }

    buttons_row.appendChild(view.create_action_button({
        label: t('audit_actions_import_processed_observation_texts_word'),
        on_click: () => {},
        variant: 'button-default',
        icon_name: 'export',
        id: 'audit-action-btn-import-processed-observation-texts-word',
    }));

    item.appendChild(buttons_row);
    actions.appendChild(item);
    section.appendChild(actions);
    return section;
}

/**
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 */
export function build_audit_actions_export_section(view, state, t) {
    const export_section = view.Helpers.create_element('section', {
        class_name: 'audit-actions__export-section',
    });
    export_section.appendChild(view.Helpers.create_element('h2', {
        class_name: 'audit-actions__section-title',
        text_content: t('audit_actions_exports_title'),
    }));

    if (!audit_status_is_exportable(state.auditStatus)) {
        export_section.appendChild(view.Helpers.create_element('p', {
            class_name: 'audit-actions__section-lead',
            text_content: t('audit_not_locked_for_export'),
        }));
        return export_section;
    }

    const export_actions = view.Helpers.create_element('div', { class_name: 'audit-actions__export-list' });

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

    if (view.ExportLogic?.export_to_word_deficiency_types || view.ExportLogic?.export_to_pdf_deficiency_types) {
        export_actions.appendChild(view.create_export_item_with_buttons({
            buttons: [
                ...(view.ExportLogic?.export_to_word_deficiency_types
                    ? [{
                        label: t('export_word_deficiency_types_button'),
                        on_click: view.handle_export_word_deficiency_types,
                        id_suffix: 'export-word-deficiency-types',
                    }]
                    : []),
                ...(view.ExportLogic?.export_to_pdf_deficiency_types
                    ? [{
                        label: t('export_pdf_deficiency_types_button'),
                        on_click: view.handle_export_pdf_deficiency_types,
                        id_suffix: 'export-pdf-deficiency-types',
                    }]
                    : []),
            ],
            description: t('audit_actions_export_deficiency_types_description'),
            desc_id_suffix: 'export-deficiency-types',
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

    export_section.appendChild(export_actions);
    return export_section;
}
