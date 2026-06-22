/**
 * @fileoverview Sparar mediaändringar från modalen Bifoga media till server och state.
 */

import { delete_audit_media } from '../../api/audit_media_api.js';
import { filenames_safe_to_delete_from_server } from '../../logic/audit_attached_media_references.js';
import { filenames_existing_on_server } from '../../logic/audit_media_server_index.js';
import type { AuditMediaServerIndex } from '../../logic/audit_media_server_index.js';
import { revoke_audit_media_blob_url } from './render_audit_media_list_item.js';
import { is_browser_online } from '../../utils/browser_online.js';
import { enqueue_pending_media_deletes } from '../../sync/pending_audit_media_deletes.js';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type HelpersLike = {
    trim_textarea_preserve_lines?: (raw: string) => string;
};

type AttachMediaModalPersistOptions = {
    t: TranslateFn;
    Helpers: HelpersLike;
    audit_id?: string | null;
    can_upload: boolean;
    textarea_id: string;
    container: HTMLElement;
    modal: { close: (focus_element?: HTMLElement | null) => void };
    trigger_element?: HTMLElement | null;
    close_focus_el: HTMLElement | null;
    on_save: (filenames: string[]) => void | Promise<void>;
    get_still_referenced_filenames_after_save?: (final_filenames_here: string[]) => Set<string>;
    show_status: (message: string, type: 'info' | 'error' | 'success') => void;
    refresh_list: () => void;
    get_working_filenames: () => string[];
    set_working_filenames: (filenames: string[]) => void;
    get_persisted_filenames: () => Set<string>;
    set_persisted_filenames: (filenames: Set<string>) => void;
    get_persist_in_flight: () => boolean;
    set_persist_in_flight: (value: boolean) => void;
    server_index?: AuditMediaServerIndex | null;
};

function parse_filenames_from_textarea(
    textarea: HTMLTextAreaElement,
    Helpers: HelpersLike
): string[] {
    const raw = textarea.value || '';
    const trimmed =
        typeof Helpers.trim_textarea_preserve_lines === 'function'
            ? Helpers.trim_textarea_preserve_lines(raw)
            : raw;
    return trimmed
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

/**
 * Parsar filnamn från textarea i modalen Bifoga media (ett per rad).
 */
export function parse_attach_media_filenames_from_textarea(
    textarea: HTMLTextAreaElement,
    Helpers: HelpersLike
): string[] {
    return parse_filenames_from_textarea(textarea, Helpers);
}

async function delete_media_files_from_server(
    audit_id: string,
    filenames_to_delete: string[],
    server_filenames: Set<string> | null | undefined
): Promise<void> {
    const on_server = filenames_existing_on_server(filenames_to_delete, server_filenames);
    for (const filename of filenames_to_delete) {
        if (!on_server.includes(filename)) {
            // Äldre filnamnsreferens utan serverfil — inget att radera, behåll ev. lokal miniatyr.
            continue;
        }
        await delete_audit_media(audit_id, filename);
        revoke_audit_media_blob_url(audit_id, filename);
    }
}

/**
 * Skapar funktion för att spara mediaändringar i modalen Bifoga media.
 */
export function create_attach_media_modal_persist(
    options: AttachMediaModalPersistOptions
): (close_after: boolean) => Promise<boolean> {
    const {
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
        get_working_filenames,
        set_working_filenames,
        get_persisted_filenames,
        set_persisted_filenames,
        get_persist_in_flight,
        set_persist_in_flight,
        server_index
    } = options;

    const filenames_are_synced = (): boolean => {
        const working_filenames = get_working_filenames();
        const persisted_filenames = get_persisted_filenames();
        if (working_filenames.length !== persisted_filenames.size) return false;
        return working_filenames.every((name) => persisted_filenames.has(name));
    };

    return async (close_after: boolean): Promise<boolean> => {
        if (get_persist_in_flight()) return false;

        const manual_textarea = container.querySelector(`#${CSS.escape(textarea_id)}`) as HTMLTextAreaElement | null;
        if (manual_textarea) {
            set_working_filenames(parse_filenames_from_textarea(manual_textarea, Helpers));
            refresh_list();
        }

        if (filenames_are_synced()) {
            if (close_after) {
                modal.close(trigger_element || close_focus_el);
            }
            return true;
        }

        set_persist_in_flight(true);
        const working_filenames = get_working_filenames();
        const persisted_filenames = get_persisted_filenames();
        const final_set = new Set(working_filenames);
        try {
            if (audit_id && can_upload && get_still_referenced_filenames_after_save) {
                const removed_from_modal = [...persisted_filenames].filter((name) => !final_set.has(name));
                if (removed_from_modal.length > 0) {
                    const still_referenced = get_still_referenced_filenames_after_save(working_filenames);
                    const filenames_to_delete = filenames_safe_to_delete_from_server(
                        removed_from_modal,
                        still_referenced
                    );
                    if (filenames_to_delete.length > 0) {
                        const server_filenames = server_index?.get_server_filenames();
                        if (is_browser_online()) {
                            await delete_media_files_from_server(
                                audit_id,
                                filenames_to_delete,
                                server_filenames
                            );
                            filenames_to_delete.forEach((name) => {
                                server_index?.mark_removed_from_server(name);
                            });
                        } else {
                            enqueue_pending_media_deletes(audit_id, filenames_to_delete);
                        }
                    }
                }
            }

            await Promise.resolve(on_save(working_filenames));
            set_persisted_filenames(new Set(working_filenames));
            refresh_list();
            if (close_after) {
                modal.close(trigger_element || close_focus_el);
            }
            return true;
        } catch (err) {
            const failed_name = working_filenames.find((name) => !persisted_filenames.has(name))
                || [...persisted_filenames].find((name) => !final_set.has(name))
                || '';
            const msg = err instanceof Error ? err.message : t('attach_media_delete_failed');
            show_status(
                t('attach_media_delete_failed', {
                    filename: failed_name || t('attach_media_modal_h1'),
                    details: msg
                }),
                'error'
            );
            return false;
        } finally {
            set_persist_in_flight(false);
        }
    };
}
