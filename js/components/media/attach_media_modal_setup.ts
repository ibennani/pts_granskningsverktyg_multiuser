/**
 * @fileoverview Bygger innehållet i modalen Bifoga media.
 */

import { create_attach_media_file_drop_zone } from './attach_media_file_drop_zone.js';
import { get_audit_media_cached_blob_url } from './render_audit_media_list_item.js';
import { create_attach_media_in_modal_preview } from './attach_media_in_modal_preview.js';
import { create_attach_media_remove_flow } from './attach_media_modal_remove_flow.js';
import { create_attach_media_modal_persist, parse_attach_media_filenames_from_textarea } from './attach_media_modal_persist.js';
import type { AuditMediaObservationEditOptions } from './audit_media_preview_observation.js';
import { refresh_filename_list_container } from './attach_media_modal_list.js';
import { create_audit_media_server_index, find_server_media_filename_match } from '../../logic/audit_media_server_index.js';
import {
    partition_files_by_existing_filenames,
    build_attach_media_local_files_added_message
} from './attach_media_duplicate_filename_status.js';
import type { AttachMediaDuplicateScope } from './attach_media_duplicate_filename_status.js';
import { create_attach_media_status_handlers } from './attach_media_modal_status.js';
import { create_online_upload_section } from './attach_media_modal_online_upload.js';
import { build_save_button_html_content } from '../../ui/save_button_html.js';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type HelpersLike = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    init_auto_resize_for_textarea?: (el: HTMLTextAreaElement) => void;
    trim_textarea_preserve_lines?: (raw: string) => string;
    get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
    escape_html?: (value: string) => string;
    safe_set_inner_html?: (element: HTMLElement, html: string) => void;
};

export type AttachMediaModalScope = AttachMediaDuplicateScope;

export type AttachMediaModalOptions = {
    t: TranslateFn;
    Helpers: HelpersLike;
    audit_id?: string | null;
    initial_filenames: string[];
    textarea_id: string;
    intro_key?: string;
    media_scope?: AttachMediaModalScope;
    on_save: (filenames: string[]) => void | Promise<void>;
    trigger_element?: HTMLElement | null;
    on_status_message?: (message: string, type: 'info' | 'error' | 'success') => void;
    get_still_referenced_filenames_after_save?: (final_filenames_here: string[]) => Set<string>;
    observation_detail?: string | null;
    observation_edit?: AuditMediaObservationEditOptions | null;
    get_observation_detail?: () => string | null;
    get_observation_edit?: () => AuditMediaObservationEditOptions | null;
};

type AttachMediaModalHost = {
    close: (focus_element?: HTMLElement | null) => void;
    dialog_element_ref?: HTMLDialogElement | null;
    shell_container_ref?: HTMLElement | null;
    header_container_ref?: HTMLElement | null;
};

export type AttachMediaModalSetupContext = AttachMediaModalOptions & {
    can_upload: boolean;
    working_filenames: string[];
    persisted_filenames: Set<string>;
    persist_in_flight: boolean;
};

/**
 * Renderar modalinnehåll för bifoga media.
 */
export function setup_attach_media_modal_content(
    container: HTMLElement,
    modal: AttachMediaModalHost,
    ctx: AttachMediaModalSetupContext
): void {
    const {
        t,
        Helpers,
        audit_id,
        textarea_id,
        on_save,
        trigger_element,
        on_status_message,
        get_still_referenced_filenames_after_save,
        get_observation_detail,
        get_observation_edit,
        can_upload,
        media_scope = 'requirement'
    } = ctx;

    const escape_html = (value: string): string =>
        typeof Helpers.escape_html === 'function' ? Helpers.escape_html(value) : value;

    let working_filenames = ctx.working_filenames;
    let persisted_filenames = ctx.persisted_filenames;
    let persist_in_flight = ctx.persist_in_flight;
    const server_index = audit_id && can_upload ? create_audit_media_server_index(audit_id) : null;

    container.classList.add('modal-body--attach-media');
    const shell_el = modal.shell_container_ref
        ?? (container.closest('.modal-content') as HTMLElement | null)
        ?? container;
    shell_el.classList.add('modal-content--attach-media');
    const dialog_el = modal.dialog_element_ref;
    const header_el = modal.header_container_ref
        ?? (shell_el.querySelector('.modal-header') as HTMLElement | null);
    const heading_el = (header_el?.querySelector('#modal-dialog-title') ?? shell_el.querySelector('#modal-dialog-title')) as HTMLHeadingElement | null;
    const message_el = (header_el?.querySelector('.modal-message') ?? shell_el.querySelector('.modal-message')) as HTMLElement | null;
    const modal_heading_text = t('attach_media_modal_h1');
    const modal_message_text = message_el?.textContent ?? '';

    let destroy_file_drop_zone = () => {};
    let destroy_online_upload = () => {};
    let in_modal_preview_destroy = () => {};
    let in_modal_remove_confirm_destroy = () => {};
    let preview_open = false;
    let remove_confirm_open = false;
    let request_remove_filename: (
        name: string,
        removed_index: number,
        trigger: HTMLButtonElement
    ) => void = () => {};
    const get_drop_enabled = () => !preview_open && !remove_confirm_open;

    dialog_el?.addEventListener('close', () => {
        destroy_file_drop_zone();
        destroy_online_upload();
        in_modal_preview_destroy();
        in_modal_remove_confirm_destroy();
    }, { once: true });

    const list_mode_root = Helpers.create_element('div', {
        class_name: 'attach-media-list-mode'
    });
    container.appendChild(list_mode_root);

    let in_modal_preview: ReturnType<typeof create_attach_media_in_modal_preview> | null = null;
    if (audit_id && heading_el && message_el) {
        in_modal_preview = create_attach_media_in_modal_preview({
            t,
            Helpers,
            audit_id,
            dialog_el,
            modal_container: container,
            heading_el,
            message_el,
            list_mode_root,
            modal_heading_text,
            modal_message_text,
            get_observation_detail,
            get_observation_edit,
            on_preview_open_change: (is_open) => {
                preview_open = is_open;
            }
        });
        in_modal_preview_destroy = () => in_modal_preview?.destroy();
    }

    const { status_el, show_status, show_duplicate_filenames_error } = create_attach_media_status_handlers({
        t,
        Helpers,
        media_scope,
        on_status_message
    });
    if (heading_el) {
        heading_el.insertAdjacentElement('afterend', status_el);
    } else if (header_el) {
        header_el.appendChild(status_el);
    } else {
        list_mode_root.appendChild(status_el);
    }

    const list_container = Helpers.create_element('div', { class_name: 'attach-media-list-container' });
    const list_heading = Helpers.create_element('h2', {
        class_name: 'attach-media-list-heading',
        text_content: t('attach_media_attached_files_heading')
    });

    let close_focus_el: HTMLElement | null = null;

    const resolve_fetch_filename = (filename: string): string => {
        if (!server_index) return filename;
        return find_server_media_filename_match(filename, server_index.get_server_filenames()) ?? filename;
    };

    const handle_image_click = (filename: string, trigger: HTMLButtonElement) => {
        if (!in_modal_preview || !audit_id || remove_confirm_open) return;
        const fetch_name = resolve_fetch_filename(filename);
        in_modal_preview.open_preview(
            filename,
            get_audit_media_cached_blob_url(audit_id, filename)
                || get_audit_media_cached_blob_url(audit_id, fetch_name)
                || null,
            trigger
        );
    };

    const refresh_list = () => {
        refresh_filename_list_container(
            list_container,
            Helpers,
            t,
            audit_id,
            working_filenames,
            request_remove_filename,
            in_modal_preview ? handle_image_click : undefined,
            undefined,
            resolve_fetch_filename
        );
    };

    const persist_media_changes = create_attach_media_modal_persist({
        t,
        Helpers,
        audit_id,
        can_upload,
        textarea_id,
        container,
        modal,
        trigger_element,
        close_focus_el,
        on_save,
        get_still_referenced_filenames_after_save,
        show_status,
        refresh_list,
        get_working_filenames: () => working_filenames,
        set_working_filenames: (filenames) => {
            working_filenames = filenames;
        },
        get_persisted_filenames: () => persisted_filenames,
        set_persisted_filenames: (filenames) => {
            persisted_filenames = filenames;
        },
        get_persist_in_flight: () => persist_in_flight,
        set_persist_in_flight: (value) => {
            persist_in_flight = value;
        },
        server_index
    });

    if (heading_el && message_el) {
        const remove_flow = create_attach_media_remove_flow({
            t,
            Helpers,
            audit_id,
            modal_container: container,
            list_container,
            heading_el,
            message_el,
            list_mode_root,
            modal_heading_text,
            modal_message_text,
            get_working_filenames: () => working_filenames,
            set_working_filenames: (filenames) => {
                working_filenames = filenames;
            },
            get_preview_open: () => preview_open,
            handle_image_click: in_modal_preview ? handle_image_click : undefined,
            resolve_fetch_filename,
            persist_media_changes,
            show_status,
            on_remove_confirm_open_change: (is_open) => {
                remove_confirm_open = is_open;
            }
        });
        request_remove_filename = remove_flow.request_remove_filename;
        in_modal_remove_confirm_destroy = () => remove_flow.destroy();
    }

    const append_file_list_section = () => {
        if (!list_heading.isConnected) {
            list_mode_root.appendChild(list_heading);
        }
        if (!list_container.isConnected) {
            list_mode_root.appendChild(list_container);
        }
        refresh_list();
    };

    const add_filename_if_missing = (name: string): boolean => {
        const trimmed = String(name || '').trim();
        if (!trimmed) return false;
        if (working_filenames.includes(trimmed)) {
            show_duplicate_filenames_error([trimmed]);
            return false;
        }
        working_filenames = [...working_filenames, trimmed];
        return true;
    };

    const handle_local_file_selection = (file: File) => {
        const local_name = String(file.name || '').trim();
        if (!local_name) {
            show_status(t('attach_media_upload_failed'), 'error');
            return;
        }
        if (!add_filename_if_missing(local_name)) return;
        refresh_list();
        return local_name;
    };

    if (can_upload && audit_id) {
        const online_upload = create_online_upload_section({
            t,
            Helpers,
            audit_id,
            textarea_id,
            container,
            heading_el,
            media_scope,
            escape_html,
            get_working_filenames: () => working_filenames,
            set_working_filenames: (filenames) => {
                working_filenames = filenames;
            },
            refresh_list,
            show_status,
            show_duplicate_filenames_error,
            persist_changes: () => persist_media_changes(false),
            get_drop_enabled,
            get_still_referenced_filenames_after_save,
            server_index
        });
        destroy_online_upload = () => online_upload.destroy();
        list_mode_root.appendChild(online_upload.mount_element);
    } else if (!can_upload) {
        list_mode_root.appendChild(
            Helpers.create_element('p', {
                class_name: 'attach-media-offline-hint',
                text_content: t('attach_media_manual_only_hint')
            })
        );

        const local_label_id = `${textarea_id}-local-upload-label`;
        const { group: local_group, destroy } = create_attach_media_file_drop_zone({
            helpers: Helpers,
            t,
            input_id: `${textarea_id}-local-file-input`,
            label_id: local_label_id,
            label_key: 'attach_media_choose_file_local_label',
            on_files: (files) => {
                const { new_files, duplicate_names } = partition_files_by_existing_filenames(
                    files,
                    working_filenames
                );
                if (duplicate_names.length > 0) {
                    show_duplicate_filenames_error(duplicate_names);
                }
                const added_names: string[] = [];
                new_files.forEach((file) => {
                    const added_name = handle_local_file_selection(file);
                    if (added_name) {
                        added_names.push(added_name);
                    }
                });
                if (added_names.length > 0) {
                    const message = build_attach_media_local_files_added_message(
                        t,
                        escape_html,
                        added_names.length,
                        added_names[0]
                    );
                    show_status(message, 'success', { html: added_names.length === 1 });
                    void persist_media_changes(false);
                }
            },
            on_status: show_status,
            additional_drop_targets: [container],
            accept_drop_on_viewport: true,
            get_drop_enabled
        });
        destroy_file_drop_zone = destroy;
        list_mode_root.appendChild(local_group);

        const form_group = Helpers.create_element('div', { class_name: 'form-group' });
        const label = Helpers.create_element('label', {
            attributes: { for: textarea_id },
            text_content: t('attach_media_modal_filename_label')
        });
        form_group.appendChild(label);
        const textarea = Helpers.create_element('textarea', {
            id: textarea_id,
            class_name: 'form-control',
            attributes: { rows: '3' }
        }) as HTMLTextAreaElement;
        textarea.value = working_filenames.join('\n');
        if (Helpers.init_auto_resize_for_textarea) {
            Helpers.init_auto_resize_for_textarea(textarea);
        }
        form_group.appendChild(textarea);
        list_mode_root.appendChild(form_group);

        textarea.addEventListener('input', () => {
            working_filenames = parse_attach_media_filenames_from_textarea(textarea, Helpers);
            refresh_list();
        });
    }

    append_file_list_section();

    if (server_index) {
        void server_index.load().then(() => {
            refresh_list();
        });
    }

    const actions_wrapper = Helpers.create_element('div', { class_name: 'modal-attach-media-actions' });
    const save_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-primary'],
        attributes: { type: 'button' },
        html_content: build_save_button_html_content(t('attach_media_modal_save'))
    }) as HTMLButtonElement;
    close_focus_el = save_btn;
    save_btn.addEventListener('click', () => {
        void persist_media_changes(true);
    });

    const discard_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-default'],
        attributes: { type: 'button' },
        text_content: t('attach_media_modal_discard')
    });
    discard_btn.addEventListener('click', () => {
        modal.close(trigger_element || discard_btn);
    });

    actions_wrapper.appendChild(save_btn);
    actions_wrapper.appendChild(discard_btn);
    list_mode_root.appendChild(actions_wrapper);

    if (in_modal_preview) {
        requestAnimationFrame(() => {
            in_modal_preview?.remember_list_dialog_size();
        });
    }
}
