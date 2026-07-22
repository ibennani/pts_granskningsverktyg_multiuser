/**
 * @fileoverview Borttagningsflöde med bekräftelse i modalen Bifoga media.
 */

import { refresh_filename_list_container } from './attach_media_modal_list.js';
import { resolve_focus_after_removed_item } from './attach_media_modal_list_focus.js';
import { create_attach_media_in_modal_remove_confirm } from './attach_media_in_modal_remove_confirm.js';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type HelpersLike = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
};

type AttachMediaRemoveFlowOptions = {
    t: TranslateFn;
    Helpers: HelpersLike;
    audit_id?: string | null;
    modal_container: HTMLElement;
    list_container: HTMLElement;
    heading_el: HTMLHeadingElement;
    message_el: HTMLElement;
    list_mode_root: HTMLElement;
    modal_heading_text: string;
    modal_message_text: string;
    get_working_filenames: () => string[];
    set_working_filenames: (filenames: string[]) => void;
    get_preview_open: () => boolean;
    get_rename_open?: () => boolean;
    handle_image_click?: (filename: string, trigger: HTMLButtonElement) => void;
    resolve_fetch_filename?: (filename: string) => string;
    on_rename?: (filename: string, trigger: HTMLButtonElement) => void;
    persist_media_changes: (close_after: boolean) => Promise<boolean>;
    show_status: (message: string, type: 'info' | 'error' | 'success') => void;
    on_remove_confirm_open_change: (is_open: boolean) => void;
};

export type AttachMediaRemoveFlow = {
    request_remove_filename: (
        name: string,
        removed_index: number,
        trigger: HTMLButtonElement
    ) => void;
    destroy: () => void;
};

/**
 * Kopplar borttagningsbekräftelse till filistan i modalen Bifoga media.
 */
export function create_attach_media_remove_flow(
    options: AttachMediaRemoveFlowOptions
): AttachMediaRemoveFlow {
    const {
        t,
        Helpers,
        audit_id,
        modal_container,
        list_container,
        heading_el,
        message_el,
        list_mode_root,
        modal_heading_text,
        modal_message_text,
        get_working_filenames,
        set_working_filenames,
        get_preview_open,
        get_rename_open,
        handle_image_click,
        resolve_fetch_filename,
        on_rename,
        persist_media_changes,
        show_status,
        on_remove_confirm_open_change
    } = options;

    const remove_confirm = create_attach_media_in_modal_remove_confirm({
        t,
        Helpers,
        modal_container,
        heading_el,
        message_el,
        list_mode_root,
        modal_heading_text,
        modal_message_text,
        on_open_change: on_remove_confirm_open_change,
        on_prepare_confirm_remove: (name, removed_index) => {
            set_working_filenames(get_working_filenames().filter((fn) => fn !== name));
            refresh_filename_list_container(
                list_container,
                Helpers,
                t,
                audit_id,
                get_working_filenames(),
                request_remove_filename,
                handle_image_click,
                undefined,
                resolve_fetch_filename,
                on_rename
            );
            return resolve_focus_after_removed_item(
                list_container,
                modal_container,
                removed_index
            );
        },
        on_after_confirm_remove: (name) => {
            show_status(t('attach_media_remove_success', { filename: name }), 'success');
            void persist_media_changes(false);
        }
    });

    function request_remove_filename(
        name: string,
        removed_index: number,
        trigger: HTMLButtonElement
    ) {
        if (get_preview_open() || get_rename_open?.()) return;
        remove_confirm.open_remove_confirm(name, removed_index, trigger);
    }

    return {
        request_remove_filename,
        destroy: () => remove_confirm.destroy()
    };
}
