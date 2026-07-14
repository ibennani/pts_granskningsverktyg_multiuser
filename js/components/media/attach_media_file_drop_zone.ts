/**
 * @fileoverview Filväljare med dold input, synlig knapp och drag-och-släpp för media-modalen.
 */

import {
    MEDIA_MAX_UPLOAD_BYTES,
    format_media_max_upload_size_label
} from '../../../shared/constants/media_upload_limits.js';
import {
    build_media_file_input_accept_attribute,
    format_allowed_media_types_label,
    is_allowed_client_media_file
} from '../../../shared/media/client_media_validation.js';
import {
    can_use_navigator_clipboard_read,
    clipboard_event_has_non_file_content,
    clipboard_event_has_non_image_files,
    extract_all_files_from_clipboard_event,
    extract_image_files_from_clipboard_event,
    extract_image_files_from_navigator_clipboard,
    should_handle_paste_event
} from '../../../shared/media/clipboard_media_files.js';
import '../../../css/components/attach_media_modal.css';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type HelpersLike = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
};

export type AttachMediaFileDropZoneOptions = {
    helpers: HelpersLike;
    t: TranslateFn;
    input_id: string;
    label_id: string;
    label_key: string;
    on_files: (files: File[]) => void;
    on_status?: (message: string, type?: 'info' | 'error' | 'success') => void;
    max_file_bytes?: number;
    /** Extra element som får visuell markering vid drag (t.ex. modalinnehåll). */
    additional_drop_targets?: HTMLElement[];
    /** Acceptera släpp var som helst i viewport; visuell feedback oförändrad. */
    accept_drop_on_viewport?: boolean;
    /** Returnerar false när släpp tillfälligt ska ignoreras (t.ex. in-modal-förhandsvisning). */
    get_drop_enabled?: () => boolean;
};

export type AttachMediaFileDropZoneResult = {
    group: HTMLElement;
    input: HTMLInputElement;
    set_pending_filenames: (files: File[]) => void;
    destroy: () => void;
};

/**
 * Kontrollerar om en fil är tillåten enligt serverns vitlista.
 */
export function is_acceptable_media_file(file: File): boolean {
    return is_allowed_client_media_file(file);
}

/**
 * Filtrerar bort ogiltiga eller för stora filer ur en filsamling.
 */
export function filter_acceptable_media_files(
    files: Iterable<File> | null | undefined,
    max_file_bytes?: number
): File[] {
    if (!files) return [];
    const accepted: File[] = [];
    for (const file of files) {
        if (!is_acceptable_media_file(file)) continue;
        if (typeof max_file_bytes === 'number' && file.size > max_file_bytes) continue;
        if (!String(file.name || '').trim()) continue;
        accepted.push(file);
    }
    return accepted;
}

function has_file_transfer(event: DragEvent): boolean {
    const transfer = event.dataTransfer;
    if (!transfer) return false;
    const types = Array.from(transfer.types || []);
    if (types.includes('Files') || types.includes('application/x-moz-file')) {
        return true;
    }
    return (transfer.files?.length ?? 0) > 0;
}

function bind_drag_drop_target(
    target: HTMLElement,
    options: {
        on_drag_active: (active: boolean) => void;
        on_drop_files: (files: File[]) => void;
    }
): void {
    target.addEventListener('dragenter', (event) => {
        if (!has_file_transfer(event)) return;
        event.preventDefault();
        options.on_drag_active(true);
    });
    target.addEventListener('dragleave', (event) => {
        if (!has_file_transfer(event)) return;
        event.preventDefault();
        const related = event.relatedTarget;
        if (related instanceof Node && target.contains(related)) return;
        options.on_drag_active(false);
    });
    target.addEventListener('dragover', (event) => {
        if (!has_file_transfer(event)) return;
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
    });
    target.addEventListener('drop', (event) => {
        if (!has_file_transfer(event)) return;
        event.preventDefault();
        event.stopPropagation();
        options.on_drag_active(false);
        const dropped = event.dataTransfer?.files;
        options.on_drop_files(dropped ? Array.from(dropped) : []);
    });
}

function bind_viewport_file_drop(
    options: {
        on_drag_active: (active: boolean) => void;
        on_drop_files: (files: File[]) => void;
    }
): () => void {
    let drag_depth = 0;
    const capture_opts: AddEventListenerOptions = { capture: true };

    const on_drag_enter = (event: DragEvent) => {
        if (!has_file_transfer(event)) return;
        event.preventDefault();
        drag_depth += 1;
        if (drag_depth === 1) {
            options.on_drag_active(true);
        }
    };

    const on_drag_leave = (event: DragEvent) => {
        if (!has_file_transfer(event)) return;
        event.preventDefault();
        drag_depth -= 1;
        if (drag_depth <= 0) {
            drag_depth = 0;
            options.on_drag_active(false);
        }
    };

    const on_drag_over = (event: DragEvent) => {
        if (!has_file_transfer(event)) return;
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
    };

    const on_drop = (event: DragEvent) => {
        if (!has_file_transfer(event)) return;
        event.preventDefault();
        event.stopPropagation();
        drag_depth = 0;
        options.on_drag_active(false);
        const dropped = event.dataTransfer?.files;
        options.on_drop_files(dropped ? Array.from(dropped) : []);
    };

    window.addEventListener('dragenter', on_drag_enter, capture_opts);
    window.addEventListener('dragleave', on_drag_leave, capture_opts);
    window.addEventListener('dragover', on_drag_over, capture_opts);
    window.addEventListener('drop', on_drop, capture_opts);

    return () => {
        window.removeEventListener('dragenter', on_drag_enter, capture_opts);
        window.removeEventListener('dragleave', on_drag_leave, capture_opts);
        window.removeEventListener('dragover', on_drag_over, capture_opts);
        window.removeEventListener('drop', on_drop, capture_opts);
        drag_depth = 0;
        options.on_drag_active(false);
    };
}

function bind_paste_target(
    target: HTMLElement,
    options: {
        on_paste: (event: ClipboardEvent) => void;
    }
): () => void {
    const on_paste = (event: ClipboardEvent) => {
        options.on_paste(event);
    };
    target.addEventListener('paste', on_paste);
    return () => {
        target.removeEventListener('paste', on_paste);
    };
}

/**
 * Skapar uppladdningsgrupp med drag-och-släpp, dold filinput och synlig knapp.
 */
export function create_attach_media_file_drop_zone(
    options: AttachMediaFileDropZoneOptions
): AttachMediaFileDropZoneResult {
    const {
        helpers,
        t,
        input_id,
        label_id,
        label_key,
        on_files,
        on_status,
        max_file_bytes,
        additional_drop_targets = [],
        accept_drop_on_viewport = false,
        get_drop_enabled
    } = options;
    const is_drop_enabled = () => get_drop_enabled?.() !== false;
    const label_text = t(label_key);

    const group = helpers.create_element('div', { class_name: 'form-group attach-media-upload-group' });
    group.appendChild(
        helpers.create_element('p', {
            id: label_id,
            class_name: 'attach-media-upload-label',
            text_content: label_text,
            attributes: { 'aria-hidden': 'true' }
        })
    );

    const input = helpers.create_element('input', {
        class_name: ['audit-hidden-file-input', 'attach-media-hidden-file-input'],
        attributes: {
            type: 'file',
            id: input_id,
            accept: build_media_file_input_accept_attribute(),
            multiple: 'multiple',
            'aria-label': label_text,
            tabindex: '-1',
            'aria-hidden': 'true'
        }
    }) as HTMLInputElement;
    group.appendChild(input);

    const drop_zone = helpers.create_element('div', { class_name: 'attach-media-drop-zone' });
    drop_zone.appendChild(
        helpers.create_element('p', {
            class_name: 'attach-media-drop-zone__hint',
            text_content: t('attach_media_drop_zone_hint'),
            attributes: { 'aria-hidden': 'true' }
        })
    );

    const picker_row = helpers.create_element('div', { class_name: 'attach-media-file-picker-row' });
    const icon_svg = helpers.get_icon_svg ? helpers.get_icon_svg('upload_file', ['currentColor'], 16) : '';
    const pick_btn = helpers.create_element('button', {
        class_name: ['button', 'button-primary', 'audit-upload-btn', 'attach-media-choose-file-btn'],
        html_content: `<span>${t('attach_media_choose_file_button')}</span>${icon_svg}`,
        attributes: { type: 'button', 'aria-label': label_text }
    });
    pick_btn.addEventListener('click', () => input.click());
    picker_row.appendChild(pick_btn);

    drop_zone.appendChild(picker_row);

    const pending_el = helpers.create_element('p', {
        class_name: 'attach-media-pending-file',
        attributes: { 'aria-hidden': 'true' }
    });
    pending_el.hidden = true;
    drop_zone.appendChild(pending_el);

    const set_pending_filenames = (files: File[]) => {
        if (files.length === 0) {
            pending_el.hidden = true;
            pending_el.textContent = '';
            return;
        }
        pending_el.hidden = false;
        if (files.length === 1) {
            pending_el.textContent = t('attach_media_selected_file_pending', {
                filename: String(files[0]?.name || '').trim()
            });
            return;
        }
        pending_el.textContent = t('attach_media_selected_files_pending', { count: files.length });
    };

    const set_drop_active = (active: boolean) => {
        if (!is_drop_enabled()) {
            active = false;
        }
        drop_zone.classList.toggle('attach-media-drop-zone--active', active);
        for (const extra_target of additional_drop_targets) {
            extra_target.classList.toggle('attach-media-drop-zone--active', active);
        }
    };

    const report_issue = (message: string, type: 'info' | 'error' | 'success' = 'error') => {
        on_status?.(message, type);
    };

    const handle_files = (raw_files: File[]) => {
        if (!is_drop_enabled()) return;
        if (!raw_files.length) {
            report_issue(t('attach_media_drop_no_file'), 'error');
            return;
        }

        const accepted = filter_acceptable_media_files(raw_files, max_file_bytes);
        const rejected_type_count = raw_files.filter((file) => !is_acceptable_media_file(file)).length;
        const rejected_size_count = raw_files.filter(
            (file) =>
                is_acceptable_media_file(file)
                && typeof max_file_bytes === 'number'
                && file.size > max_file_bytes
        ).length;

        if (rejected_type_count > 0) {
            report_issue(
                t('attach_media_drop_invalid_file', {
                    allowed_types: format_allowed_media_types_label()
                }),
                'error'
            );
        } else if (rejected_size_count > 0) {
            report_issue(
                t('attach_media_file_too_large', { max_size: format_media_max_upload_size_label() }),
                'error'
            );
        }

        if (accepted.length === 0) return;

        set_pending_filenames(accepted);
        on_files(accepted);
    };

    if (can_use_navigator_clipboard_read()) {
        const paste_btn = helpers.create_element('button', {
            class_name: ['button', 'button-default', 'attach-media-paste-image-btn'],
            text_content: t('attach_media_paste_image_button'),
            attributes: { type: 'button' }
        });
        paste_btn.addEventListener('click', async () => {
            if (!is_drop_enabled()) return;
            try {
                const items = await navigator.clipboard.read();
                const pasted_files = await extract_image_files_from_navigator_clipboard(items);
                if (pasted_files.length === 0) {
                    report_issue(t('attach_media_paste_no_image'), 'error');
                    return;
                }
                handle_files(pasted_files);
            } catch (error) {
                if (error instanceof DOMException && error.name === 'NotAllowedError') {
                    report_issue(t('attach_media_paste_permission_denied'), 'error');
                    return;
                }
                report_issue(t('attach_media_paste_no_image'), 'error');
            }
        });
        picker_row.appendChild(paste_btn);
    }

    const handle_paste = (event: ClipboardEvent) => {
        if (!is_drop_enabled()) return;
        if (!should_handle_paste_event(event.target)) return;

        const image_files = extract_image_files_from_clipboard_event(event);
        if (image_files.length > 0) {
            event.preventDefault();
            handle_files(image_files);
            return;
        }

        if (clipboard_event_has_non_image_files(event)) {
            event.preventDefault();
            handle_files(extract_all_files_from_clipboard_event(event));
            return;
        }

        if (clipboard_event_has_non_file_content(event)) {
            report_issue(t('attach_media_paste_no_image'), 'error');
        }
    };

    input.addEventListener('change', () => {
        const selected = input.files ? Array.from(input.files) : [];
        input.value = '';
        handle_files(selected);
    });

    const drop_bindings = {
        on_drag_active: (active: boolean) => {
            if (!is_drop_enabled()) return;
            set_drop_active(active);
        },
        on_drop_files: (files: File[]) => {
            if (!is_drop_enabled()) return;
            handle_files(files);
        }
    };

    const destroy_callbacks: Array<() => void> = [];
    if (accept_drop_on_viewport) {
        destroy_callbacks.push(bind_viewport_file_drop(drop_bindings));
    } else {
        bind_drag_drop_target(drop_zone, drop_bindings);
        for (const extra_target of additional_drop_targets) {
            if (extra_target && extra_target !== drop_zone) {
                bind_drag_drop_target(extra_target, drop_bindings);
            }
        }
    }

    destroy_callbacks.push(bind_paste_target(group, { on_paste: handle_paste }));
    for (const extra_target of additional_drop_targets) {
        if (extra_target && extra_target !== group) {
            destroy_callbacks.push(bind_paste_target(extra_target, { on_paste: handle_paste }));
        }
    }

    group.appendChild(drop_zone);
    return {
        group,
        input,
        set_pending_filenames,
        destroy: () => {
            for (const destroy_callback of destroy_callbacks) {
                destroy_callback();
            }
        }
    };
}
