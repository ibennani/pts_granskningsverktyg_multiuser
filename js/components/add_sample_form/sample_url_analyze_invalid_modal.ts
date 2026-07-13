/**
 * @fileoverview Informationsmodal när Analysera sida klickas utan giltig URL.
 */

import { app_runtime_refs } from '../../utils/app_runtime_refs.js';

type ShowSampleUrlAnalyzeInvalidModalOptions = {
    Helpers: {
        create_element: (
            tag: string,
            options?: Record<string, unknown>
        ) => HTMLElement;
    };
    t: (key: string, params?: Record<string, unknown>) => string;
};

export function show_sample_url_analyze_invalid_modal({
    Helpers,
    t
}: ShowSampleUrlAnalyzeInvalidModalOptions): void {
    const ModalComponent = app_runtime_refs.modal_component as {
        show?: (
            opts: { h1_text: string; message_text: string },
            render: (container: HTMLElement, modal: { close: () => void }) => void
        ) => void;
    } | null;
    if (!ModalComponent?.show || !Helpers?.create_element) return;

    ModalComponent.show(
        {
            h1_text: t('sample_url_analyze_invalid_modal_title'),
            message_text: t('sample_url_analyze_invalid_modal_message')
        },
        (container, modal) => {
            const actions = Helpers.create_element('div', {
                class_name: 'modal-confirm-actions'
            });
            const close_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                text_content: t('close'),
                attributes: { type: 'button' }
            });
            close_btn.addEventListener('click', () => modal.close());
            actions.appendChild(close_btn);
            container.appendChild(actions);
        }
    );
}
