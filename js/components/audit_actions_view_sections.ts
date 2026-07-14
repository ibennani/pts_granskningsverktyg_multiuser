// @ts-nocheck
/**
 * @fileoverview Renderar bilageguide- och exportsektioner på Åtgärder-sidan.
 */
import { audit_status_is_exportable } from '../utils/audit_status_helpers.js';
import { has_screenshots_appendix_images } from '../export/export_screenshots_appendix_collect.js';
import { build_audit_actions_status_section } from './audit_actions_view_status_section.js';
import { build_audit_actions_export_section } from './audit_actions_export_section.js';

/**
 * Bygger innehållswrappern (sektioner under sidrubriken) för Åtgärder-sidan.
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 */
export function build_audit_actions_content_wrapper(view, state, t) {
    const content_wrapper = view.Helpers.create_element('div', {
        class_name: 'audit-actions__content',
    });

    const status_section = build_audit_actions_status_section(view, state, t);
    const appendix_guide_section = build_audit_actions_appendix_guide_section(view, state, t);
    const appendix_download_section = build_audit_actions_appendix_download_section(view, state, t);
    const export_section = build_audit_actions_export_section(view, state, t);

    if (state.auditStatus === 'locked' || state.auditStatus === 'archived') {
        if (appendix_guide_section) content_wrapper.appendChild(appendix_guide_section);
        if (appendix_download_section) content_wrapper.appendChild(appendix_download_section);
        if (export_section) content_wrapper.appendChild(export_section);
        content_wrapper.appendChild(status_section);
    } else {
        content_wrapper.appendChild(status_section);
        if (appendix_guide_section) content_wrapper.appendChild(appendix_guide_section);
        if (export_section) content_wrapper.appendChild(export_section);
    }

    return content_wrapper;
}

/**
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 */
export function build_audit_actions_appendix_guide_section(view, state, t) {
    if (!audit_status_is_exportable(state.auditStatus)) {
        return null;
    }

    const section = view.Helpers.create_element('section', {
        class_name: 'audit-actions__appendix-guide-section',
    });
    section.appendChild(view.Helpers.create_element('h2', {
        class_name: 'audit-actions__section-title',
        text_content: t('audit_actions_appendix_guide_title'),
    }));

    const steps = view.Helpers.create_element('div', { class_name: 'audit-actions__appendix-guide-steps' });

    steps.appendChild(view.Helpers.create_element('p', {
        class_name: 'audit-actions__export-description',
        text_content: t('audit_actions_appendix_guide_intro'),
        attributes: { id: 'audit-action-desc-appendix-guide-download' },
    }));

    if (view.ExportLogic?.export_observation_texts_word) {
        steps.appendChild(view.create_file_download_action_button({
            label: t('audit_actions_download_observation_texts_word'),
            on_download: () => view.handle_export_observation_texts_word(),
            variant: 'button-default',
            icon_name: 'export',
            id: 'audit-action-btn-download-observation-texts-word',
            aria_describedby: 'audit-action-desc-appendix-guide-download',
        }));
    }

    const upload_block = view.Helpers.create_element('div', {
        class_name: 'audit-actions__appendix-guide-upload-block',
    });
    upload_block.appendChild(view.Helpers.create_element('p', {
        class_name: 'audit-actions__export-description',
        text_content: t('audit_actions_appendix_guide_upload_intro'),
        attributes: { id: 'audit-action-desc-appendix-guide-upload' },
    }));

    if (state.auditStatus === 'archived') {
        upload_block.appendChild(view.Helpers.create_element('p', {
            class_name: 'audit-actions__export-description',
            text_content: t('audit_actions_import_processed_observation_texts_archived_blocked'),
        }));
    } else if (state.auditStatus === 'locked') {
        upload_block.appendChild(view.create_action_button({
            label: t('audit_actions_import_processed_observation_texts_word'),
            on_click: () => view.handle_import_processed_observation_texts_word?.(),
            variant: 'button-default',
            icon_name: 'upload_file',
            id: 'audit-action-btn-import-processed-observation-texts-word',
            aria_describedby: 'audit-action-desc-appendix-guide-upload',
        }));
    }
    steps.appendChild(upload_block);

    section.appendChild(steps);
    return section;
}

/**
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 */
export function build_audit_actions_appendix_download_section(view, state, t) {
    if (!audit_status_is_exportable(state.auditStatus)) {
        return null;
    }

    const has_appendix_1 = Boolean(view.ExportLogic?.export_to_pdf_deficiency_types);
    const has_appendix_2 = Boolean(view.ExportLogic?.export_to_excel);
    const has_appendix_3 = has_screenshots_appendix_images(state)
        && Boolean(view.ExportLogic?.export_to_pdf_screenshots_appendix);
    const has_zip = Boolean(view.ExportLogic?.export_audit_appendices_zip)
        && (has_appendix_1 || has_appendix_2);

    if (!has_appendix_1 && !has_appendix_2 && !has_appendix_3 && !has_zip) {
        return null;
    }

    const section = view.Helpers.create_element('section', {
        class_name: 'audit-actions__appendix-download-section',
    });
    section.appendChild(view.Helpers.create_element('h2', {
        class_name: 'audit-actions__section-title',
        text_content: t('audit_actions_download_appendices_title'),
    }));

    const actions = view.Helpers.create_element('div', {
        class_name: 'audit-actions__appendix-download-actions',
    });

    actions.appendChild(view.Helpers.create_element('p', {
        class_name: 'audit-actions__export-description',
        text_content: t('audit_actions_download_appendices_intro'),
        attributes: { id: 'audit-action-desc-appendix-download' },
    }));

    if (has_appendix_1) {
        actions.appendChild(view.create_file_download_action_button({
            label: t('audit_actions_appendix_1_summary_button'),
            on_download: () => view.handle_export_pdf_deficiency_types(),
            variant: 'button-default',
            icon_name: 'export',
            id: 'audit-action-btn-appendix-1-summary',
            aria_describedby: 'audit-action-desc-appendix-download',
        }));
    }

    if (has_appendix_2) {
        actions.appendChild(view.create_file_download_action_button({
            label: t('audit_actions_appendix_2_protocol_button'),
            on_download: () => view.handle_export_excel(),
            variant: 'button-default',
            icon_name: 'export',
            id: 'audit-action-btn-appendix-2-protocol',
            aria_describedby: 'audit-action-desc-appendix-download',
        }));
    }

    if (has_appendix_3) {
        actions.appendChild(view.create_file_download_action_button({
            label: t('audit_actions_appendix_3_images_button'),
            on_download: () => view.handle_export_pdf_screenshots_appendix(),
            variant: 'button-default',
            icon_name: 'export',
            id: 'audit-action-btn-appendix-3-images',
            aria_describedby: 'audit-action-desc-appendix-download',
        }));
    }

    if (has_zip) {
        actions.appendChild(view.create_file_download_action_button({
            label: t('audit_actions_download_all_appendices_zip_button'),
            on_download: () => view.handle_export_all_appendices_zip(),
            variant: 'button-default',
            icon_name: 'export',
            id: 'audit-action-btn-appendix-all-zip',
            aria_describedby: 'audit-action-desc-appendix-download',
        }));
    }

    section.appendChild(actions);
    return section;
}
