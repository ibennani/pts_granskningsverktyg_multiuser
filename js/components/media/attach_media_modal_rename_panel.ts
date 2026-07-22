/**
 * @fileoverview Inline-panel för omdöpning av mediefiler i modalen Bifoga media.
 */

import { rename_audit_media } from '../../api/audit_media_api.js';
import { find_server_media_filename_match } from '../../logic/audit_media_server_index.js';
import type { AuditMediaServerIndex } from '../../logic/audit_media_server_index.js';
import { move_audit_media_local_preview_blob_url } from './render_audit_media_list_item.js';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type HelpersLike = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    escape_html?: (value: string) => string;
};

type StatusType = 'info' | 'error' | 'success';

export type AttachMediaRenamePanelOptions = {
    t: TranslateFn;
    Helpers: HelpersLike;
    audit_id: string;
    list_mode_root: HTMLElement;
    get_elements_to_hide: () => HTMLElement[];
    get_working_filenames: () => string[];
    set_working_filenames: (filenames: string[]) => void;
    resolve_fetch_filename?: (filename: string) => string;
    server_index?: AuditMediaServerIndex | null;
    persist_media_changes: (close_after: boolean) => Promise<boolean>;
    show_status: (message: string, type?: StatusType, options?: { html?: boolean }) => void;
    refresh_list: () => void;
    on_open_change: (is_open: boolean) => void;
};

export type AttachMediaRenamePanel = {
    open_rename_panel: (filename: string, trigger: HTMLButtonElement) => void;
    is_open: () => boolean;
    destroy: () => void;
};

function build_renamed_conflict_message(
    t: TranslateFn,
    escape_html: (value: string) => string,
    requested_filename: string,
    actual_filename: string
): string {
    const before = t('attach_media_rename_renamed_conflict_before');
    const after = t('attach_media_rename_renamed_conflict_after');
    return `${before}<strong>${escape_html(requested_filename)}</strong>${after}<strong>${escape_html(actual_filename)}</strong>.`;
}

function replace_filename_in_list(filenames: string[], from_name: string, to_name: string): string[] {
    return filenames.map((name) => (name === from_name ? to_name : name));
}

/**
 * Skapar inline-panel för omdöpning inuti list_mode_root (modalens h1 förblir oförändrad).
 */
export function create_attach_media_modal_rename_panel(
    options: AttachMediaRenamePanelOptions
): AttachMediaRenamePanel {
    const {
        t,
        Helpers,
        audit_id,
        list_mode_root,
        get_elements_to_hide,
        get_working_filenames,
        set_working_filenames,
        resolve_fetch_filename,
        server_index,
        persist_media_changes,
        show_status,
        refresh_list,
        on_open_change
    } = options;

    const escape_html =
        typeof Helpers.escape_html === 'function' ? Helpers.escape_html.bind(Helpers) : (value: string) => value;

    let rename_panel_el: HTMLElement | null = null;
    let rename_open = false;
    let current_filename = '';
    let save_in_flight = false;
    let input_el: HTMLInputElement | null = null;

    const set_hidden_elements = (hidden: boolean) => {
        get_elements_to_hide().forEach((element) => {
            element.hidden = hidden;
        });
    };

    const close_rename_panel = (focus_element?: HTMLElement | null) => {
        if (!rename_open) {
            return;
        }
        rename_panel_el?.remove();
        rename_panel_el = null;
        input_el = null;
        current_filename = '';
        rename_open = false;
        save_in_flight = false;
        set_hidden_elements(false);
        on_open_change(false);
        if (focus_element && document.contains(focus_element)) {
            focus_element.focus();
        }
    };

    const handle_save = async (keep_focus_on_error = true) => {
        if (save_in_flight || !input_el || !current_filename) {
            return;
        }

        const new_name_raw = String(input_el.value || '').trim();
        if (!new_name_raw) {
            show_status(t('attach_media_rename_empty_name'), 'error');
            if (keep_focus_on_error) {
                input_el.focus();
            }
            return;
        }

        if (new_name_raw === current_filename) {
            close_rename_panel(input_el);
            return;
        }

        const working = get_working_filenames();
        if (working.includes(new_name_raw) && new_name_raw !== current_filename) {
            show_status(t('attach_media_file_already_in_list'), 'error');
            input_el.focus();
            return;
        }

        const server_filenames = server_index?.get_server_filenames() ?? null;
        const server_from =
            find_server_media_filename_match(current_filename, server_filenames)
            ?? resolve_fetch_filename?.(current_filename)
            ?? current_filename;

        if (server_filenames && !find_server_media_filename_match(server_from, server_filenames)) {
            show_status(t('attach_media_rename_not_on_server', { filename: current_filename }), 'error');
            return;
        }

        save_in_flight = true;
        try {
            const result = await rename_audit_media(audit_id, server_from, new_name_raw);
            const next_name = String(result.filename || '').trim();
            if (!next_name) {
                throw new Error(t('attach_media_rename_failed', { details: '' }));
            }

            set_working_filenames(replace_filename_in_list(working, current_filename, next_name));
            move_audit_media_local_preview_blob_url(audit_id, current_filename, next_name);
            server_index?.mark_renamed_on_server(server_from, next_name);

            refresh_list();
            await persist_media_changes(false);

            if (result.renamedDueToConflict && result.requestedFilename) {
                const message = build_renamed_conflict_message(
                    t,
                    escape_html,
                    result.requestedFilename,
                    next_name
                );
                show_status(message, 'info', { html: true });
            } else {
                show_status(t('attach_media_rename_success', { filename: next_name }), 'success');
            }

            close_rename_panel();
        } catch (err) {
            const details = err instanceof Error ? err.message : String(err);
            show_status(t('attach_media_rename_failed', { details }), 'error');
            input_el?.focus();
        } finally {
            save_in_flight = false;
        }
    };

    const open_rename_panel = (filename: string, trigger: HTMLButtonElement) => {
        if (rename_open) {
            return;
        }

        current_filename = filename;
        set_hidden_elements(true);

        const panel = Helpers.create_element('div', {
            class_name: 'attach-media-rename-panel'
        });
        panel.appendChild(
            Helpers.create_element('h2', {
                class_name: 'attach-media-rename-panel__heading',
                text_content: t('attach_media_rename_panel_heading')
            })
        );
        panel.appendChild(
            Helpers.create_element('p', {
                class_name: 'attach-media-rename-panel__intro',
                text_content: t('attach_media_rename_panel_intro')
            })
        );

        const form_group = Helpers.create_element('div', { class_name: 'form-group' });
        const input_id = `attach-media-rename-input-${Date.now()}`;
        form_group.appendChild(
            Helpers.create_element('label', {
                attributes: { for: input_id },
                text_content: t('attach_media_rename_panel_label')
            })
        );
        input_el = Helpers.create_element('input', {
            id: input_id,
            class_name: 'form-control',
            attributes: { type: 'text', value: filename }
        }) as HTMLInputElement;
        form_group.appendChild(input_el);
        panel.appendChild(form_group);

        const actions = Helpers.create_element('div', {
            class_name: 'attach-media-rename-panel__actions'
        });
        const save_btn = Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'button' },
            text_content: t('attach_media_rename_save')
        }) as HTMLButtonElement;
        save_btn.addEventListener('click', () => {
            void handle_save();
        });

        const keep_btn = Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: { type: 'button' },
            text_content: t('attach_media_rename_keep')
        }) as HTMLButtonElement;
        keep_btn.addEventListener('click', () => {
            close_rename_panel(trigger);
        });

        actions.appendChild(save_btn);
        actions.appendChild(keep_btn);
        panel.appendChild(actions);

        input_el.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                void handle_save();
            }
        });

        list_mode_root.appendChild(panel);
        rename_panel_el = panel;
        rename_open = true;
        on_open_change(true);
        input_el.focus();
        input_el.select();
    };

    return {
        open_rename_panel,
        is_open: () => rename_open,
        destroy: () => {
            close_rename_panel();
        }
    };
}
