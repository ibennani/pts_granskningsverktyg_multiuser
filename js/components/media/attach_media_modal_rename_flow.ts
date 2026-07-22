/**
 * @fileoverview Kopplar inline-panel för omdöpning till modalen Bifoga media.
 */

import { create_attach_media_modal_rename_panel } from './attach_media_modal_rename_panel.js';
import type { AuditMediaServerIndex } from '../../logic/audit_media_server_index.js';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type HelpersLike = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    escape_html?: (value: string) => string;
};

type StatusType = 'info' | 'error' | 'success';

export type AttachMediaRenameFlowOptions = {
    t: TranslateFn;
    Helpers: HelpersLike;
    audit_id: string;
    modal_container: HTMLElement;
    heading_el: HTMLHeadingElement | null;
    modal_heading_text: string;
    message_el: HTMLElement | null;
    modal_message_text: string;
    list_mode_root: HTMLElement;
    get_elements_to_hide: () => HTMLElement[];
    get_working_filenames: () => string[];
    set_working_filenames: (filenames: string[]) => void;
    resolve_fetch_filename?: (filename: string) => string;
    server_index?: AuditMediaServerIndex | null;
    persist_media_changes: (close_after: boolean) => Promise<boolean>;
    show_status: (message: string, type?: StatusType, options?: { html?: boolean }) => void;
    clear_status?: () => void;
    refresh_list: () => void;
    get_preview_open: () => boolean;
    get_remove_confirm_open: () => boolean;
    on_rename_open_change: (is_open: boolean) => void;
};

export type AttachMediaRenameFlow = {
    request_rename_filename: (name: string, trigger: HTMLButtonElement) => void;
    destroy: () => void;
};

/**
 * Kopplar omdöpningspanel till filistan i modalen Bifoga media.
 */
export function create_attach_media_rename_flow(
    options: AttachMediaRenameFlowOptions
): AttachMediaRenameFlow {
    const {
        get_preview_open,
        get_remove_confirm_open,
        on_rename_open_change
    } = options;

    const rename_panel = create_attach_media_modal_rename_panel({
        ...options,
        on_open_change: on_rename_open_change
    });

    const request_rename_filename = (name: string, trigger: HTMLButtonElement) => {
        if (get_preview_open() || get_remove_confirm_open() || rename_panel.is_open()) {
            return;
        }
        rename_panel.open_rename_panel(name, trigger);
    };

    return {
        request_rename_filename,
        destroy: () => rename_panel.destroy()
    };
}
