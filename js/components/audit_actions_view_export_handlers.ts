// @ts-nocheck
/**
 * @fileoverview Export-handlers för Åtgärder-sidan.
 */
import { open_observation_word_import_modal } from './observation_word_import/observation_word_import_modal.js';

/**
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 */
export function bind_audit_actions_export_handlers(view) {
    view.handle_export_csv = async () => {
        const current_state = view.getState();
        if (view.ExportLogic?.export_to_csv) {
            await view.ExportLogic.export_to_csv(current_state);
        }
    };

    view.handle_export_excel = async () => {
        const current_state = view.getState();
        if (view.ExportLogic?.export_to_excel) {
            await view.ExportLogic.export_to_excel(current_state);
        }
    };

    view.handle_export_word = async () => {
        const current_state = view.getState();
        if (view.ExportLogic?.export_to_word_criterias) {
            await view.ExportLogic.export_to_word_criterias(current_state);
        }
    };

    view.handle_export_pdf = async () => {
        const current_state = view.getState();
        if (!view.ExportLogic?.export_to_pdf_criterias) return;
        await view.ExportLogic.export_to_pdf_criterias(current_state);
    };

    view.handle_export_pdf_deficiency_types = async () => {
        const current_state = view.getState();
        if (!view.ExportLogic?.export_to_pdf_deficiency_types) return;
        await view.ExportLogic.export_to_pdf_deficiency_types(current_state);
    };

    view.handle_export_pdf_samples = async () => {
        const current_state = view.getState();
        if (!view.ExportLogic?.export_to_pdf_samples) return;
        await view.ExportLogic.export_to_pdf_samples(current_state);
    };

    view.handle_export_word_deficiency_types = async () => {
        const current_state = view.getState();
        if (!view.ExportLogic?.export_to_word_deficiency_types) return;
        await view.ExportLogic.export_to_word_deficiency_types(current_state);
    };

    view.handle_export_word_screenshots_appendix = async () => {
        const current_state = view.getState();
        if (!view.ExportLogic?.export_to_word_screenshots_appendix) return;
        await view.ExportLogic.export_to_word_screenshots_appendix(current_state);
    };

    view.handle_export_pdf_screenshots_appendix = async () => {
        const current_state = view.getState();
        if (!view.ExportLogic?.export_to_pdf_screenshots_appendix) return;
        await view.ExportLogic.export_to_pdf_screenshots_appendix(current_state);
    };

    view.handle_export_word_samples = async () => {
        const current_state = view.getState();
        if (view.ExportLogic?.export_to_word_samples) {
            await view.ExportLogic.export_to_word_samples(current_state);
        }
    };

    view.handle_export_html = async () => {
        const current_state = view.getState();
        if (!view.ExportLogic?.export_to_html) return;
        await view.ExportLogic.export_to_html(current_state);
    };

    view.handle_export_images_zip = async () => {
        const current_state = view.getState();
        if (!view.ExportLogic?.export_to_images_zip) return;
        await view.ExportLogic.export_to_images_zip(current_state);
    };

    view.handle_export_observation_texts_word = async () => {
        const current_state = view.getState();
        if (!view.ExportLogic?.export_observation_texts_word) return;
        await view.ExportLogic.export_observation_texts_word(current_state);
    };

    view.handle_export_all_appendices_zip = async () => {
        const current_state = view.getState();
        if (!view.ExportLogic?.export_audit_appendices_zip) return;
        await view.ExportLogic.export_audit_appendices_zip(current_state);
    };

    view.handle_import_processed_observation_texts_word = () => {
        const current_state = view.getState();
        if (current_state?.auditStatus !== 'locked') return;
        const t = view.Translation.t;
        open_observation_word_import_modal({
            t,
            Helpers: view.Helpers,
            audit: current_state,
            dispatch: view.dispatch,
            StoreActionTypes: view.StoreActionTypes,
            trigger_element: document.getElementById('audit-action-btn-import-processed-observation-texts-word'),
            on_import_complete: (message) => {
                view.NotificationComponent?.show_global_message?.(message, 'success');
            },
        });
    };
}
