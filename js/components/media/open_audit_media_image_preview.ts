/**
 * @fileoverview Modal för att visa en bifogad mediebild i större format.
 */

import { app_runtime_refs } from '../../utils/app_runtime_refs.js';
import { mount_audit_media_image_preview } from './audit_media_image_preview_mount.js';
import type { AuditMediaObservationEditOptions } from './audit_media_preview_observation.js';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type HelpersLike = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
};

export type OpenAuditMediaImagePreviewOptions = {
    t: TranslateFn;
    Helpers: HelpersLike;
    audit_id: string;
    filename: string;
    blob_url?: string | null;
    trigger_element?: HTMLElement | null;
    observation_detail?: string | null;
    observation_edit?: AuditMediaObservationEditOptions | null;
};

/**
 * Öppnar en modal med en större förhandsvisning av en bifogad bild.
 */
export function open_audit_media_image_preview(options: OpenAuditMediaImagePreviewOptions): void {
    const ModalComponent = app_runtime_refs.modal_component as {
        show?: (
            opts: { h1_text: string; message_text: string },
            render: (container: HTMLElement, modal: { close: (el?: HTMLElement | null) => void }) => void
        ) => void;
    } | null;
    if (!ModalComponent?.show) return;

    const { t, Helpers, audit_id, filename, blob_url, trigger_element, observation_detail, observation_edit } = options;

    ModalComponent.show(
        { h1_text: filename, message_text: '' },
        (container, modal) => {
            const dialog_el = (modal as { dialog_element_ref?: HTMLDialogElement | null }).dialog_element_ref;
            mount_audit_media_image_preview(container, dialog_el ?? null, {
                t,
                Helpers,
                audit_id,
                filename,
                blob_url,
                observation_detail,
                observation_edit,
                close_button_label: t('audit_media_preview_close'),
                on_close: (focus_target) => {
                    modal.close(focus_target);
                },
                trigger_element
            });
        }
    );
}
