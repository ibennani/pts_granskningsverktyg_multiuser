/**
 * @fileoverview Gemensam modal för att bifoga och hantera mediefiler.
 */

import { app_runtime_refs } from '../../utils/app_runtime_refs.js';
import { can_upload_audit_media } from '../../api/audit_media_api.js';
import { format_media_max_upload_size_label } from '../../../shared/constants/media_upload_limits.js';
import { setup_attach_media_modal_content } from './attach_media_modal_setup.js';
import type { AttachMediaModalOptions } from './attach_media_modal_setup.js';
export type { AttachMediaModalOptions } from './attach_media_modal_setup.js';

function normalize_filenames(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((v) => String(v).trim()).filter(Boolean);
}

function build_attach_media_modal_intro(
    t: AttachMediaModalOptions['t'],
    intro_key: string,
    include_size_limit: boolean
): string {
    const intro = t(intro_key);
    if (!include_size_limit) {
        return intro;
    }
    return `${intro} ${t('attach_media_modal_max_file_size', { max_size: format_media_max_upload_size_label() })}`;
}

/**
 * Öppnar modalen för att bifoga media.
 */
export function open_attach_media_modal(options: AttachMediaModalOptions): void {
    const ModalComponent = app_runtime_refs.modal_component as {
        show?: (
            opts: { h1_text: string; message_text: string },
            render: (container: HTMLElement, modal: { close: (el?: HTMLElement | null) => void }) => void
        ) => void;
    } | null;
    if (!ModalComponent?.show) return;

    const {
        t,
        initial_filenames,
        intro_key = 'attach_media_modal_intro',
        audit_id
    } = options;

    const can_upload = can_upload_audit_media(audit_id);
    const working_filenames = normalize_filenames(initial_filenames);

    ModalComponent.show(
        {
            h1_text: t('attach_media_modal_h1'),
            message_text: build_attach_media_modal_intro(t, intro_key, can_upload)
        },
        (container, modal) => {
            setup_attach_media_modal_content(container, modal, {
                ...options,
                can_upload,
                working_filenames,
                persisted_filenames: new Set(working_filenames),
                persist_in_flight: false
            });
        }
    );
}
