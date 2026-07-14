/**
 * @fileoverview Öppnar modal för import av handläggar-Word.
 */
import { app_runtime_refs } from '../../utils/app_runtime_refs.js';
import {
    setup_observation_word_import_modal_content,
    type ObservationWordImportModalOptions,
} from './observation_word_import_modal_setup.js';

export type { ObservationWordImportModalOptions } from './observation_word_import_modal_setup.js';

/**
 * Öppnar importmodalen för bearbetade observationstexter.
 */
export function open_observation_word_import_modal(options: ObservationWordImportModalOptions): void {
    const ModalComponent = app_runtime_refs.modal_component as {
        show?: (
            opts: { h1_text: string; message_text: string },
            render: (container: HTMLElement, modal: { close: (el?: HTMLElement | null) => void }) => void
        ) => void;
    } | null;
    if (!ModalComponent?.show) return;

    const { t } = options;
    ModalComponent.show(
        {
            h1_text: t('observation_word_import_modal_title'),
            message_text: t('observation_word_import_modal_intro'),
        },
        (container, modal) => {
            setup_observation_word_import_modal_content(container, modal, options);
        }
    );
}
