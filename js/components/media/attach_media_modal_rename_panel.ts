/**
 * @fileoverview Inline-panel för omdöpning av mediefiler i modalen Bifoga media.
 */

import { rename_audit_media } from '../../api/audit_media_api.js';
import { find_server_media_filename_match } from '../../logic/audit_media_server_index.js';
import type { AuditMediaServerIndex } from '../../logic/audit_media_server_index.js';
import {
    prepare_media_rename_filename_input,
    resolve_media_rename_filename
} from '../../../shared/media/resolve_media_rename_filename.js';
import { move_audit_media_local_preview_blob_url } from './render_audit_media_list_item.js';
import {
    ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS,
    run_attach_media_modal_view_switch
} from './attach_media_modal_view_switch.js';

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
    refresh_list: () => void;
    on_open_change: (is_open: boolean) => void;
};

export type AttachMediaRenamePanel = {
    open_rename_panel: (filename: string, trigger: HTMLButtonElement) => void;
    is_open: () => boolean;
    destroy: () => void;
};

function focus_element_safe(element: HTMLElement | null | undefined): void {
    if (!element || !document.contains(element)) {
        return;
    }
    try {
        element.focus({ preventScroll: true });
    } catch {
        element.focus();
    }
}

function focus_input_at_end(input_el: HTMLInputElement | null | undefined): void {
    if (!input_el || !document.contains(input_el)) {
        return;
    }
    focus_element_safe(input_el);
    const length = input_el.value.length;
    try {
        input_el.setSelectionRange(length, length);
    } catch {
        // Ignorera om setSelectionRange inte stöds.
    }
}

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

function build_rename_panel_dom(
    Helpers: HelpersLike,
    t: TranslateFn,
    filename: string,
    on_save: () => void,
    on_keep: () => void
): { panel: HTMLElement; input_el: HTMLInputElement } {
    const panel = Helpers.create_element('div', {
        class_name: 'attach-media-rename-panel'
    });
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
    const input_el = Helpers.create_element('input', {
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
    save_btn.addEventListener('click', on_save);

    const keep_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-default'],
        attributes: { type: 'button' },
        text_content: t('attach_media_rename_keep')
    }) as HTMLButtonElement;
    keep_btn.addEventListener('click', on_keep);

    actions.appendChild(save_btn);
    actions.appendChild(keep_btn);
    panel.appendChild(actions);

    input_el.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            on_save();
        }
    });

    return { panel, input_el };
}

function map_resolve_error_to_message(t: TranslateFn, error: string): string {
    if (error === 'Filtypen stöds inte') {
        return t('attach_media_rename_failed', { details: error });
    }
    if (error === 'Ogiltigt filnamn') {
        return t('attach_media_rename_empty_name');
    }
    return t('attach_media_rename_failed', { details: error });
}

/**
 * Skapar inline-panel för omdöpning. Modalens h1 blir «Byt filnamn» medan panelen är öppen.
 */
export function create_attach_media_modal_rename_panel(
    options: AttachMediaRenamePanelOptions
): AttachMediaRenamePanel {
    const {
        t,
        Helpers,
        audit_id,
        modal_container,
        heading_el,
        modal_heading_text,
        message_el,
        modal_message_text,
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
    let view_switch_in_flight = false;
    let current_filename = '';
    let rename_trigger: HTMLButtonElement | null = null;
    let save_in_flight = false;
    let input_el: HTMLInputElement | null = null;

    const set_list_elements_hidden = (hidden: boolean) => {
        get_elements_to_hide().forEach((element) => {
            element.toggleAttribute('hidden', hidden);
        });
    };

    const set_intro_hidden = (hidden: boolean) => {
        if (!message_el) {
            return;
        }
        if (hidden) {
            message_el.hidden = true;
            return;
        }
        message_el.textContent = modal_message_text;
        message_el.hidden = modal_message_text.trim().length === 0;
    };

    const set_rename_heading = (is_rename_view: boolean) => {
        if (!heading_el) {
            return;
        }
        heading_el.textContent = is_rename_view
            ? t('attach_media_rename_panel_heading')
            : modal_heading_text;
    };

    const apply_list_view = () => {
        rename_panel_el?.remove();
        rename_panel_el = null;
        input_el = null;
        current_filename = '';
        rename_open = false;
        save_in_flight = false;
        set_list_elements_hidden(false);
        set_intro_hidden(false);
        set_rename_heading(false);
        on_open_change(false);
    };

    const close_rename_panel = (focus_element?: HTMLElement | null) => {
        if (!rename_open || view_switch_in_flight) {
            return;
        }

        const focus_el = focus_element ?? rename_trigger;
        view_switch_in_flight = true;

        void run_attach_media_modal_view_switch(
            modal_container,
            apply_list_view,
            { transition_ms: ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS }
        ).finally(() => {
            view_switch_in_flight = false;
            rename_trigger = null;
            focus_element_safe(focus_el);
        });
    };

    const apply_rename_view = (filename: string) => {
        set_list_elements_hidden(true);
        set_intro_hidden(true);
        set_rename_heading(true);

        const built = build_rename_panel_dom(
            Helpers,
            t,
            filename,
            () => {
                void handle_save();
            },
            () => {
                close_rename_panel(rename_trigger);
            }
        );

        list_mode_root.appendChild(built.panel);
        rename_panel_el = built.panel;
        input_el = built.input_el;
        current_filename = filename;
        rename_open = true;
        on_open_change(true);
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

        const prepared_name = prepare_media_rename_filename_input(current_filename, new_name_raw);
        const working = get_working_filenames();
        const resolved = resolve_media_rename_filename(
            current_filename,
            prepared_name,
            new Set(working)
        );

        if (!resolved.ok) {
            show_status(map_resolve_error_to_message(t, resolved.error), 'error');
            if (keep_focus_on_error) {
                input_el.focus();
            }
            return;
        }

        if (resolved.unchanged) {
            close_rename_panel(input_el);
            return;
        }

        if (server_index) {
            await server_index.ensure_loaded();
        }

        const server_filenames = server_index?.get_server_filenames() ?? null;
        const fetch_candidate = resolve_fetch_filename?.(current_filename) ?? current_filename;
        const server_from =
            find_server_media_filename_match(fetch_candidate, server_filenames)
            ?? find_server_media_filename_match(current_filename, server_filenames)
            ?? fetch_candidate;

        if (server_filenames && !find_server_media_filename_match(server_from, server_filenames)) {
            show_status(t('attach_media_rename_not_on_server', { filename: current_filename }), 'error');
            return;
        }

        save_in_flight = true;
        try {
            const result = await rename_audit_media(audit_id, server_from, prepared_name);
            const next_name = String(result.filename || resolved.filename || '').trim();
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
        if (rename_open || view_switch_in_flight) {
            return;
        }

        rename_trigger = trigger;
        view_switch_in_flight = true;

        void run_attach_media_modal_view_switch(
            modal_container,
            () => {
                apply_rename_view(filename);
            },
            { transition_ms: ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS }
        ).finally(() => {
            view_switch_in_flight = false;
            focus_input_at_end(input_el);
        });
    };

    return {
        open_rename_panel,
        is_open: () => rename_open,
        destroy: () => {
            if (!rename_open) {
                return;
            }
            apply_list_view();
            rename_trigger = null;
            const shell_el =
                (modal_container.closest('.modal-content') as HTMLElement | null) ?? modal_container;
            shell_el.style.opacity = '';
            shell_el.classList.remove('modal-content--attach-media-view-switch');
        }
    };
}
