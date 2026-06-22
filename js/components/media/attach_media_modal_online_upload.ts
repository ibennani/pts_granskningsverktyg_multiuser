/**
 * @fileoverview Hanterar uppladdningszon i Bifoga media med offline-blockering.
 */

import { create_attach_media_file_drop_zone } from './attach_media_file_drop_zone.js';
import { MEDIA_MAX_UPLOAD_BYTES } from '../../../shared/constants/media_upload_limits.js';
import { create_attach_media_upload_queue } from './attach_media_upload_queue.js';
import { is_browser_online } from '../../utils/browser_online.js';
import { flush_pending_media_deletes_for_audit } from '../../sync/pending_audit_media_deletes.js';
import type { AttachMediaDuplicateScope } from './attach_media_duplicate_filename_status.js';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type HelpersLike = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
};

type StatusType = 'info' | 'error' | 'success';

export type CreateOnlineUploadSectionOptions = {
    t: TranslateFn;
    Helpers: HelpersLike;
    audit_id: string;
    textarea_id: string;
    container: HTMLElement;
    heading_el: HTMLHeadingElement | null;
    media_scope: AttachMediaDuplicateScope;
    escape_html: (value: string) => string;
    get_working_filenames: () => string[];
    set_working_filenames: (filenames: string[]) => void;
    refresh_list: () => void;
    show_status: (message: string, type?: StatusType, options?: { html?: boolean }) => void;
    show_duplicate_filenames_error: (filenames: string[]) => void;
    persist_changes: () => Promise<boolean>;
    get_drop_enabled: () => boolean;
    get_still_referenced_filenames_after_save?: (final_filenames_here: string[]) => Set<string>;
    server_index?: import('../../logic/audit_media_server_index.js').AuditMediaServerIndex | null;
};

export type OnlineUploadSection = {
    mount_element: HTMLElement;
    enqueue_upload_files: (files: File[]) => void;
    destroy: () => void;
};

/**
 * Skapar uppladdningssektion som döljs offline och återaktiveras vid online.
 */
export function create_online_upload_section(
    options: CreateOnlineUploadSectionOptions
): OnlineUploadSection {
    const {
        t,
        Helpers,
        audit_id,
        textarea_id,
        container,
        heading_el,
        media_scope,
        escape_html,
        get_working_filenames,
        set_working_filenames,
        refresh_list,
        show_status,
        show_duplicate_filenames_error,
        persist_changes,
        get_drop_enabled,
        get_still_referenced_filenames_after_save,
        server_index
    } = options;

    const mount_element = Helpers.create_element('div', {
        class_name: 'attach-media-upload-mount'
    });

    let offline_hint_el: HTMLElement | null = null;
    let destroy_drop_zone = () => {};
    let clear_pending_filenames = () => {};
    let enqueue_upload_files = (_files: File[]) => {};

    const flush_pending_deletes = () => {
        if (!is_browser_online() || !get_still_referenced_filenames_after_save) return;
        void flush_pending_media_deletes_for_audit(audit_id, () =>
            get_still_referenced_filenames_after_save(get_working_filenames())
        );
    };

    const unmount_drop_zone = () => {
        destroy_drop_zone();
        destroy_drop_zone = () => {};
        clear_pending_filenames = () => {};
        enqueue_upload_files = () => {};
        mount_element.replaceChildren();
    };

    const mount_drop_zone = () => {
        unmount_drop_zone();
        const upload_label_id = `${textarea_id}-upload-label`;
        const { group, set_pending_filenames, destroy } = create_attach_media_file_drop_zone({
            helpers: Helpers,
            t,
            input_id: `${textarea_id}-file-input`,
            label_id: upload_label_id,
            label_key: 'attach_media_choose_file_label',
            on_files: (files) => enqueue_upload_files(files),
            on_status: show_status,
            max_file_bytes: MEDIA_MAX_UPLOAD_BYTES,
            additional_drop_targets: [container],
            accept_drop_on_viewport: true,
            get_drop_enabled
        });
        destroy_drop_zone = destroy;
        clear_pending_filenames = () => set_pending_filenames([]);

        const upload_queue = create_attach_media_upload_queue({
            t,
            audit_id,
            media_scope,
            escape_html,
            get_working_filenames,
            set_working_filenames,
            refresh_list,
            show_status,
            show_duplicate_filenames_error,
            persist_changes,
            clear_pending_filenames,
            server_index
        });
        enqueue_upload_files = upload_queue.enqueue_files;
        mount_element.appendChild(group);
    };

    const show_offline_hint = () => {
        if (!offline_hint_el && heading_el) {
            offline_hint_el = Helpers.create_element('p', {
                class_name: 'attach-media-offline-upload-hint',
                text_content: t('attach_media_upload_requires_online'),
                attributes: { 'aria-live': 'polite' }
            });
            heading_el.insertAdjacentElement('afterend', offline_hint_el);
        }
        if (offline_hint_el) {
            offline_hint_el.hidden = false;
        }
    };

    const hide_offline_hint = () => {
        if (offline_hint_el) {
            offline_hint_el.hidden = true;
        }
    };

    const sync_online_state = (online: boolean) => {
        if (online) {
            hide_offline_hint();
            mount_drop_zone();
            flush_pending_deletes();
        } else {
            unmount_drop_zone();
            show_offline_hint();
        }
    };

    const on_online = () => sync_online_state(true);
    const on_offline = () => sync_online_state(false);

    if (typeof window !== 'undefined') {
        window.addEventListener('online', on_online);
        window.addEventListener('offline', on_offline);
    }

    sync_online_state(is_browser_online());

    return {
        mount_element,
        enqueue_upload_files: (files) => enqueue_upload_files(files),
        destroy: () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('online', on_online);
                window.removeEventListener('offline', on_offline);
            }
            unmount_drop_zone();
            offline_hint_el?.remove();
            offline_hint_el = null;
        }
    };
}
