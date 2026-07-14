/**
 * @fileoverview Filväljare för Word-importmodalen (en .docx-fil).
 */
import {
    pick_single_word_docx_file,
    WORD_DOCX_ACCEPT,
    WORD_IMPORT_MAX_BYTES,
} from '../../../shared/import/word_file_validation.js';
import {
    can_use_navigator_clipboard_read,
    clipboard_event_has_non_file_content,
    clipboard_event_has_non_word_files,
    extract_all_files_from_clipboard_event,
    extract_word_files_from_clipboard_event,
    extract_word_files_from_navigator_clipboard,
    files_from_drag_event,
    should_handle_paste_event,
} from '../../../shared/import/clipboard_word_files.js';
import '../../../css/components/observation_word_import_modal.css';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type HelpersLike = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
};

export type ObservationWordFileDropZoneOptions = {
    helpers: HelpersLike;
    t: TranslateFn;
    input_id: string;
    on_file: (file: File) => void;
    on_status?: (message: string, type?: 'info' | 'error' | 'success') => void;
    /** Ytterligare ytor som tar emot drag/släpp (t.ex. hela modalinnehållet). */
    additional_drop_targets?: HTMLElement[];
    /** Rot inom modalen för dokumentnivå-klistra in (capture). */
    paste_modal_root?: HTMLElement | null;
};

export type ObservationWordFileDropZoneResult = {
    group: HTMLElement;
    set_pending_filename: (file: File | null) => void;
    destroy: () => void;
};

function has_file_transfer(event: DragEvent): boolean {
    const transfer = event.dataTransfer;
    if (!transfer) return false;
    const types = Array.from(transfer.types || []);
    if (types.includes('Files') || types.includes('application/x-moz-file')) return true;
    return (transfer.files?.length ?? 0) > 0 || (transfer.items?.length ?? 0) > 0;
}

function bind_drag_drop_target(
    target: HTMLElement,
    options: {
        on_drag_active: (active: boolean) => void;
        on_drop_files: (files: File[]) => void;
    }
): () => void {
    const on_drag_enter = (event: DragEvent) => {
        if (!has_file_transfer(event)) return;
        event.preventDefault();
        options.on_drag_active(true);
    };
    const on_drag_leave = (event: DragEvent) => {
        if (!has_file_transfer(event)) return;
        event.preventDefault();
        const related = event.relatedTarget;
        if (related instanceof Node && target.contains(related)) return;
        options.on_drag_active(false);
    };
    const on_drag_over = (event: DragEvent) => {
        if (!has_file_transfer(event)) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const on_drop = (event: DragEvent) => {
        if (!has_file_transfer(event)) return;
        event.preventDefault();
        event.stopPropagation();
        options.on_drag_active(false);
        options.on_drop_files(files_from_drag_event(event));
    };

    target.addEventListener('dragenter', on_drag_enter);
    target.addEventListener('dragleave', on_drag_leave);
    target.addEventListener('dragover', on_drag_over);
    target.addEventListener('drop', on_drop);

    return () => {
        target.removeEventListener('dragenter', on_drag_enter);
        target.removeEventListener('dragleave', on_drag_leave);
        target.removeEventListener('dragover', on_drag_over);
        target.removeEventListener('drop', on_drop);
    };
}

function bind_paste_target(
    target: HTMLElement,
    options: { on_paste: (event: ClipboardEvent) => void }
): () => void {
    const on_paste = (event: ClipboardEvent) => {
        options.on_paste(event);
    };
    target.addEventListener('paste', on_paste);
    return () => {
        target.removeEventListener('paste', on_paste);
    };
}

function bind_modal_paste_capture(
    modal_root: HTMLElement,
    options: { on_paste: (event: ClipboardEvent) => void }
): () => void {
    const on_paste = (event: ClipboardEvent) => {
        if (!modal_root.isConnected) return;
        if (!should_handle_paste_event(event.target)) return;
        const dialog = modal_root.closest('dialog');
        if (dialog && event.target instanceof Node && !dialog.contains(event.target)) return;
        options.on_paste(event);
    };
    document.addEventListener('paste', on_paste, true);
    return () => {
        document.removeEventListener('paste', on_paste, true);
    };
}

function unique_elements(elements: Array<HTMLElement | null | undefined>): HTMLElement[] {
    const seen = new Set<HTMLElement>();
    const result: HTMLElement[] = [];
    for (const element of elements) {
        if (!element || seen.has(element)) continue;
        seen.add(element);
        result.push(element);
    }
    return result;
}

/**
 * Skapar filzon för en Word-fil (.docx).
 */
export function create_observation_word_file_drop_zone(
    options: ObservationWordFileDropZoneOptions
): ObservationWordFileDropZoneResult {
    const {
        helpers,
        t,
        input_id,
        on_file,
        on_status,
        additional_drop_targets = [],
        paste_modal_root = null,
    } = options;
    const label_text = t('observation_word_import_drop_label');

    const group = helpers.create_element('div', {
        class_name: ['form-group', 'observation-word-import-upload-group'],
    });

    const input = helpers.create_element('input', {
        class_name: ['audit-hidden-file-input', 'observation-word-import-hidden-file-input'],
        attributes: {
            type: 'file',
            id: input_id,
            accept: WORD_DOCX_ACCEPT,
            'aria-label': label_text,
            tabindex: '-1',
            'aria-hidden': 'true',
        },
    }) as HTMLInputElement;
    group.appendChild(input);

    const drop_zone = helpers.create_element('div', { class_name: 'observation-word-import-drop-zone' });
    drop_zone.appendChild(
        helpers.create_element('p', {
            class_name: 'observation-word-import-drop-zone__hint',
            text_content: t('observation_word_import_drop_hint'),
        })
    );

    const picker_row = helpers.create_element('div', { class_name: 'observation-word-import-file-picker-row' });
    const icon_svg = helpers.get_icon_svg ? helpers.get_icon_svg('upload_file', ['currentColor'], 16) : '';
    const pick_btn = helpers.create_element('button', {
        class_name: ['button', 'button-primary', 'audit-upload-btn', 'observation-word-import-choose-file-btn'],
        html_content: `<span>${t('observation_word_import_choose_file_button')}</span>${icon_svg}`,
        attributes: { type: 'button', 'aria-label': label_text },
    });
    pick_btn.addEventListener('click', () => input.click());
    picker_row.appendChild(pick_btn);

    const pending_el = helpers.create_element('p', {
        class_name: 'observation-word-import-pending-file',
        attributes: { 'aria-live': 'polite' },
    });
    pending_el.hidden = true;

    const set_pending_filename = (file: File | null) => {
        if (!file) {
            pending_el.hidden = true;
            pending_el.textContent = '';
            return;
        }
        pending_el.hidden = false;
        pending_el.textContent = t('observation_word_import_selected_file', {
            filename: String(file.name || '').trim(),
        });
    };

    const report_issue = (message: string, type: 'info' | 'error' | 'success' = 'error') => {
        on_status?.(message, type);
    };

    const handle_files = (raw_files: File[]) => {
        if (!raw_files.length) {
            report_issue(t('observation_word_import_drop_no_file'), 'error');
            return;
        }
        if (raw_files.length > 1) {
            report_issue(t('observation_word_import_drop_multiple_files'), 'error');
            return;
        }
        const file = raw_files[0];
        if (!pick_single_word_docx_file([file], WORD_IMPORT_MAX_BYTES)) {
            if (file.size > WORD_IMPORT_MAX_BYTES) {
                report_issue(t('observation_word_import_file_too_large'), 'error');
            } else {
                report_issue(t('observation_word_import_drop_invalid_file'), 'error');
            }
            return;
        }
        const accepted = pick_single_word_docx_file([file], WORD_IMPORT_MAX_BYTES);
        if (!accepted) return;
        set_pending_filename(accepted);
        on_file(accepted);
    };

    const handle_paste = (event: ClipboardEvent) => {
        if (event.defaultPrevented) return;

        const word_files = extract_word_files_from_clipboard_event(event);
        if (word_files.length > 0) {
            event.preventDefault();
            handle_files(word_files);
            return;
        }

        if (clipboard_event_has_non_word_files(event)) {
            event.preventDefault();
            handle_files(extract_all_files_from_clipboard_event(event));
            return;
        }

        if (clipboard_event_has_non_file_content(event)) {
            report_issue(t('observation_word_import_paste_no_file'), 'error');
        }
    };

    if (can_use_navigator_clipboard_read()) {
        const paste_btn = helpers.create_element('button', {
            class_name: ['button', 'button-default', 'observation-word-import-paste-btn'],
            text_content: t('observation_word_import_paste_button'),
            attributes: { type: 'button' },
        });
        paste_btn.addEventListener('click', async () => {
            try {
                const items = await navigator.clipboard.read();
                const pasted_files = await extract_word_files_from_navigator_clipboard(items);
                if (pasted_files.length === 0) {
                    report_issue(t('observation_word_import_paste_no_file'), 'error');
                    return;
                }
                handle_files(pasted_files);
            } catch (error) {
                if (error instanceof DOMException && error.name === 'NotAllowedError') {
                    report_issue(t('observation_word_import_paste_permission_denied'), 'error');
                    return;
                }
                report_issue(t('observation_word_import_paste_no_file'), 'error');
            }
        });
        picker_row.appendChild(paste_btn);
    }

    input.addEventListener('change', () => {
        const selected = input.files ? Array.from(input.files) : [];
        input.value = '';
        handle_files(selected);
    });

    const drop_bindings = {
        on_drag_active: (active: boolean) => {
            drop_zone.classList.toggle('observation-word-import-drop-zone--active', active);
            for (const extra_target of additional_drop_targets) {
                extra_target.classList.toggle('observation-word-import-drop-zone--active', active);
            }
        },
        on_drop_files: handle_files,
    };

    const destroy_callbacks: Array<() => void> = [];
    const drag_targets = unique_elements([drop_zone, ...additional_drop_targets]);
    for (const target of drag_targets) {
        destroy_callbacks.push(bind_drag_drop_target(target, drop_bindings));
    }

    if (paste_modal_root) {
        destroy_callbacks.push(bind_modal_paste_capture(paste_modal_root, { on_paste: handle_paste }));
    } else {
        const paste_targets = unique_elements([group, ...additional_drop_targets]);
        for (const target of paste_targets) {
            destroy_callbacks.push(bind_paste_target(target, { on_paste: handle_paste }));
        }
    }

    drop_zone.appendChild(picker_row);
    drop_zone.appendChild(pending_el);
    group.appendChild(drop_zone);

    return {
        group,
        set_pending_filename,
        destroy: () => {
            for (const destroy_callback of destroy_callbacks) {
                destroy_callback();
            }
        },
    };
}
