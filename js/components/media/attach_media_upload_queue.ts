/**
 * @fileoverview Sekventiell uppladdningskö för media-modalen.
 */

import { upload_audit_media } from '../../api/audit_media_api.js';
import { is_browser_online } from '../../utils/browser_online.js';
import {
    revoke_audit_media_blob_url,
    set_audit_media_local_preview_blob_url
} from './render_audit_media_list_item.js';
import {
    is_upload_duplicate_filename,
    merge_uploaded_media_filenames
} from '../../logic/audit_media_server_index.js';
import {
    partition_files_by_existing_filenames,
    build_attach_media_upload_success_message,
    build_attach_media_upload_renamed_conflict_message,
    type AttachMediaDuplicateScope
} from './attach_media_duplicate_filename_status.js';
import type { AuditMediaServerIndex } from '../../logic/audit_media_server_index.js';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type EscapeHtmlFn = (value: string) => string;

type StatusType = 'info' | 'error' | 'success';

export type AttachMediaUploadQueueDeps = {
    t: TranslateFn;
    audit_id: string;
    media_scope: AttachMediaDuplicateScope;
    escape_html: EscapeHtmlFn;
    get_working_filenames: () => string[];
    set_working_filenames: (filenames: string[]) => void;
    refresh_list: () => void;
    show_status: (
        message: string,
        type?: StatusType,
        options?: { html?: boolean }
    ) => void;
    show_duplicate_filenames_error: (filenames: string[]) => void;
    persist_changes: () => Promise<boolean>;
    clear_pending_filenames: () => void;
    server_index?: AuditMediaServerIndex | null;
};

/**
 * Skapar en kö som laddar upp flera filer i tur och ordning.
 */
export function create_attach_media_upload_queue(deps: AttachMediaUploadQueueDeps) {
    const queue: File[] = [];
    let running = false;
    let abort_due_to_offline = false;
    let offline_listener: (() => void) | null = null;

    const remove_offline_listener = () => {
        if (offline_listener && typeof window !== 'undefined') {
            window.removeEventListener('offline', offline_listener);
            offline_listener = null;
        }
    };

    const handle_offline_abort = () => {
        abort_due_to_offline = true;
        queue.length = 0;
        deps.clear_pending_filenames();
        deps.show_status(deps.t('attach_media_upload_lost_connection'), 'error');
    };

    const rollback_optimistic_filename = (local_name: string, was_already_in_list: boolean) => {
        if (was_already_in_list) return;
        deps.set_working_filenames(
            deps.get_working_filenames().filter((name) => name !== local_name)
        );
        deps.refresh_list();
    };

    const apply_upload_preview = (filename: string, local_preview_url: string): void => {
        set_audit_media_local_preview_blob_url(deps.audit_id, filename, local_preview_url);
        deps.refresh_list();
    };

    const upload_single_file = async (
        file: File
    ): Promise<{ filename: string | null; renamed_due_to_conflict: boolean }> => {
        if (!is_browser_online() || abort_due_to_offline) {
            return { filename: null, renamed_due_to_conflict: false };
        }

        const local_name = String(file.name || '').trim();
        if (!local_name) return { filename: null, renamed_due_to_conflict: false };

        const working_filenames = deps.get_working_filenames();
        const server_filenames = deps.server_index?.get_server_filenames();
        if (is_upload_duplicate_filename(local_name, working_filenames, server_filenames)) {
            deps.show_duplicate_filenames_error([local_name]);
            return { filename: null, renamed_due_to_conflict: false };
        }

        const already_in_list = working_filenames.includes(local_name);
        const optimistic_filenames = already_in_list
            ? [...working_filenames]
            : [...working_filenames, local_name];
        deps.set_working_filenames(optimistic_filenames);
        const local_preview_url = URL.createObjectURL(file);
        set_audit_media_local_preview_blob_url(deps.audit_id, local_name, local_preview_url);
        deps.refresh_list();
        deps.show_status(deps.t('attach_media_uploading'), 'info');

        try {
            const result = await upload_audit_media(deps.audit_id, file);
            if (!is_browser_online() || abort_due_to_offline) {
                revoke_audit_media_blob_url(deps.audit_id, local_name);
                rollback_optimistic_filename(local_name, already_in_list);
                return { filename: null, renamed_due_to_conflict: false };
            }

            const server_name = String(result?.filename || '').trim();
            if (!server_name) {
                revoke_audit_media_blob_url(deps.audit_id, local_name);
                throw new Error(deps.t('attach_media_upload_failed'));
            }

            if (server_name !== local_name) {
                revoke_audit_media_blob_url(deps.audit_id, local_name);
                set_audit_media_local_preview_blob_url(deps.audit_id, server_name, local_preview_url);
            }

            const current = merge_uploaded_media_filenames(
                deps.get_working_filenames(),
                local_name,
                server_name
            );
            deps.set_working_filenames(current);
            deps.refresh_list();
            deps.server_index?.mark_on_server(server_name);
            await deps.persist_changes();
            apply_upload_preview(server_name, local_preview_url);

            const renamed_due_to_conflict = Boolean(result.renamedDueToConflict);
            if (renamed_due_to_conflict) {
                const conflict_message = build_attach_media_upload_renamed_conflict_message(
                    deps.t,
                    deps.escape_html,
                    server_name
                );
                if (conflict_message) {
                    deps.show_status(conflict_message, 'success', { html: true });
                }
            }

            return { filename: server_name, renamed_due_to_conflict };
        } catch (err) {
            revoke_audit_media_blob_url(deps.audit_id, local_name);
            if (abort_due_to_offline) {
                rollback_optimistic_filename(local_name, already_in_list);
                return { filename: null, renamed_due_to_conflict: false };
            }
            const msg = err instanceof Error ? err.message : deps.t('attach_media_upload_failed');
            rollback_optimistic_filename(local_name, already_in_list);
            deps.show_status(msg, 'error');
            return { filename: null, renamed_due_to_conflict: false };
        }
    };

    const show_batch_upload_success = (uploaded_count: number, single_filename?: string) => {
        if (abort_due_to_offline) return;
        const message = build_attach_media_upload_success_message(
            deps.t,
            deps.escape_html,
            uploaded_count,
            single_filename
        );
        if (!message) return;
        deps.show_status(message, 'success', { html: uploaded_count === 1 });
    };

    const drain_queue = async () => {
        if (running) return;
        if (!is_browser_online()) {
            deps.show_status(deps.t('attach_media_upload_requires_online'), 'error');
            deps.clear_pending_filenames();
            return;
        }

        running = true;
        abort_due_to_offline = false;
        offline_listener = () => handle_offline_abort();
        if (typeof window !== 'undefined') {
            window.addEventListener('offline', offline_listener);
        }

        let uploaded_count = 0;
        let last_uploaded_name = '';
        let single_upload_renamed = false;
        try {
            while (queue.length > 0) {
                if (!is_browser_online() || abort_due_to_offline) {
                    break;
                }
                const next_file = queue.shift();
                if (!next_file) continue;
                const remaining = queue.length;
                if (remaining > 0) {
                    deps.show_status(
                        deps.t('attach_media_uploading_multiple', {
                            filename: String(next_file.name || '').trim(),
                            remaining
                        }),
                        'info'
                    );
                }
                const upload_result = await upload_single_file(next_file);
                if (upload_result.filename) {
                    uploaded_count += 1;
                    last_uploaded_name = upload_result.filename;
                    single_upload_renamed = upload_result.renamed_due_to_conflict;
                } else if (abort_due_to_offline) {
                    break;
                }
            }
            const skip_batch_success = uploaded_count === 1 && single_upload_renamed;
            if (!skip_batch_success) {
                show_batch_upload_success(uploaded_count, last_uploaded_name);
            }
        } finally {
            running = false;
            remove_offline_listener();
            deps.clear_pending_filenames();
        }
    };

    const enqueue_files = (files: File[]) => {
        if (!is_browser_online()) {
            deps.show_status(deps.t('attach_media_upload_requires_online'), 'error');
            deps.clear_pending_filenames();
            return;
        }
        const { new_files, duplicate_names } = partition_files_by_existing_filenames(
            files,
            deps.get_working_filenames(),
            deps.server_index?.get_server_filenames()
        );
        if (duplicate_names.length > 0) {
            deps.show_duplicate_filenames_error(duplicate_names);
        }
        if (new_files.length === 0) {
            deps.clear_pending_filenames();
            return;
        }
        queue.push(...new_files);
        void drain_queue();
    };

    return { enqueue_files };
}
