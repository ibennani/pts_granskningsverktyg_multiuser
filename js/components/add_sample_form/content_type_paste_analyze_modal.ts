/**
 * @fileoverview Modal för automatisk analys av inklistrad HTML i granskningsdelsformuläret.
 */

import { app_runtime_refs } from '../../utils/app_runtime_refs.js';
import {
    apply_detected_content_types,
    type ContentTypeDetectionComponentLike,
} from './content_type_detection.js';
import {
    collect_child_detection_patterns,
    detect_content_types_from_html,
    is_paste_html_within_limit,
} from './content_type_html_detection_logic.js';

type PasteAnalyzeModalHandle = {
    close: () => void;
    dialog_element_ref?: HTMLDialogElement | null;
    content_container_ref?: HTMLElement | null;
};

type ShowContentTypePasteAnalyzeModalOptions = {
    component: ContentTypeDetectionComponentLike;
    Helpers: {
        create_element: (
            tag: string,
            options?: Record<string, unknown>
        ) => HTMLElement;
    };
    t: (key: string, params?: Record<string, unknown>) => string;
};

function set_paste_analyze_status(
    component: ContentTypeDetectionComponentLike,
    message: string
): void {
    const region = component.content_type_analyze_live_region;
    if (!region) return;
    region.textContent = message;
}

export function show_content_type_paste_analyze_modal({
    component,
    Helpers,
    t,
}: ShowContentTypePasteAnalyzeModalOptions): void {
    const ModalComponent = app_runtime_refs.modal_component as {
        show?: (
            opts: { h1_text: string; message_text: string },
            render: (container: HTMLElement, modal: PasteAnalyzeModalHandle) => void
        ) => void;
    } | null;
    if (!ModalComponent?.show || !Helpers?.create_element) return;

    ModalComponent.show(
        {
            h1_text: t('content_type_paste_analyze_modal_title'),
            message_text: t('content_type_paste_analyze_modal_intro'),
        },
        (container, modal) => {
            modal.dialog_element_ref?.classList.add('modal-dialog--content-type-paste-analyze');
            container.classList.add('modal-body--content-type-paste-analyze');

            const intro_el = container.querySelector('.modal-message');
            if (intro_el instanceof HTMLElement && !intro_el.id) {
                intro_el.id = 'content-type-paste-analyze-intro';
            }

            const form_group = Helpers.create_element('div', {
                class_name: ['form-group', 'content-type-paste-analyze-modal-form'],
            });
            const textarea_id = 'content-type-paste-analyze-html';

            const textarea = Helpers.create_element('textarea', {
                id: textarea_id,
                class_name: 'form-control content-type-paste-analyze-modal-textarea',
                attributes: {
                    rows: '10',
                    'aria-labelledby': intro_el?.id || 'modal-dialog-title',
                    'data-skip-markdown-toolbar': 'true',
                },
            }) as HTMLTextAreaElement;
            form_group.appendChild(textarea);
            container.appendChild(form_group);

            const status_el = Helpers.create_element('p', {
                class_name: 'content-type-paste-analyze-modal-status',
                attributes: {
                    role: 'status',
                },
            });
            container.appendChild(status_el);

            const actions = Helpers.create_element('div', {
                class_name: 'modal-confirm-actions',
            });

            const run_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                text_content: t('content_type_paste_analyze_modal_run'),
                attributes: { type: 'button' },
            });

            const close_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                text_content: t('content_type_paste_analyze_modal_close'),
                attributes: { type: 'button' },
            });

            run_btn.addEventListener('click', () => {
                const html = textarea.value || '';
                if (!html.trim()) {
                    status_el.textContent = t('content_type_paste_analyze_empty');
                    textarea.focus();
                    return;
                }
                if (!is_paste_html_within_limit(html)) {
                    status_el.textContent = t('content_type_paste_analyze_too_large');
                    return;
                }

                const patterns = collect_child_detection_patterns(component.getState?.()?.ruleFileContent);
                if (patterns.length === 0) {
                    status_el.textContent = t('content_type_paste_analyze_no_patterns');
                    return;
                }

                const detected_ids = detect_content_types_from_html(html, patterns);
                if (detected_ids.length === 0) {
                    modal.close();
                    set_paste_analyze_status(component, t('content_type_paste_analyze_none_found'));
                    return;
                }

                const applied = apply_detected_content_types(component, detected_ids);
                component.save_form_data_immediately(true, false, true);
                modal.close();
                set_paste_analyze_status(
                    component,
                    t('content_type_paste_analyze_applied', {
                        count: applied || detected_ids.length,
                    })
                );
            });

            close_btn.addEventListener('click', () => modal.close());
            actions.append(run_btn, close_btn);
            container.appendChild(actions);

            requestAnimationFrame(() => {
                textarea.focus();
            });
        }
    );
}
