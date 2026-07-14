// @ts-nocheck
/**
 * @fileoverview Export-handlers för Åtgärder-sidan.
 */

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
}
